/**
 * Ichki laboratoriya nazorati (B4.8, TZ §6.5): every control series with its
 * newest run, and for the chosen one the Levey–Jennings chart, the entry form
 * and the run history with Westgard verdicts.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertOctagon, ChevronDown, FlaskConical, Loader2, Send, ShieldCheck } from "lucide-react";
import type { QcBoard, QcResult, QcTargetView } from "@shared/schema";
import { WESTGARD_RULE_INFO, isExpired, seriesStats } from "@shared/qc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, SectionCard } from "@/components/ui-kit";
import { LeveyJenningsChart } from "@/components/qc/lj-chart";
import { ExpiryBadge, QcStatusBadge, TextPromptDialog, fmtNum, localNow, parseNumber, toIso } from "@/components/qc/qc-ui";
import { apiRequest, invalidateApi } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";

export function QcInternal({ board, onGoMaterials }: { board: QcBoard; onGoMaterials: () => void }) {
  const { can } = useAuth();
  const active = board.targets.filter((t) => t.isActive && t.materialActive);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedId || !active.some((t) => t.id === selectedId)) setSelectedId(active[0]?.id ?? null);
  }, [active, selectedId]);
  const selected = active.find((t) => t.id === selectedId) ?? null;
  const open = active.reduce((s, t) => s + t.openRejections, 0);

  if (active.length === 0) {
    return (
      <div className="card-premium">
        <EmptyState
          icon={FlaskConical}
          title="Nazorat seriyasi yo'q"
          description="Avval nazorat materialini (nomi, LOT, daraja, muddati) kiriting va unga tahlil bo'yicha o'rtacha qiymat va SD belgilang."
          action={
            can("qc.manage") ? (
              <Button variant="outline" onClick={onGoMaterials} data-testid="button-go-materials">
                Nazorat materiallariga o'tish
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {open > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm" role="alert" data-testid="alert-qc-open">
          <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div>
            <p className="font-semibold text-rose-800 dark:text-rose-200">{open} ta rad etilgan nazorat natijasiga chora yozilmagan</p>
            <p className="text-rose-800/80 dark:text-rose-200/80">
              Westgard qoidasi buzilgan seriyada bemor natijalarini chiqarishdan oldin sababni toping va ko'rilgan chorani yozing.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(280px,1fr)_2.2fr]">
        {/* ------------------------------------------------------ series list */}
        <section className="card-premium self-start overflow-hidden" aria-label="Nazorat seriyalari">
          <header className="border-b px-5 py-4">
            <h3 className="text-[15px] font-semibold">Nazorat seriyalari</h3>
            <p className="text-xs text-muted-foreground">Bugun {active.filter((t) => t.runsToday > 0).length} / {active.length} tasi o'lchangan</p>
          </header>
          <ul className="max-h-[640px] divide-y overflow-y-auto" data-testid="list-qc-series">
            {active.map((t) => {
              const expired = isExpired(t.materialExpiresOn, board.date);
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    aria-current={t.id === selectedId}
                    className={cn(
                      "flex w-full flex-col gap-1 px-5 py-3 text-left transition-colors hover:bg-muted/40",
                      t.id === selectedId && "bg-primary/5 shadow-[inset_3px_0_0_hsl(var(--primary))]",
                    )}
                    data-testid={`row-qc-series-${t.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{t.testName}</span>
                      {t.lastResult ? <QcStatusBadge status={t.lastResult.status} className="text-[10px]" /> : <span className="text-[11px] text-muted-foreground">natija yo'q</span>}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.level} · LOT {t.lotNumber}
                      {t.deviceName ? ` · ${t.deviceName}` : ""}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      {t.lastResult && (
                        <span className="tabular">
                          Oxirgi: {fmtNum(t.lastResult.value)} (z {t.lastResult.z > 0 ? "+" : ""}
                          {t.lastResult.z.toFixed(2)})
                        </span>
                      )}
                      <span className={cn(t.runsToday === 0 && "text-amber-700 dark:text-amber-300")}>
                        {t.runsToday === 0 ? "Bugun o'lchanmagan" : `Bugun ${t.runsToday} marta`}
                      </span>
                      {t.openRejections > 0 && <span className="font-semibold text-rose-600 dark:text-rose-400">{t.openRejections} ta chora kutilmoqda</span>}
                      {expired && <span className="font-semibold text-rose-600 dark:text-rose-400">material muddati o'tgan</span>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {selected && <SeriesDetail key={selected.id} target={selected} today={board.date} />}
      </div>
    </div>
  );
}

function SeriesDetail({ target, today }: { target: QcTargetView; today: string }) {
  const { can } = useAuth();
  const { toast } = useToast();
  const { data: results = [], isLoading } = useQuery<QcResult[]>({
    queryKey: [`/api/qc/targets/${target.id}/results?limit=60`],
    refetchOnMount: "always",
  });
  const [value, setValue] = useState("");
  const [measuredAt, setMeasuredAt] = useState(localNow());
  const [reagentLot, setReagentLot] = useState("");
  const [reagentExpiresOn, setReagentExpiresOn] = useState("");
  const [comment, setComment] = useState("");
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<QcResult | null>(null);
  const [voiding, setVoiding] = useState<QcResult | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const expired = isExpired(target.materialExpiresOn, today);
  const live = results.filter((r) => !r.voidedAt);
  const stats = useMemo(() => seriesStats(live.map((r) => r.value)), [live]);
  const refresh = () => invalidateApi("/api/qc");

  const add = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/qc/targets/${target.id}/results`, {
        value: parseNumber(value),
        measuredAt: toIso(measuredAt),
        reagentLot: reagentLot || null,
        reagentExpiresOn: reagentExpiresOn || null,
        comment: comment || null,
      });
      return (await res.json()) as QcResult;
    },
    onSuccess: (r) => {
      refresh();
      setValue("");
      setComment("");
      setMeasuredAt(localNow());
      setError(null);
      const rules = r.rules.map((x) => WESTGARD_RULE_INFO[x].label).join(", ");
      toast({
        variant: r.status === "reject" ? "destructive" : "default",
        title: r.status === "ok" ? "Nazorat natijasi qabul qilindi" : r.status === "warning" ? "Ogohlantirish: 1₂s" : `Rad etildi: ${rules}`,
        description:
          r.status === "reject"
            ? "Seriya nazoratdan chiqqan. Sababni toping va chora yozing."
            : `z = ${r.z > 0 ? "+" : ""}${r.z.toFixed(2)}`,
      });
    },
    onError: (err: Error) => setError(err.message),
  });

  const review = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      await apiRequest("POST", `/api/qc/results/${id}/review`, { correctiveAction: text });
    },
    onSuccess: () => {
      refresh();
      setReviewing(null);
      toast({ title: "Chora yozildi" });
    },
    onError: (err: Error) => setDialogError(err.message),
  });
  const voidRun = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      await apiRequest("POST", `/api/qc/results/${id}/void`, { reason: text });
    },
    onSuccess: () => {
      refresh();
      setVoiding(null);
      toast({ title: "Natija bekor qilindi", description: "U seriyadan va grafikdan chiqarildi" });
    },
    onError: (err: Error) => setDialogError(err.message),
  });

  return (
    <div className="min-w-0 space-y-5">
      <SectionCard
        icon={ShieldCheck}
        title={target.testName}
        description={`${target.materialName} · ${target.level} · LOT ${target.lotNumber}${target.deviceName ? ` · ${target.deviceName}` : ""}`}
        bodyClassName="p-5"
      >
        <dl className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Belgilangan o'rtacha</dt>
            <dd className="font-semibold tabular">
              {fmtNum(target.mean)} <span className="text-xs font-normal text-muted-foreground">{target.unit ?? ""}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Belgilangan SD</dt>
            <dd className="font-semibold tabular">
              {fmtNum(target.sd)} <span className="text-xs font-normal text-muted-foreground">CV {((target.sd / Math.abs(target.mean || 1)) * 100).toFixed(1)}%</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Haqiqiy (oxirgi {stats?.n ?? live.length})</dt>
            <dd className="font-semibold tabular" data-testid="text-qc-observed">
              {stats ? `${fmtNum(stats.mean)} ± ${fmtNum(stats.sd)}` : "—"}
              {stats && <span className="text-xs font-normal text-muted-foreground"> CV {stats.cv.toFixed(1)}%</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Material muddati</dt>
            <dd className="text-sm">
              <ExpiryBadge day={target.materialExpiresOn} today={today} />
            </dd>
          </div>
        </dl>
        {isLoading ? (
          <div className="h-[280px] skeleton-shimmer rounded-lg" />
        ) : (
          <LeveyJenningsChart results={results} mean={target.mean} sd={target.sd} unit={target.unit} />
        )}
      </SectionCard>

      {can("qc.enter") && (
        <section className="card-premium p-5" aria-label="Natija kiritish">
          {expired ? (
            <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
              Nazorat materialining muddati o'tgan. Yangi LOT kiritilmaguncha bu seriyaga natija yozilmaydi.
            </p>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                add.mutate();
              }}
            >
              <div className="grid gap-3 sm:grid-cols-[1fr_1.2fr_auto] sm:items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="qc-value">Nazorat natijasi{target.unit ? `, ${target.unit}` : ""}</Label>
                  <Input id="qc-value" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder={fmtNum(target.mean)} className="tabular" data-testid="input-qc-value" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="qc-time">O'lchangan vaqt</Label>
                  <Input id="qc-time" type="datetime-local" value={measuredAt} max={localNow()} onChange={(e) => setMeasuredAt(e.target.value)} />
                </div>
                <Button type="submit" disabled={add.isPending || !value.trim()} className="shadow-brand" data-testid="button-qc-submit">
                  {add.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Kiritish
                </Button>
              </div>
              <button type="button" onClick={() => setMore((v) => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-primary" aria-expanded={more}>
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", more && "rotate-180")} />
                Reagent LOT, muddati va izoh
              </button>
              {more && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="qc-rlot">Reagent LOT</Label>
                    <Input id="qc-rlot" value={reagentLot} onChange={(e) => setReagentLot(e.target.value)} className="font-mono" data-testid="input-qc-reagent-lot" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="qc-rexp">Reagent muddati</Label>
                    <Input id="qc-rexp" type="date" value={reagentExpiresOn} onChange={(e) => setReagentExpiresOn(e.target.value)} data-testid="input-qc-reagent-exp" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="qc-comment">Izoh</Label>
                    <Input id="qc-comment" value={comment} onChange={(e) => setComment(e.target.value)} />
                  </div>
                </div>
              )}
              {error && <p className="text-sm text-destructive" data-testid="text-qc-error">{error}</p>}
            </form>
          )}
        </section>
      )}

      <section className="card-premium overflow-hidden" aria-label="Natijalar tarixi">
        <header className="border-b px-5 py-4">
          <h3 className="text-[15px] font-semibold">Natijalar tarixi</h3>
          <p className="text-xs text-muted-foreground">Har bir natija kiritilgan paytdagi seriya bo'yicha baholangan; bu baho keyin o'zgarmaydi.</p>
        </header>
        {live.length === 0 && results.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Hali natija yo'q.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="table-premium">
              <TableHeader>
                <TableRow>
                  <TableHead>Vaqt</TableHead>
                  <TableHead className="text-right">Natija</TableHead>
                  <TableHead className="text-right">z</TableHead>
                  <TableHead>Baho</TableHead>
                  <TableHead className="hidden lg:table-cell">Kim · reagent</TableHead>
                  <TableHead className="w-40" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...results].reverse().map((r) => (
                  <TableRow key={r.id} className={cn(r.voidedAt && "opacity-55")} data-testid={`row-qc-result-${r.id}`}>
                    <TableCell className="whitespace-nowrap text-sm tabular">{formatDateTime(r.measuredAt)}</TableCell>
                    <TableCell className={cn("text-right font-semibold tabular", r.voidedAt && "line-through")}>{fmtNum(r.value)}</TableCell>
                    <TableCell className="text-right tabular">
                      {r.z > 0 ? "+" : ""}
                      {r.z.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {r.voidedAt ? (
                        <span className="text-xs text-muted-foreground">Bekor qilingan: {r.voidReason}</span>
                      ) : (
                        <div className="space-y-1">
                          <QcStatusBadge status={r.status} className="text-[10px]" />
                          {r.rules.length > 0 && (
                            <p className="text-[11px] text-muted-foreground" title={r.rules.map((x) => WESTGARD_RULE_INFO[x].description).join("\n")}>
                              {r.rules.map((x) => WESTGARD_RULE_INFO[x].label).join(", ")}
                            </p>
                          )}
                          {r.correctiveAction && (
                            <p className="text-[11px] text-emerald-700 dark:text-emerald-400" data-testid={`text-qc-action-${r.id}`}>
                              Chora: {r.correctiveAction} · {r.reviewedByName}
                            </p>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                      {r.enteredByName ?? "—"}
                      {r.reagentLot && <span className="block font-mono">R-LOT {r.reagentLot}</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {!r.voidedAt && r.status !== "ok" && !r.reviewedAt && can("qc.enter") && (
                          <Button
                            size="sm"
                            variant={r.status === "reject" ? "default" : "outline"}
                            className="h-8"
                            onClick={() => {
                              setDialogError(null);
                              setReviewing(r);
                            }}
                            data-testid={`button-qc-review-${r.id}`}
                          >
                            Chora yozish
                          </Button>
                        )}
                        {!r.voidedAt && can("qc.manage") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-muted-foreground"
                            onClick={() => {
                              setDialogError(null);
                              setVoiding(r);
                            }}
                            data-testid={`button-qc-void-${r.id}`}
                          >
                            Bekor qilish
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <TextPromptDialog
        open={!!reviewing}
        onOpenChange={(o) => !o && setReviewing(null)}
        title="Ko'rilgan chora"
        description={reviewing ? `${fmtNum(reviewing.value)} · ${reviewing.rules.map((x) => WESTGARD_RULE_INFO[x].label).join(", ")}` : undefined}
        label="Sabab va nima qilindi"
        placeholder="Masalan: reagent almashtirildi, qayta kalibrlandi, nazorat qayta o'lchandi — nazoratda"
        confirmLabel="Saqlash"
        pending={review.isPending}
        error={dialogError}
        onConfirm={(text) => reviewing && review.mutate({ id: reviewing.id, text })}
        testId="qc-review"
      />
      <TextPromptDialog
        open={!!voiding}
        onOpenChange={(o) => !o && setVoiding(null)}
        title="Natijani bekor qilish"
        description="Faqat noto'g'ri kiritilgan yoki noto'g'ri o'lchangan natija uchun. Yozuv o'chirilmaydi, seriyadan chiqariladi."
        label="Sabab"
        confirmLabel="Bekor qilish"
        destructive
        pending={voidRun.isPending}
        error={dialogError}
        onConfirm={(text) => voiding && voidRun.mutate({ id: voiding.id, text })}
        testId="qc-void"
      />
    </div>
  );
}
