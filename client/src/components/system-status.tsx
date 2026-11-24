/**
 * Tizim holati (B8.4, TZ §14): is the system well — database, backup, the
 * last 24 hours' load and failures, the slow routes, the error groups.
 * Rules: shared/monitoring.ts.
 */
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle2, Database, Gauge, ShieldCheck, Timer } from "lucide-react";
import { ERROR_SOURCE_LABELS, SLOW_P95_MS, type ErrorGroupView, type SystemStatus } from "@shared/monitoring";
import { BACKUP_HEALTH_LABELS, type BackupHealth } from "@shared/backup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionCard, StatCard } from "@/components/ui-kit";
import { apiRequest, invalidateApi } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDateTime, formatTime } from "@/lib/format";

const uptime = (s: number) => (s >= 86_400 ? `${Math.floor(s / 86_400)} kun` : s >= 3600 ? `${Math.floor(s / 3600)} soat` : `${Math.max(1, Math.floor(s / 60))} daqiqa`);

export function SystemStatusPanel() {
  const { toast } = useToast();
  const { data: s, isLoading } = useQuery<SystemStatus>({ queryKey: ["/api/system/status"], refetchOnMount: "always", refetchInterval: 60_000 });
  const [showResolved, setShowResolved] = useState(false);
  const resolve = useMutation({
    mutationFn: async (id: string) => (await apiRequest("POST", `/api/system/errors/${id}/resolve`)).json(),
    onSuccess: () => {
      invalidateApi("/api/system/status");
      toast({ title: "Hal qilindi deb belgilandi", description: "Xato qaytsa, ro'yxatga yana chiqadi." });
    },
  });
  const errors = (s?.errors ?? []).filter((e) => showResolved || !e.resolvedAt);
  const backupTone = (h: string) => (h === "ok" ? "emerald" : "amber");

  return (
    <div className="space-y-6" data-testid="system-status">
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <StatCard
          index={0}
          label="Ma'lumotlar bazasi"
          value={s ? (s.database.ok ? "Ishlayapti" : "Aloqa yo'q") : "—"}
          hint={s ? (s.database.ok ? `${s.storage === "postgres" ? "Postgres" : "Mahalliy JSON"} · javob ${s.database.latencyMs} ms` : s.database.error ?? "") : undefined}
          icon={Database}
          tone={s && !s.database.ok ? "rose" : "emerald"}
          isLoading={isLoading}
        />
        <StatCard
          index={1}
          label="Zaxira"
          value={s?.backup ? BACKUP_HEALTH_LABELS[s.backup.health as BackupHealth] : s ? "Mahalliy rejim" : "—"}
          hint={s?.backup?.hoursSince !== null && s?.backup ? `Oxirgisi ${s.backup.hoursSince} soat oldin` : "Sozlamalar → Xavfsizlik"}
          icon={ShieldCheck}
          tone={s?.backup ? backupTone(s.backup.health) : "primary"}
          isLoading={isLoading}
        />
        <StatCard
          index={2}
          label="So'rovlar (24 soat)"
          value={s?.last24h.requests ?? 0}
          hint={s ? `O'rtacha ${s.last24h.avgMs} ms · ${s.last24h.slowRoutes} ta sekin yo'l` : undefined}
          icon={Gauge}
          tone={s && s.last24h.slowRoutes ? "amber" : "violet"}
          isLoading={isLoading}
        />
        <StatCard
          index={3}
          label="Server xatolari (24 soat)"
          value={s?.last24h.errors ?? 0}
          hint={s ? `${s.last24h.errorRate}% so'rovlardan · ochiq guruhlar (server + brauzer): ${s.openErrors}` : undefined}
          icon={AlertTriangle}
          tone={s && (s.last24h.errors || s.openErrors) ? "rose" : "emerald"}
          isLoading={isLoading}
        />
      </div>

      {s && (
        <SectionCard icon={Activity} title="So'nggi 24 soat" description={`Soatlik so'rovlar (ustun) va xatolar (qizil) · versiya ${s.version} · ishlab turibdi ${uptime(s.uptimeSeconds)}`}>
          <HoursChart hours={s.hours} />
        </SectionCard>
      )}

      <SectionCard
        icon={AlertTriangle}
        title="Xatolar jurnali"
        description="Kutilmagan xatolar guruhlab — qayerda, nima, necha marta. Bemor ma'lumoti yozilmaydi"
        action={
          <Button variant="ghost" size="sm" onClick={() => setShowResolved((x) => !x)} data-testid="button-show-resolved">
            {showResolved ? "Faqat ochiqlari" : "Hal qilinganlar ham"}
          </Button>
        }
      >
        {errors.length === 0 ? (
          <p className="flex items-center gap-2 py-6 text-sm text-emerald-700 dark:text-emerald-400" data-testid="errors-empty">
            <CheckCircle2 className="h-4 w-4" /> Ochiq xato yo'q.
          </p>
        ) : (
          <ul className="space-y-2" data-testid="error-groups">
            {errors.map((e) => (
              <ErrorRow key={e.id} e={e} onResolve={() => resolve.mutate(e.id)} pending={resolve.isPending && resolve.variables === e.id} />
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard icon={Timer} title="Javob vaqti" description={`24 soat, yo'llar bo'yicha; p95 ${SLOW_P95_MS} ms dan oshsa — sekin`} flush>
        {!s || s.routes.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Hali ma'lumot yo'q.</p>
        ) : (
          <div className="overflow-x-auto" data-testid="route-stats">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Yo'l</th>
                  <th className="px-3 py-2 text-right">So'rov</th>
                  <th className="px-3 py-2 text-right">O'rtacha</th>
                  <th className="px-3 py-2 text-right">p95</th>
                  <th className="hidden px-3 py-2 text-right sm:table-cell">Eng uzoq</th>
                  <th className="hidden px-3 py-2 text-right sm:table-cell">Xato</th>
                </tr>
              </thead>
              <tbody>
                {s.routes.map((r) => (
                  <tr key={`${r.method} ${r.route}`} className="border-t">
                    <td className="max-w-[320px] px-4 py-2">
                      <span className="mr-1.5 font-mono text-[10px] text-muted-foreground">{r.method}</span>
                      <span className="break-all font-mono text-xs">{r.route}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular">{r.count}</td>
                    <td className="px-3 py-2 text-right tabular">{r.avgMs} ms</td>
                    <td className={cn("px-3 py-2 text-right tabular", r.slow && "font-semibold text-amber-700 dark:text-amber-300")}>{r.p95Ms === null ? "—" : `≤${r.p95Ms} ms`}</td>
                    <td className="hidden px-3 py-2 text-right tabular sm:table-cell">{r.maxMs} ms</td>
                    <td className={cn("hidden px-3 py-2 text-right tabular sm:table-cell", r.errors && "text-rose-700 dark:text-rose-300")}>{r.errors ? `${r.errors} (${r.errorRate}%)` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
      <p className="text-xs text-muted-foreground">
        Yo'llar ID'larsiz yoziladi (":id"), xabardagi raqamlar va telefonlar yashiriladi, so'rov tanasi o'qilmaydi. Ma'lumotlar 30 kun saqlanadi. Tashqi kuzatuv xizmati uchun: <code className="rounded bg-muted px-1">GET /api/health</code>.
      </p>
    </div>
  );
}

function ErrorRow({ e, onResolve, pending }: { e: ErrorGroupView; onResolve: () => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={cn("rounded-lg border p-3", e.resolvedAt && "opacity-60")} data-testid={`error-group-${e.id}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <button type="button" className="min-w-0 text-left" onClick={() => setOpen((x) => !x)} aria-expanded={open}>
          <p className="flex flex-wrap items-center gap-1.5 text-sm">
            <Badge variant="outline" className={cn("text-[10px]", e.source === "server" ? "border-rose-500/30 text-rose-700 dark:text-rose-300" : "border-violet-500/30 text-violet-700 dark:text-violet-300")}>
              {ERROR_SOURCE_LABELS[e.source]}
            </Badge>
            <span className="break-all font-mono text-xs">{e.where}</span>
            {e.lastStatus && <span className="text-xs text-muted-foreground">· {e.lastStatus}</span>}
          </p>
          <p className="mt-1 break-words text-sm font-medium">
            {e.name}: {e.message}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {e.count} marta · birinchi {formatDateTime(e.firstSeen)} · oxirgi {formatDateTime(e.lastSeen)}
            {e.lastRole ? ` · rol: ${e.lastRole}` : ""}
            {e.resolvedAt ? ` · hal qilindi ${formatDateTime(e.resolvedAt)} (${e.resolvedByName ?? "—"})` : ""}
          </p>
        </button>
        {!e.resolvedAt && (
          <Button size="sm" variant="outline" className="shrink-0" onClick={onResolve} disabled={pending} data-testid={`button-resolve-${e.id}`}>
            Hal qilindi
          </Button>
        )}
      </div>
      {open && e.stack && <pre className="mt-2 overflow-x-auto rounded bg-muted/60 p-2 text-[11px] leading-snug">{e.stack}</pre>}
    </li>
  );
}

/** Requests per hour as bars, failures as a red cap on the same count axis. */
function HoursChart({ hours }: { hours: SystemStatus["hours"] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...hours.map((h) => h.count));
  const cur = active !== null ? hours[active] : null;
  return (
    <div data-testid="hours-chart">
      <p className="mb-2 h-4 text-xs tabular text-muted-foreground">
        {cur ? `${formatTime(cur.hour)}: ${cur.count} so'rov, ${cur.errors} xato, o'rtacha ${cur.avgMs} ms` : "Soat ustiga olib boring"}
      </p>
      <div className="flex h-32 items-end gap-[3px]" onMouseLeave={() => setActive(null)}>
        {hours.map((h, i) => (
          <div key={h.hour} className="flex h-full flex-1 flex-col justify-end" onMouseEnter={() => setActive(i)} title={`${formatTime(h.hour)}: ${h.count} so'rov, ${h.errors} xato`}>
            {h.errors > 0 && <div className="w-full rounded-t-sm bg-rose-500" style={{ height: `${Math.max(3, (h.errors / max) * 100)}%` }} />}
            <div className={cn("w-full bg-primary/80", h.errors ? "" : "rounded-t-sm", active === i && "bg-primary")} style={{ height: `${h.count ? Math.max(2, ((h.count - h.errors) / max) * 100) : 0}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] tabular text-muted-foreground">
        <span>{formatTime(hours[0]?.hour)}</span>
        <span>{formatTime(hours[hours.length - 1]?.hour)}</span>
      </div>
    </div>
  );
}
