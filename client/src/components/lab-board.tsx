/**
 * Laboratoriya bosh sahifasi (TZ §6.1.1): today's orders, tubes still to come,
 * work in progress, results for the lab head, results released today and
 * today's cancellations. One request (/api/lab-board); the counting rules are
 * in shared/lab-board.ts.
 *
 * Every tile opens the screen where that work is done, already on the right
 * queue, so the board is a starting point rather than a report.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  ArrowRight,
  BadgeCheck,
  ClipboardList,
  FileCheck2,
  FlaskConical,
  Hourglass,
  Layers,
  Receipt,
  TestTube2,
  XCircle,
} from "lucide-react";
import type { OrderWithDetails } from "@shared/schema";
import { TEST_GROUPS, TEST_GROUP_LABELS, tubesFor } from "@shared/lab-catalogue";
import type { LabBoard as Board } from "@shared/lab-board";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, MeterBar, SampleBadge, SectionCard, StatCard } from "@/components/ui-kit";
import { TubeDot } from "@/components/lab-ui";
import { useAuth } from "@/hooks/use-auth";
import { elapsed, formatDayLong } from "@/lib/format";

export function LabBoard({ onOpenOrder }: { onOpenOrder: (order: OrderWithDetails) => void }) {
  const [, setLocation] = useLocation();
  const { can } = useAuth();

  // Waiting times tick without a refetch.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const { data, isLoading } = useQuery<Board>({
    queryKey: ["/api/lab-board"],
    // Kept open through the shift: refreshes itself until real-time
    // updates arrive (B8.1), and always on return from another screen.
    refetchInterval: 20_000,
    refetchOnMount: "always",
  });

  const c = data?.counts;
  const groups = TEST_GROUPS.map((g) => ({ g, n: data?.groupsToday[g] ?? 0 })).filter((x) => x.n > 0);
  const maxGroup = Math.max(1, ...groups.map((x) => x.n));

  return (
    <section className="space-y-4" aria-labelledby="lab-board-title" data-testid="lab-board">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Laboratoriya</p>
          <h2 id="lab-board-title" className="mt-1 text-xl font-bold tracking-tight">
            Bugungi kun
            {data && <span className="ml-2 text-sm font-medium text-muted-foreground">{formatDayLong(data.date)}</span>}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setLocation("/orders")} data-testid="link-lab-orders">
            <Receipt className="mr-1.5 h-4 w-4" />
            Buyurtmalar
          </Button>
          {can("results.enter", "results.verify") && (
            <Button size="sm" onClick={() => setLocation("/results")} data-testid="link-lab-results">
              <ClipboardList className="mr-1.5 h-4 w-4" />
              Natijalar
            </Button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------- headline */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 2xl:grid-cols-6">
        <StatCard
          index={0}
          label="Bugungi buyurtmalar"
          value={c?.today ?? 0}
          hint="Bugun qabul qilingan"
          icon={Receipt}
          isLoading={isLoading}
          onClick={() => setLocation("/orders")}
        />
        <StatCard
          index={1}
          label="Namuna kutilmoqda"
          value={c?.awaitingSample ?? 0}
          hint={
            c && c.rejected > 0 ? (
              <span className="text-rose-600 dark:text-rose-400">{c.rejected} tasi rad etilgan, qayta olinadi</span>
            ) : (
              "Probirka laboratoriyaga kelmagan"
            )
          }
          icon={TestTube2}
          tone="amber"
          isLoading={isLoading}
        />
        <StatCard
          index={2}
          label="Tahlil jarayonida"
          value={c?.inProgress ?? 0}
          hint="Natija kiritilishi kerak"
          icon={FlaskConical}
          tone="primary"
          isLoading={isLoading}
          onClick={() => setLocation("/results?queue=waiting")}
        />
        <StatCard
          index={3}
          label="Tasdiqlanishi kerak"
          value={c?.review ?? 0}
          hint="Mudiri tekshiruvini kutmoqda"
          icon={BadgeCheck}
          tone="violet"
          isLoading={isLoading}
          onClick={() => setLocation("/results?queue=review")}
        />
        <StatCard
          index={4}
          label="Natija tayyor"
          value={c?.readyToday ?? 0}
          hint="Bugun tasdiqlangan"
          icon={FileCheck2}
          tone="emerald"
          isLoading={isLoading}
          onClick={() => setLocation("/results?queue=ready")}
        />
        <StatCard
          index={5}
          label="Bekor qilingan"
          value={c?.cancelledToday ?? 0}
          hint="Bugun bekor qilingan buyurtmalar"
          icon={XCircle}
          tone="rose"
          isLoading={isLoading}
          onClick={() => setLocation("/orders?status=cancelled")}
        />
      </div>

      {/* ---------------------------------------------------------- lists */}
      <div className="grid gap-5 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          icon={TestTube2}
          title="Namuna kutilayotgan buyurtmalar"
          description="Eng uzoq kutayotgani birinchi"
          flush
          action={
            <Button variant="ghost" size="sm" onClick={() => setLocation("/orders")}>
              Barchasi
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          }
        >
          {isLoading ? (
            <ListSkeleton />
          ) : !data || data.awaiting.length === 0 ? (
            <EmptyState icon={TestTube2} title="Kutilayotgan namuna yo'q" description="Barcha probirkalar laboratoriyaga qabul qilingan." />
          ) : (
            <div className="divide-y" data-testid="list-lab-awaiting">
              {data.awaiting.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => onOpenOrder(o)}
                  className="flex w-full flex-col gap-1.5 px-5 py-3 text-left transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-4"
                  data-testid={`row-lab-awaiting-${o.orderNumber}`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold tabular text-muted-foreground">
                      #{o.orderNumber}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{o.patient?.fullName ?? "—"}</p>
                      <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        {tubesFor(o.items).map((t) => (
                          <TubeDot key={t.sampleType} type={t.sampleType} />
                        ))}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 pl-[52px] sm:pl-0">
                    {o.sample && <SampleBadge status={o.sample.status} className="text-[10px]" />}
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                      <Hourglass className="h-3 w-3" />
                      {elapsed(o.createdAt, now)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard icon={Layers} title="Tahlil turlari" description="Bugungi buyurtmalar guruhlar bo'yicha">
          {isLoading ? (
            <ListSkeleton />
          ) : groups.length === 0 ? (
            <EmptyState icon={Layers} title="Bugun buyurtma yo'q" description="Buyurtma tushganda bu yerda guruhlar bo'yicha ko'rinadi." />
          ) : (
            <div className="space-y-3" data-testid="list-lab-groups">
              {groups.map(({ g, n }) => (
                <MeterBar
                  key={g}
                  value={n}
                  max={maxGroup}
                  label={
                    <>
                      <span>{TEST_GROUP_LABELS[g]}</span>
                      <span className="tabular">{n}</span>
                    </>
                  }
                />
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </section>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
