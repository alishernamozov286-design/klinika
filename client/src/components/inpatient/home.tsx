/**
 * Statsionar bosh sahifasi (B6.3, TZ §8.1.1): patients in hospital, free and
 * occupied beds, admitted today, leaving by tomorrow — and the bed map: every
 * ward at a glance. A bed's state is drawn by colour and by its outline (solid
 * fill, outline, dashed, striped), never colour alone. Rules: shared/inpatient.ts.
 */
import { useQuery } from "@tanstack/react-query";
import { BedDouble, CalendarCheck, CheckCircle2, LogIn, LogOut, UserRound, Wrench } from "lucide-react";
import type { AdmissionView, WardView } from "@shared/schema";
import { BED_DISPLAY_LABELS, DISCHARGE_DUE_LABELS, WARD_GENDER_LABELS, stayDay, type BedDisplay, type DischargeDue, type InpatientOverview } from "@shared/inpatient";
import { Badge } from "@/components/ui/badge";
import { MeterBar, SectionCard, StatCard } from "@/components/ui-kit";
import { cn } from "@/lib/utils";
import { dayKey, formatDate, formatDateTime } from "@/lib/format";
import { liveInterval } from "@/lib/live-updates";

type Overview = InpatientOverview<AdmissionView>;

/** Colour plus a second, shape-like cue per state. */
const MAP_STYLE: Record<BedDisplay, string> = {
  ready: "border-2 border-emerald-500/70 bg-transparent text-emerald-800 dark:text-emerald-300",
  occupied: "border-2 border-sky-600 bg-sky-500 text-white dark:bg-sky-500/80",
  cleaning: "border-2 border-dashed border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  maintenance:
    "border-2 border-rose-500/70 text-rose-800 dark:text-rose-300 [background-image:repeating-linear-gradient(135deg,rgba(244,63,94,.22)_0_4px,transparent_4px_8px)]",
};
const DUE_TONE: Record<DischargeDue, string> = {
  overdue: "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300",
  today: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  tomorrow: "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300",
  later: "border-border text-muted-foreground",
};

export function InpatientHome({ onOpenStay, onBed, onTab }: { onOpenStay: (id: string) => void; onBed: (bedId: string, ward: WardView) => void; onTab: (t: "patients" | "beds") => void }) {
  const { data: o, isLoading } = useQuery<Overview>({ queryKey: ["/api/inpatient/overview"], refetchOnMount: "always", refetchInterval: liveInterval(30_000) });
  const { data: wards = [] } = useQuery<WardView[]>({ queryKey: ["/api/wards"], refetchOnMount: "always", refetchInterval: liveInterval(30_000) });
  const live = wards.filter((w) => w.isActive);
  const departments = [...new Map(live.map((w) => [w.departmentId, w.departmentName])).entries()];
  const today = dayKey(new Date());
  const leaving = o ? o.discharging.length : 0;

  return (
    <div className="space-y-6" data-testid="inpatient-home">
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard index={0} label="Jami bemorlar" value={o?.patients ?? 0} hint="Hozir statsionarda" icon={UserRound} tone="violet" isLoading={isLoading} onClick={() => onTab("patients")} />
        <StatCard index={1} label="Bo'sh o'rinlar" value={o?.counts.free ?? 0} hint={o ? `${o.counts.total} ta yotoqdan` : undefined} icon={CheckCircle2} tone="emerald" isLoading={isLoading} onClick={() => onTab("beds")} />
        <StatCard index={2} label="Band o'rinlar" value={o?.counts.occupied ?? 0} hint={o?.occupancy !== null && o ? `Bandlik ${o.occupancy}%` : "Yotoq yo'q"} icon={BedDouble} isLoading={isLoading} onClick={() => onTab("beds")} />
        <StatCard index={3} label="Yangi yotqizilganlar" value={o?.admittedToday.length ?? 0} hint="Bugun" icon={LogIn} tone="primary" isLoading={isLoading} />
        <StatCard
          index={4}
          label="Chiqarilayotganlar"
          value={leaving}
          hint={o ? `Bugun va ertaga${o.dischargedToday ? ` · bugun chiqarilgan ${o.dischargedToday}` : ""}` : undefined}
          icon={LogOut}
          tone={o?.discharging.some((d) => d.due === "overdue") ? "rose" : "amber"}
          isLoading={isLoading}
        />
      </div>

      <SectionCard title="Yotoqlar xaritasi" description="Barcha palatalar bir qarashda — band yotoq statsionar kartani, bo'sh yotoq yotqizishni ochadi">
        <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs" aria-label="Belgilar" data-testid="bed-map-legend">
          {(["ready", "occupied", "cleaning", "maintenance"] as const).map((d) => (
            <li key={d} className="flex items-center gap-1.5">
              <span className={cn("inline-block h-3.5 w-3.5 rounded", MAP_STYLE[d])} />
              {BED_DISPLAY_LABELS[d]}{" "}
              {o && <span className="tabular text-muted-foreground">({d === "ready" ? o.counts.free : o.counts[d]})</span>}
            </li>
          ))}
        </ul>
        {live.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Palata yo'q — “Palata va yotoqlar” tabida qo'shing.</p>
        ) : (
          <div className="space-y-5" data-testid="bed-map">
            {departments.map(([id, name]) => (
              <div key={id}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{name}</p>
                <div className="space-y-1.5">
                  {live
                    .filter((w) => w.departmentId === id)
                    .map((w) => (
                      <div key={w.id} className="flex items-center gap-3">
                        <span className="w-24 shrink-0 text-sm">
                          <span className="font-medium">{w.name}</span>
                          <span className="ml-1 text-[10px] text-muted-foreground">{WARD_GENDER_LABELS[w.gender].slice(0, 1)}</span>
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {w.beds
                            .filter((b) => b.isActive)
                            .map((b) => {
                              const tip = b.occupant ? `${b.occupant.patientName} · karta №${b.occupant.number}` : `${BED_DISPLAY_LABELS[b.display]}${b.stateNote ? ` — ${b.stateNote}` : ""}`;
                              return (
                                <button
                                  key={b.id}
                                  type="button"
                                  title={`Palata ${w.name}, yotoq ${b.label}: ${tip}`}
                                  aria-label={`Palata ${w.name}, yotoq ${b.label}: ${tip}`}
                                  onClick={() => (b.occupant ? onOpenStay(b.occupant.admissionId) : onBed(b.id, w))}
                                  className={cn("flex h-9 w-9 items-center justify-center rounded-md text-xs font-semibold tabular transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", MAP_STYLE[b.display])}
                                  data-testid={`map-bed-${w.name}-${b.label}`}
                                >
                                  {b.label}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="Chiqarilayotganlar" description="Rejalashtirilgan chiqarish: muddati o'tgan, bugun, ertaga">
          {!o || o.discharging.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Bugun va ertaga chiqarish rejalashtirilmagan.</p>
          ) : (
            <ul className="-m-1 space-y-1" data-testid="home-discharging">
              {o.discharging.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => onOpenStay(a.id)} className="flex w-full items-center justify-between gap-3 rounded-lg p-2.5 text-left hover:bg-muted/60">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{a.patientName}</span>
                      <span className="block text-xs text-muted-foreground">
                        {a.current ? `${a.current.wardName} / ${a.current.bedLabel}` : "—"} · {stayDay(dayKey(new Date(a.admittedAt)), today)}-kun
                      </span>
                    </span>
                    <Badge variant="outline" className={cn("shrink-0 font-medium", DUE_TONE[a.due])}>
                      {DISCHARGE_DUE_LABELS[a.due]}
                      {a.due === "overdue" && a.plannedDischargeOn ? ` · ${formatDate(a.plannedDischargeOn)}` : ""}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title="Yangi yotqizilganlar" description="Bugun">
          {!o || o.admittedToday.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Bugun yotqizilgan bemor yo'q.</p>
          ) : (
            <ul className="-m-1 space-y-1" data-testid="home-admitted">
              {o.admittedToday.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => onOpenStay(a.id)} className="flex w-full items-center justify-between gap-3 rounded-lg p-2.5 text-left hover:bg-muted/60">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{a.patientName}</span>
                      <span className="block text-xs text-muted-foreground">
                        {a.current ? `${a.current.wardName} / ${a.current.bedLabel}` : "—"} · {a.doctorName}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular">{formatDateTime(a.admittedAt).split(", ")[1] ?? ""}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title="Bo'limlar va yotoqlar" description="Bandlik va hozir ishlatib bo'lmaydigan yotoqlar">
          {!o ? (
            <div className="h-32 skeleton-shimmer rounded-lg" />
          ) : (
            <div className="space-y-4">
              <div className="space-y-3" data-testid="home-departments">
                {o.byDepartment.map((d) => (
                  <MeterBar
                    key={d.id}
                    value={d.counts.occupied}
                    max={Math.max(1, d.counts.total - d.counts.maintenance)}
                    label={
                      <>
                        <span className="text-foreground">{d.name}</span>
                        <span className="tabular">
                          {d.counts.occupied}/{d.counts.total - d.counts.maintenance} band{d.occupancy !== null ? ` · ${d.occupancy}%` : ""}
                        </span>
                      </>
                    }
                  />
                ))}
              </div>
              {o.attention.length > 0 && (
                <ul className="space-y-1 border-t pt-3 text-xs" data-testid="home-attention">
                  {o.attention.map((b) => (
                    <li key={b.bedId} className="flex items-start gap-2">
                      {b.display === "maintenance" ? <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" /> : <CalendarCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />}
                      <span>
                        <span className="font-medium">
                          Palata {b.wardName}, yotoq {b.label}
                        </span>{" "}
                        — {BED_DISPLAY_LABELS[b.display].toLowerCase()}
                        {b.note ? `: ${b.note}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
