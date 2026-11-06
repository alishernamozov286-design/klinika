/**
 * Registratura bosh sahifasi (TZ §4.1.1): the desk's day — today's patients,
 * the queue still to come, who has arrived, new registrations and how today's
 * bills stand. One request (/api/reception); each section follows its own
 * permission and is simply absent without it.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  CalendarClock,
  CalendarPlus,
  CircleDollarSign,
  DoorOpen,
  Hourglass,
  ListOrdered,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import type { AppointmentWithDetails, ReceptionBoard as Board } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EmptyState,
  MeterBar,
  Money,
  PatientNumber,
  PhoneText,
  QueueTicket,
  SectionCard,
  StatCard,
} from "@/components/ui-kit";
import { AppointmentDialog } from "@/components/appointment-dialog";
import { useAppointmentStatus } from "@/components/appointment-actions";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { elapsed, formatDayLong, formatTime, money } from "@/lib/format";

export function ReceptionBoard() {
  const { can } = useAuth();
  const [, setLocation] = useLocation();
  const [booking, setBooking] = useState(false);
  const status = useAppointmentStatus();
  const canManage = can("appointments.manage");

  // Waiting times tick without a refetch.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const { data, isLoading } = useQuery<Board>({
    queryKey: ["/api/reception"],
    // The desk keeps this open all day. Until real-time updates (B8.1) it
    // refreshes itself, and always on return from another screen.
    refetchInterval: 20_000,
    refetchOnMount: "always",
  });

  const queue = data?.queue ?? null;
  const counts = queue?.counts;
  const pay = data?.payments ?? null;
  const fresh = data?.newPatients ?? null;
  const came = counts ? counts.arrived + counts.inProgress + counts.completed : 0;

  return (
    <section className="space-y-4" aria-labelledby="reception-title" data-testid="reception-board">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Registratura</p>
          <h2 id="reception-title" className="mt-1 text-xl font-bold tracking-tight">
            Bugungi kun
            {data && (
              <span className="ml-2 text-sm font-medium text-muted-foreground">{formatDayLong(data.date)}</span>
            )}
          </h2>
        </div>
        {queue && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setLocation("/queue")} data-testid="link-reception-queue">
              <ListOrdered className="mr-1.5 h-4 w-4" />
              Navbat
            </Button>
            {canManage && (
              <Button size="sm" onClick={() => setBooking(true)} data-testid="button-reception-book">
                <CalendarPlus className="mr-1.5 h-4 w-4" />
                Qabulga yozish
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------- headline */}
      {/* Two up on a phone (the day's total spans the row), so the board does
          not become five screens of single tiles. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-5">
        <div className="col-span-2 sm:col-span-1 [&>*]:h-full">
          <StatCard
            index={0}
            label="Bugungi bemorlar"
            value={data?.patientsToday ?? 0}
            hint="Bugun tashrifi qayd etilgan"
            icon={Users}
            isLoading={isLoading}
            onClick={() => setLocation("/patients")}
          />
        </div>
        {counts && (
          <StatCard
            index={1}
            label="Navbatdagi bemorlar"
            value={counts.scheduled}
            hint={
              counts.late > 0 ? (
                <span className="text-amber-700 dark:text-amber-300">{counts.late} tasi kechikmoqda</span>
              ) : (
                "Yozilgan, hali kelmagan"
              )
            }
            icon={CalendarClock}
            tone="amber"
            isLoading={isLoading}
            onClick={() => setLocation("/queue")}
          />
        )}
        {counts && (
          <StatCard
            index={2}
            label="Qabulga kelganlar"
            value={came}
            hint={`${counts.arrived} kutmoqda · ${counts.inProgress} qabulda`}
            icon={UserCheck}
            tone="emerald"
            isLoading={isLoading}
            onClick={() => setLocation("/queue")}
          />
        )}
        {fresh && (
          <StatCard
            index={3}
            label="Yangi ro'yxatdan o'tganlar"
            value={fresh.total}
            hint="Bugun ochilgan kartalar"
            icon={UserPlus}
            tone="violet"
            isLoading={isLoading}
          />
        )}
        {pay && (
          <StatCard
            index={4}
            label="To'lov holati"
            value={`${pay.paid}/${pay.orders}`}
            suffix="to'langan"
            hint={
              pay.due !== null && pay.due > 0 ? (
                <span className="text-rose-600 dark:text-rose-400">Qoldiq: {money(pay.due)}</span>
              ) : pay.unpaid + pay.partial > 0 ? (
                `${pay.unpaid + pay.partial} ta to'liq to'lanmagan`
              ) : (
                "Bugungi buyurtmalar to'langan"
              )
            }
            icon={CircleDollarSign}
            tone={pay.unpaid + pay.partial > 0 ? "rose" : "primary"}
            isLoading={isLoading}
            onClick={() => setLocation("/orders")}
          />
        )}
      </div>

      {/* ---------------------------------------------------------- lists */}
      <div className="grid gap-5 xl:grid-cols-3">
        {queue && (
          <SectionCard
            icon={DoorOpen}
            title="Qabulga kelganlar"
            description="Qabuldagilar va kutish zalidagilar"
            flush
          >
            {isLoading ? (
              <ListSkeleton />
            ) : queue.waiting.length === 0 ? (
              <EmptyState icon={DoorOpen} title="Kutayotgan bemor yo'q" description="Bemor kelganda navbatda “Keldi” deb belgilang." />
            ) : (
              <div className="divide-y">
                {queue.waiting.map((a) => (
                  <QueueRow key={a.id} a={a}>
                    {a.status === "in_progress" ? (
                      <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                        Qabulda{a.room ? ` · ${a.room}-xona` : ""}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                        <Hourglass className="h-3 w-3" />
                        {elapsed(a.arrivedAt, now)}
                      </span>
                    )}
                  </QueueRow>
                ))}
              </div>
            )}
          </SectionCard>
        )}

        {queue && (
          <SectionCard
            icon={CalendarClock}
            title="Navbatdagi bemorlar"
            description="Yozilgan vaqti bo'yicha"
            flush
            action={
              <Button variant="ghost" size="sm" onClick={() => setLocation("/queue")}>
                Barchasi
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            }
          >
            {isLoading ? (
              <ListSkeleton />
            ) : queue.upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="Navbatda hech kim yo'q"
                description="Bugungi yozilganlarning hammasi keldi yoki hali hech kim yozilmagan."
              />
            ) : (
              <div className="divide-y">
                {queue.upcoming.map((a) => {
                  // The board is always today, so a booked time already past is late.
                  const late = Boolean(data && a.startTime < data.now);
                  return (
                    <QueueRow key={a.id} a={a} late={late}>
                      {canManage && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          disabled={status.isPending}
                          onClick={() => status.mutate({ appointment: a, status: "arrived" })}
                          data-testid={`button-reception-arrived-${a.id}`}
                        >
                          <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                          Keldi
                        </Button>
                      )}
                    </QueueRow>
                  );
                })}
              </div>
            )}
          </SectionCard>
        )}

        <div className={cn("space-y-5", !queue && "xl:col-span-3 grid gap-5 space-y-0 lg:grid-cols-2")}>
          {fresh && (
            <SectionCard icon={UserPlus} title="Yangi bemorlar" description="Bugun ro'yxatdan o'tganlar" flush>
              {isLoading ? (
                <ListSkeleton rows={3} />
              ) : fresh.latest.length === 0 ? (
                <EmptyState icon={UserPlus} title="Bugun yangi bemor yo'q" description="Yangi karta ochilganda shu yerda ko'rinadi." />
              ) : (
                <div className="divide-y">
                  {fresh.latest.map((p) => (
                    <Link
                      key={p.id}
                      href={`/patients/${p.id}`}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/50"
                      data-testid={`reception-new-${p.id}`}
                    >
                      <PatientNumber value={p.patientNumber} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.fullName}</p>
                        <PhoneText value={p.phone} asLink={false} className="text-xs text-muted-foreground" />
                      </div>
                      <span className="shrink-0 text-xs tabular text-muted-foreground">{formatTime(p.createdAt)}</span>
                    </Link>
                  ))}
                  {fresh.total > fresh.latest.length && (
                    <p className="px-5 py-2.5 text-xs text-muted-foreground">
                      Yana {fresh.total - fresh.latest.length} ta bemor
                    </p>
                  )}
                </div>
              )}
            </SectionCard>
          )}

          {pay && <PaymentStatus pay={pay} isLoading={isLoading} />}
        </div>
      </div>

      {canManage && (
        <AppointmentDialog open={booking} onOpenChange={setBooking} defaultDate={data?.date ?? null} />
      )}
    </section>
  );
}

/** One appointment line, as both lists show it. */
function QueueRow({
  a,
  late,
  children,
}: {
  a: AppointmentWithDetails;
  late?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-center gap-3 px-5 py-3", late && "bg-amber-500/[0.05]")} data-testid={`reception-row-${a.id}`}>
      <QueueTicket number={a.queueNumber} />
      <div className="w-12 shrink-0">
        <p className="font-mono text-sm font-semibold tabular">{a.startTime}</p>
        {late && <p className="text-[10px] font-medium text-amber-700 dark:text-amber-300">kechikmoqda</p>}
      </div>
      <Link href={`/patients/${a.patientId}`} className="group min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-medium group-hover:text-primary">
          <PatientNumber value={a.patientNumber} size="sm" />
          <span className="truncate">{a.patientName}</span>
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {a.doctorName} · {a.specialty}
        </p>
      </Link>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

/** Today's bills by state: how many settled, part-paid and unpaid, and the money. */
function PaymentStatus({ pay, isLoading }: { pay: NonNullable<Board["payments"]>; isLoading: boolean }) {
  const rows = [
    { label: "To'liq to'langan", value: pay.paid, bar: "bg-none bg-emerald-500" },
    { label: "Qisman to'langan", value: pay.partial, bar: "bg-none bg-amber-500" },
    { label: "To'lanmagan", value: pay.unpaid, bar: "bg-none bg-rose-500" },
  ];
  return (
    <SectionCard icon={CircleDollarSign} title="To'lov holati" description="Bugungi laboratoriya buyurtmalari" bodyClassName="space-y-3.5">
      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : pay.orders === 0 ? (
        <p className="text-sm text-muted-foreground">Bugun hali buyurtma yo'q.</p>
      ) : (
        <>
          {rows.map((r) => (
            <MeterBar
              key={r.label}
              value={r.value}
              max={pay.orders}
              barClassName={r.bar}
              label={
                <>
                  <span>{r.label}</span>
                  <span className="font-semibold tabular text-foreground">{r.value} ta</span>
                </>
              }
            />
          ))}
          {pay.billed !== null && (
            <div className="space-y-2 border-t pt-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Hisoblangan</span>
                <Money value={pay.billed} className="font-semibold" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">To'langan</span>
                <Money value={pay.collected ?? 0} className="font-semibold text-emerald-700 dark:text-emerald-400" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Qoldiq</span>
                <Money
                  value={pay.due ?? 0}
                  className={cn("font-semibold", (pay.due ?? 0) > 0 && "text-rose-600 dark:text-rose-400")}
                />
              </div>
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full skeleton-shimmer" />
      ))}
    </div>
  );
}
