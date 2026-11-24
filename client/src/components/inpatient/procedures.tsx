/**
 * Muolajalar (B6.5, TZ §8.1.4): the doctor's orders on the case history page
 * and the nurse's list of doses — what, for whom, where, when — each marked
 * done (who, when) or not done (why). Rules: shared/procedures.ts.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Loader2, Pill, Plus, RotateCcw, Square, Syringe, X } from "lucide-react";
import type { InpatientOrderView, PrescriptionCatalog, ProcedureTaskView } from "@shared/schema";
import { ADMIN_ROUTES, ADMIN_ROUTE_LABELS, type AdminRoute } from "@shared/prescription";
import {
  MAX_ORDER_DAYS,
  MAX_TIMES_PER_DAY,
  ORDER_KIND_LABELS,
  TASK_STATE_LABELS,
  TIME_PRESETS,
  addDays,
  markDoneProblem,
  normalizeTimes,
  orderProblem,
  orderProgress,
  planSlots,
  taskState,
  type OrderKind,
  type TaskState,
} from "@shared/procedures";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MeterBar, SectionCard, StatCard } from "@/components/ui-kit";
import { TextPromptDialog } from "@/components/qc/qc-ui";
import { apiRequest, invalidateApi } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { dayKey, formatDateTime, formatDay, formatDayLong, formatTime, money } from "@/lib/format";
import { fmtQty } from "@shared/inventory";
import { liveInterval } from "@/lib/live-updates";

const STATE_TONE: Record<TaskState, string> = {
  overdue: "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300",
  due: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  upcoming: "border-border text-muted-foreground",
  done: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  missed: "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  cancelled: "border-border text-muted-foreground line-through",
};
/** The grid cell of a dose: colour and a glyph, never colour alone. */
const CELL: Record<TaskState, { cls: string; glyph: string }> = {
  done: { cls: "bg-emerald-500 text-white border-emerald-600", glyph: "✓" },
  missed: { cls: "bg-slate-200 text-slate-700 border-slate-400 dark:bg-slate-700 dark:text-slate-200", glyph: "✕" },
  overdue: { cls: "border-rose-500 text-rose-600 bg-rose-500/10", glyph: "!" },
  due: { cls: "border-amber-500 text-amber-700 bg-amber-500/10", glyph: "•" },
  upcoming: { cls: "border-border text-muted-foreground", glyph: "" },
  cancelled: { cls: "border-dashed border-border text-muted-foreground/60", glyph: "–" },
};

const routeLabel = (r: string | null) => (r ? (ADMIN_ROUTE_LABELS[r as AdminRoute] ?? r) : null);
const doseLine = (x: { dose: string | null; route: string | null }) => [x.dose, routeLabel(x.route)?.toLowerCase()].filter(Boolean).join(", ");
const KindIcon = ({ kind, className }: { kind: OrderKind; className?: string }) => (kind === "medicine" ? <Pill className={className} /> : <Syringe className={className} />);
const refreshProcedures = () => {
  invalidateApi("/api/procedure-tasks");
  invalidateApi("/api/admissions");
};

// ---------------------------------------------------------------- marking a dose

function useTaskActions() {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState<{ task: ProcedureTaskView; kind: "missed" | "revert" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const act = useMutation({
    mutationFn: async ({ id, kind, body }: { id: string; kind: "done" | "missed" | "revert"; body: Record<string, unknown> }) =>
      (await (await apiRequest("POST", `/api/procedure-tasks/${id}/${kind}`, body)).json()) as ProcedureTaskView,
    onSuccess: (t, v) => {
      setPrompt(null);
      setError(null);
      refreshProcedures();
      invalidateApi("/api/inventory");
      const short = t.stock ? Math.max(0, t.stock.quantity - t.stock.posted) : 0;
      if (v.kind === "done" && short > 1e-6) {
        toast({ title: `Bajarildi: ${t.name}`, description: `Omborda yetmadi — kamomad ${fmtQty(short)} ${t.stock!.unit} omborchiga yozildi`, variant: "destructive" });
        return;
      }
      toast({
        title: v.kind === "done" ? `Bajarildi: ${t.name}` : v.kind === "missed" ? `Bajarilmadi deb belgilandi: ${t.name}` : "Belgi qaytarildi",
        description: v.kind === "done" && t.stock ? `Ombordan ${fmtQty(t.stock.posted)} ${t.stock.unit} chiqdi` : v.kind === "revert" ? "Dori omborga qaytarildi (bo'lsa)" : undefined,
      });
    },
    onError: (e: Error, v) => (v.kind === "done" ? toast({ title: "Belgilanmadi", description: e.message, variant: "destructive" }) : setError(e.message)),
  });
  const dialog = (
    <TextPromptDialog
      open={Boolean(prompt)}
      onOpenChange={(o) => {
        if (!o) {
          setPrompt(null);
          setError(null);
        }
      }}
      title={prompt?.kind === "missed" ? "Muolaja bajarilmadimi?" : "Belgi qaytarilsinmi?"}
      description={
        prompt
          ? `${prompt.task.patientName} — ${prompt.task.name}${prompt.task.dose ? ` ${prompt.task.dose}` : ""}, ${formatTime(prompt.task.plannedAt)}. ${
              prompt.kind === "missed" ? "Nega bajarilmagani yoziladi va shifokor ko'radi." : "Muolaja yana rejaga qaytadi; sabab tarixda qoladi."
            }`
          : undefined
      }
      label="Sabab"
      confirmLabel={prompt?.kind === "missed" ? "Bajarilmadi deb belgilash" : "Belgini qaytarish"}
      destructive={prompt?.kind === "missed"}
      pending={act.isPending}
      error={error}
      onConfirm={(reason) => prompt && act.mutate({ id: prompt.task.id, kind: prompt.kind, body: { reason } })}
      testId={prompt?.kind === "missed" ? "task-missed" : "task-revert"}
    />
  );
  return {
    done: (t: ProcedureTaskView) => act.mutate({ id: t.id, kind: "done", body: {} }),
    missed: (t: ProcedureTaskView) => setPrompt({ task: t, kind: "missed" }),
    revert: (t: ProcedureTaskView) => setPrompt({ task: t, kind: "revert" }),
    pendingId: act.isPending ? act.variables?.id : null,
    dialog,
  };
}

/** B6.6b: what a medicine dose took from the warehouse — or what it could not. */
function StockNote({ stock, taskId }: { stock: NonNullable<ProcedureTaskView["stock"]>; taskId: string }) {
  const short = Math.max(0, stock.quantity - stock.posted);
  return short > 1e-6 ? (
    <p className="text-xs font-medium text-amber-700 dark:text-amber-400" data-testid={`task-stock-${taskId}`}>
      Omborda yetmadi: {fmtQty(stock.posted)} {stock.unit} chiqdi, kamomad {fmtQty(short)} {stock.unit} — omborchiga
    </p>
  ) : (
    <p className="text-xs text-muted-foreground" data-testid={`task-stock-${taskId}`}>
      Ombordan: {fmtQty(stock.posted)} {stock.unit} ({stock.itemName})
    </p>
  );
}

/** The doses of a day — for everyone in hospital, or one stay. */
export function TaskList({ tasks, showPatient, now = new Date() }: { tasks: ProcedureTaskView[]; showPatient: boolean; now?: Date }) {
  const { can } = useAuth();
  const performs = can("procedures.perform");
  const actions = useTaskActions();
  if (tasks.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">Bu kunga muolaja rejalashtirilmagan.</p>;
  return (
    <>
      <ol className="space-y-2" data-testid="task-list">
        {tasks.map((t) => {
          const state = taskState(t, now);
          const markable = performs && !markDoneProblem(t, now);
          return (
            <li key={t.id} className={cn("flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center", state === "overdue" && "border-rose-500/40")} data-testid={`task-${t.id}`}>
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="w-14 shrink-0 text-center">
                  <p className="text-base font-semibold tabular">{formatTime(t.plannedAt)}</p>
                  <Badge variant="outline" className={cn("mt-1 px-1.5 text-[10px] font-medium", STATE_TONE[state])} data-testid={`task-state-${t.id}`}>
                    {TASK_STATE_LABELS[state]}
                  </Badge>
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p className="flex items-center gap-1.5 font-medium">
                    <KindIcon kind={t.kind} className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate">{t.name}</span>
                    {doseLine(t) && <span className="shrink-0 font-normal text-muted-foreground">· {doseLine(t)}</span>}
                  </p>
                  {showPatient && (
                    <p className="text-sm">
                      <Link href={`/inpatient/stays/${t.admissionId}`} className="font-medium hover:underline">
                        {t.patientName}
                      </Link>
                      <span className="text-muted-foreground">{t.wardName ? ` · palata ${t.wardName}, yotoq ${t.bedLabel}` : ""}</span>
                    </p>
                  )}
                  {t.orderNote && <p className="text-xs text-muted-foreground">{t.orderNote}</p>}
                  {(t.status === "done" || t.status === "missed") && (
                    <p className="text-xs text-muted-foreground" data-testid={`task-mark-${t.id}`}>
                      {t.status === "done" ? "Bajardi" : "Bajarilmadi"}: {t.doneByName ?? "—"}, {t.doneAt ? formatTime(t.doneAt) : ""}
                      {t.note ? ` — ${t.note}` : ""}
                    </p>
                  )}
                  {t.status === "planned" && t.revertReason && <p className="text-xs text-amber-700 dark:text-amber-400">Belgi qaytarilgan: {t.revertReason}</p>}
                  {t.stock && <StockNote stock={t.stock} taskId={t.id} />}
                </div>
              </div>
              {performs && (
                <div className="flex shrink-0 gap-2 sm:justify-end">
                  {t.status === "planned" ? (
                    <>
                      <Button size="sm" onClick={() => actions.done(t)} disabled={!markable || actions.pendingId === t.id} title={markable ? undefined : "Vaqtidan ko'pi bilan 2 soat oldin belgilanadi"} data-testid={`button-task-done-${t.id}`}>
                        {actions.pendingId === t.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
                        Bajarildi
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => actions.missed(t)} disabled={!markable} data-testid={`button-task-missed-${t.id}`}>
                        <X className="mr-1.5 h-4 w-4" />
                        Bajarilmadi
                      </Button>
                    </>
                  ) : t.status !== "cancelled" ? (
                    <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => actions.revert(t)} data-testid={`button-task-revert-${t.id}`}>
                      <RotateCcw className="mr-1.5 h-4 w-4" />
                      Qaytarish
                    </Button>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {actions.dialog}
    </>
  );
}

/** Statsionar → "Muolajalar": the nurse's day. */
export function ProceduresTab() {
  const today = dayKey(new Date());
  const [day, setDay] = useState(today);
  const { data: tasks = [], isLoading } = useQuery<ProcedureTaskView[]>({ queryKey: [`/api/procedure-tasks?day=${day}`], refetchOnMount: "always", refetchInterval: liveInterval(60_000) });
  const now = new Date();
  const counts = useMemo(() => {
    const c = { total: 0, done: 0, overdue: 0, left: 0 };
    for (const t of tasks) {
      const s = taskState(t, now);
      if (s === "cancelled") continue;
      c.total++;
      if (s === "done") c.done++;
      else if (s === "overdue") c.overdue++;
      else if (s !== "missed") c.left++;
    }
    return c;
  }, [tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6" data-testid="procedures-tab">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setDay(addDays(day, -1))} aria-label="Oldingi kun" data-testid="button-task-prev">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} className="w-auto" aria-label="Kun" data-testid="input-task-day" />
        <Button variant="outline" size="icon" onClick={() => setDay(addDays(day, 1))} aria-label="Keyingi kun" data-testid="button-task-next">
          <ChevronRight className="h-4 w-4" />
        </Button>
        {day !== today && (
          <Button variant="ghost" size="sm" onClick={() => setDay(today)}>
            Bugun
          </Button>
        )}
        <span className="text-sm text-muted-foreground">{formatDayLong(day)}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <StatCard index={0} label="Jami muolajalar" value={counts.total} icon={Clock} isLoading={isLoading} />
        <StatCard index={1} label="Bajarildi" value={counts.done} hint={counts.total ? `${Math.round((counts.done / counts.total) * 100)}%` : undefined} icon={Check} tone="emerald" isLoading={isLoading} />
        <StatCard index={2} label="Kechikmoqda" value={counts.overdue} hint="Vaqtidan 1 soatdan ko'p o'tgan" icon={Clock} tone={counts.overdue ? "rose" : "primary"} isLoading={isLoading} />
        <StatCard index={3} label="Qoldi" value={counts.left} icon={Square} tone="amber" isLoading={isLoading} />
      </div>
      <SectionCard title="Muolajalar ro'yxati" description="Kechikkanlari birinchi, keyin vaqti bo'yicha; belgilanganlari oxirida">
        {isLoading ? <div className="h-40 skeleton-shimmer rounded-lg" /> : <TaskList tasks={tasks} showPatient now={now} />}
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------- the doctor's orders

/** Case history → "Tayinlovlar va muolajalar": the stay's orders, each with its schedule grid, and today's doses. */
export function OrdersSection({ admissionId, active }: { admissionId: string; active: boolean }) {
  const { can } = useAuth();
  const { toast } = useToast();
  const prescribes = can("procedures.prescribe") && active;
  const today = dayKey(new Date());
  const { data: orders = [], isLoading } = useQuery<InpatientOrderView[]>({ queryKey: [`/api/admissions/${admissionId}/orders`], refetchOnMount: "always" });
  const { data: todayTasks = [] } = useQuery<ProcedureTaskView[]>({ queryKey: [`/api/procedure-tasks?day=${today}&admissionId=${admissionId}`], refetchOnMount: "always", enabled: active });
  const [ordering, setOrdering] = useState(false);
  const [stopping, setStopping] = useState<InpatientOrderView | null>(null);
  const [stopError, setStopError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const stop = useMutation({
    mutationFn: async (reason: string) => (await apiRequest("POST", `/api/inpatient-orders/${stopping!.id}/stop`, { reason })).json(),
    onSuccess: () => {
      setStopping(null);
      setStopError(null);
      refreshProcedures();
      toast({ title: "Tayinlov to'xtatildi" });
    },
    onError: (e: Error) => setStopError(e.message),
  });

  const sorted = [...orders].sort((a, b) => (a.status === b.status ? 0 : a.status === "active" ? -1 : 1));
  return (
    <SectionCard
      icon={Pill}
      title="Tayinlovlar va muolajalar"
      description="Dori va muolajalar jadvali; hamshira har birini belgilaydi"
      action={
        prescribes ? (
          <Button size="sm" onClick={() => setOrdering(true)} data-testid="button-new-order">
            <Plus className="mr-1.5 h-4 w-4" />
            Tayinlash
          </Button>
        ) : undefined
      }
    >
      {active && todayTasks.length > 0 && (
        <div className="mb-5" data-testid="case-today-tasks">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bugun</p>
          <TaskList tasks={todayTasks} showPatient={false} />
        </div>
      )}
      {isLoading ? (
        <div className="h-24 skeleton-shimmer rounded-lg" />
      ) : sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tayinlov yo'q.</p>
      ) : (
        <ul className="space-y-3" data-testid="order-list">
          {sorted.map((o) => {
            const p = orderProgress(o.tasks);
            const last = addDays(o.startOn, o.days - 1);
            const expanded = open === o.id;
            return (
              <li key={o.id} className={cn("rounded-xl border", o.status === "stopped" && "bg-muted/30")} data-testid={`order-${o.id}`}>
                <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start">
                  <button type="button" className="flex min-w-0 flex-1 items-start gap-3 text-left" onClick={() => setOpen(expanded ? null : o.id)} aria-expanded={expanded} data-testid={`button-order-toggle-${o.id}`}>
                    <div className="icon-tile mt-0.5 h-9 w-9 shrink-0 bg-primary/10 text-primary">
                      <KindIcon kind={o.kind} className="h-[18px] w-[18px]" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-medium">
                        {o.name}
                        {doseLine(o) && <span className="font-normal text-muted-foreground"> · {doseLine(o)}</span>}
                      </p>
                      <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {o.times.map((t) => (
                          <Badge key={t} variant="outline" className="px-1.5 font-medium tabular">
                            {t}
                          </Badge>
                        ))}
                        <span>
                          {formatDay(o.startOn)} – {formatDay(last)} ({o.days} kun) · {o.prescribedByName ?? "—"}
                        </span>
                      </p>
                      {o.note && <p className="text-xs">{o.note}</p>}
                      <div className="max-w-sm pt-1">
                        <MeterBar
                          value={p.done}
                          max={Math.max(1, p.total)}
                          label={
                            <>
                              <span>
                                Bajarildi {p.done}/{p.total}
                                {p.missed ? ` · bajarilmadi ${p.missed}` : ""}
                              </span>
                              {p.overdue > 0 && <span className="font-medium text-rose-600">kechikmoqda {p.overdue}</span>}
                            </>
                          }
                        />
                      </div>
                      {o.status === "stopped" && (
                        <p className="text-xs text-destructive">
                          To'xtatilgan: {o.stopReason} — {o.stoppedByName ?? "—"}, {o.stoppedAt ? formatDateTime(o.stoppedAt) : ""}
                        </p>
                      )}
                    </div>
                    <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
                  </button>
                  {prescribes && o.status === "active" && (
                    <Button size="sm" variant="ghost" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setStopping(o)} data-testid={`button-stop-order-${o.id}`}>
                      To'xtatish
                    </Button>
                  )}
                </div>
                {expanded && <ScheduleGrid order={o} />}
              </li>
            );
          })}
        </ul>
      )}
      {ordering && <OrderDialog admissionId={admissionId} onClose={() => setOrdering(false)} />}
      <TextPromptDialog
        open={Boolean(stopping)}
        onOpenChange={(o) => !o && setStopping(null)}
        title="Tayinlov to'xtatilsinmi?"
        description={stopping ? `${stopping.name}: hali vaqti kelmagan muolajalar bekor qilinadi; kechikkanlari hamshira belgilashi uchun qoladi.` : undefined}
        label="Sabab"
        confirmLabel="Tayinlovni to'xtatish"
        destructive
        pending={stop.isPending}
        error={stopError}
        onConfirm={(r) => stop.mutate(r)}
        testId="order-stop"
      />
    </SectionCard>
  );
}

/** Days down, times across; each dose a cell by its state (glyph and colour). */
function ScheduleGrid({ order }: { order: InpatientOrderView }) {
  const now = new Date();
  const byDay = new Map<string, InpatientOrderView["tasks"]>();
  for (const t of order.tasks) {
    const d = dayKey(new Date(t.plannedAt));
    byDay.set(d, [...(byDay.get(d) ?? []), t]);
  }
  const times = order.times;
  return (
    <div className="overflow-x-auto border-t px-3 pb-3 pt-2" data-testid={`schedule-${order.id}`}>
      <table className="text-xs">
        <thead>
          <tr>
            <th className="pr-3 text-left font-medium text-muted-foreground">Kun</th>
            {times.map((t) => (
              <th key={t} className="px-1 font-medium tabular text-muted-foreground">
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...byDay.entries()].map(([d, tasks]) => (
            <tr key={d}>
              <td className="whitespace-nowrap py-0.5 pr-3 tabular">{formatDay(d)}</td>
              {times.map((time) => {
                const t = tasks.find((x) => formatTime(x.plannedAt) === time);
                if (!t) return <td key={time} className="px-1" />;
                const s = taskState(t, now);
                return (
                  <td key={time} className="px-1 py-0.5">
                    <span
                      className={cn("flex h-6 w-6 items-center justify-center rounded border text-[11px] font-bold", CELL[s].cls)}
                      title={`${formatDay(d)} ${time}: ${TASK_STATE_LABELS[s]}${t.doneByName ? ` — ${t.doneByName}` : ""}${t.note ? ` (${t.note})` : ""}`}
                    >
                      {CELL[s].glyph}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-muted-foreground">✓ bajarildi · ✕ bajarilmadi · ! kechikmoqda · • vaqti keldi · – bekor qilingan</p>
    </div>
  );
}

const NO_ROUTE = "none";

function OrderDialog({ admissionId, onClose }: { admissionId: string; onClose: () => void }) {
  const { toast } = useToast();
  const today = dayKey(new Date());
  const { data: catalog } = useQuery<PrescriptionCatalog>({ queryKey: ["/api/prescription-catalog"] });
  const [kind, setKind] = useState<OrderKind>("medicine");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<{ id: string; name: string; unit?: string; salePrice?: number | null } | null>(null);
  const [issueQty, setIssueQty] = useState("1");
  const [dose, setDose] = useState("");
  const [route, setRoute] = useState<AdminRoute | null>(null);
  const [times, setTimes] = useState<string[]>(["08:00", "20:00"]);
  const [newTime, setNewTime] = useState("");
  const [startOn, setStartOn] = useState(today);
  const [days, setDays] = useState("5");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const name = picked?.name ?? query.trim();
  const stocked = kind === "medicine" && Boolean(picked);
  const qty = Number(issueQty.replace(",", "."));
  const dosePrice = stocked && picked?.salePrice != null && qty > 0 ? Math.round(picked.salePrice * qty) : null;
  const options = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("uz");
    const list =
      kind === "medicine"
        ? (catalog?.medicines ?? []).map((m) => ({ id: m.id, name: m.name, hint: m.inStock ? "omborda bor" : "omborda yo'q", unit: m.unit, salePrice: m.salePrice }))
        : (catalog?.procedures ?? []).map((s) => ({ id: s.id, name: s.name, hint: money(s.price), unit: undefined, salePrice: undefined }));
    return (q ? list.filter((x) => x.name.toLocaleLowerCase("uz").includes(q)) : list).slice(0, 8);
  }, [catalog, kind, query]);
  const plan = { kind, name, dose: dose.trim() || null, route, times: normalizeTimes(times), startOn, days: Number(days) };
  const slots = useMemo(
    () => (plan.times.length && plan.days >= 1 && plan.days <= MAX_ORDER_DAYS ? planSlots(plan, new Date(), (d, t) => new Date(`${d}T${t}:00`)) : []),
    [plan.times.join(), plan.days, plan.startOn], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const save = useMutation({
    mutationFn: async () =>
      (await (
        await apiRequest("POST", `/api/admissions/${admissionId}/orders`, {
          ...plan,
          itemId: kind === "medicine" ? (picked?.id ?? null) : null,
          serviceId: kind === "procedure" ? (picked?.id ?? null) : null,
          // B6.6b: a stocked medicine says how much of it one dose takes from the shelf.
          issueQty: stocked ? Number(issueQty.replace(",", ".")) : null,
          note: note.trim() || null,
        })
      ).json()) as InpatientOrderView,
    onSuccess: (o) => {
      refreshProcedures();
      toast({ title: `Tayinlandi: ${o.name}`, description: `${o.tasks.length} ta muolaja jadvalga qo'shildi` });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });
  const submit = () => {
    const problem =
      orderProblem(plan, today, "0000-00-00") ??
      (stocked && !(qty > 0) ? "Bir dozaga ombordan qancha ketishini kiriting" : null) ??
      (slots.length === 0 ? "Tanlangan kunlarda vaqtlar o'tib ketgan" : null);
    if (problem) return setError(problem);
    setError(null);
    save.mutate();
  };
  const addTime = () => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(newTime)) return;
    setTimes((xs) => (xs.includes(newTime) || xs.length >= MAX_TIMES_PER_DAY ? xs : normalizeTimes([...xs, newTime])));
    setNewTime("");
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-xl flex-col">
        <DialogHeader>
          <DialogTitle>Tayinlash</DialogTitle>
          <DialogDescription>Jadval darhol tuziladi: har kun va har vaqt uchun alohida muolaja.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-4 overflow-y-auto px-1" data-testid="order-form">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Turi">
            {(["medicine", "procedure"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => {
                  setKind(k);
                  setPicked(null);
                  setQuery("");
                }}
                className={cn("flex items-center justify-center gap-2 rounded-lg border p-2.5 text-sm font-medium", kind === k ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted/60")}
                data-testid={`order-kind-${k}`}
              >
                <KindIcon kind={k} className="h-4 w-4" />
                {ORDER_KIND_LABELS[k]}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="order-name">{kind === "medicine" ? "Dori vositasi" : "Muolaja"}</Label>
            {picked ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span className="font-medium">{picked.name}</span>
                <Button variant="ghost" size="sm" className="h-7" onClick={() => setPicked(null)}>
                  O'zgartirish
                </Button>
              </div>
            ) : (
              <>
                <Input id="order-name" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={kind === "medicine" ? "Katalogdan qidiring yoki nomini yozing" : "Muolajani qidiring yoki yozing"} autoComplete="off" data-testid="input-order-name" />
                {options.length > 0 && (
                  <ul className="max-h-44 overflow-y-auto rounded-md border" data-testid="order-options">
                    {options.map((x) => (
                      <li key={x.id}>
                        <button type="button" className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted/60" onClick={() => setPicked({ id: x.id, name: x.name, unit: x.unit, salePrice: x.salePrice })}>
                          <span>{x.name}</span>
                          <span className="text-xs text-muted-foreground">{x.hint}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {query.trim() && <p className="text-xs text-muted-foreground">Katalogda bo'lmasa, yozilgan nom bilan saqlanadi.</p>}
              </>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="order-dose">Doza{kind === "procedure" ? " (ixtiyoriy)" : ""}</Label>
              <Input id="order-dose" value={dose} onChange={(e) => setDose(e.target.value)} placeholder={kind === "medicine" ? "1 g, 500 mg, 1 tabletka" : "10 daqiqa"} data-testid="input-order-dose" />
            </div>
            <div className="space-y-1.5">
              <Label>Yuborish yo'li</Label>
              <Select value={route ?? NO_ROUTE} onValueChange={(v) => setRoute(v === NO_ROUTE ? null : (v as AdminRoute))}>
                <SelectTrigger data-testid="select-order-route">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ROUTE}>Ko'rsatilmagan</SelectItem>
                  {ADMIN_ROUTES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ADMIN_ROUTE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {stocked && (
            <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2" data-testid="order-stock">
              <div className="space-y-1.5">
                <Label htmlFor="order-issue">Bir dozaga ombordan{picked?.unit ? `, ${picked.unit}` : ""}</Label>
                <Input id="order-issue" inputMode="decimal" value={issueQty} onChange={(e) => setIssueQty(e.target.value)} data-testid="input-order-issue" />
              </div>
              <p className="self-end text-xs text-muted-foreground">
                Hamshira bajarganda ombordan muddati yaqin partiyadan chiqadi; yetmasa omborchiga kamomad bo'lib tushadi.
                {dosePrice !== null ? ` Bir doza hisobga: ${money(dosePrice)}.` : " Sotuv narxi belgilanmagan — hisobga kirmaydi."}
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Vaqtlari</Label>
            <div className="flex flex-wrap gap-1.5">
              {TIME_PRESETS.map((p) => (
                <Button key={p.label} type="button" size="sm" variant={p.times.join() === times.join() ? "default" : "outline"} className="h-7" onClick={() => setTimes(p.times)} data-testid={`order-preset-${p.times.length}`}>
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pt-1" data-testid="order-times">
              {times.map((t) => (
                <Badge key={t} variant="outline" className="gap-1 pr-1 font-medium tabular">
                  {t}
                  <button type="button" className="rounded p-0.5 hover:bg-muted" onClick={() => setTimes((xs) => xs.filter((x) => x !== t))} aria-label={`${t} ni olib tashlash`}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="h-8 w-28" aria-label="Yangi vaqt" data-testid="input-order-time" />
              <Button type="button" size="sm" variant="ghost" className="h-8" onClick={addTime} disabled={!newTime}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Qo'shish
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="order-start">Boshlanishi</Label>
              <Input id="order-start" type="date" value={startOn} min={today} onChange={(e) => setStartOn(e.target.value)} data-testid="input-order-start" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="order-days">Necha kun</Label>
              <Input id="order-days" type="number" min={1} max={MAX_ORDER_DAYS} value={days} onChange={(e) => setDays(e.target.value)} data-testid="input-order-days" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="order-note">Izoh (hamshiraga)</Label>
            <Textarea id="order-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder="Ovqatdan keyin; 200 ml fiziologik eritmada; sekin…" data-testid="input-order-note" />
          </div>
          <p className="rounded-lg bg-muted/50 p-3 text-sm" data-testid="order-preview">
            {slots.length > 0 ? (
              <>
                Jadvalda <span className="font-semibold tabular">{slots.length}</span> ta muolaja; birinchisi {formatDateTime(slots[0].toISOString())}, oxirgisi {formatDateTime(slots[slots.length - 1].toISOString())}.
              </>
            ) : (
              "Vaqt va kunlarni belgilang."
            )}
          </p>
          {error && (
            <p className="text-sm text-destructive" data-testid="order-error">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Yopish
          </Button>
          <Button onClick={submit} disabled={save.isPending} data-testid="button-save-order">
            {save.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Tayinlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
