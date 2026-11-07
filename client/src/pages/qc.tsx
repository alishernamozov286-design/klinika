/**
 * Sifat nazorati (B4.8, TZ §6.5): internal QC with Levey–Jennings charts and
 * Westgard rules, control materials, calibration history, analyzer
 * maintenance and interlaboratory QC. Rules: shared/qc.ts.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertOctagon, Beaker, CalendarCheck2, ShieldCheck } from "lucide-react";
import type { QcBoard } from "@shared/schema";
import { daysUntil } from "@shared/qc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, StatCard } from "@/components/ui-kit";
import { QcInternal } from "@/components/qc/qc-internal";
import { QcMaterials } from "@/components/qc/qc-materials";
import { QcCalibrations, QcEqa, QcMaintenance } from "@/components/qc/qc-records";

const TABS = [
  { value: "internal", label: "Ichki nazorat" },
  { value: "materials", label: "Nazorat materiallari" },
  { value: "calibration", label: "Kalibratsiya" },
  { value: "maintenance", label: "Texnik xizmat" },
  { value: "eqa", label: "Tashqi nazorat" },
] as const;
type Tab = (typeof TABS)[number]["value"];

export default function QualityControl() {
  const [tab, setTab] = useState<Tab>(() => {
    const asked = new URLSearchParams(window.location.search).get("tab");
    return TABS.find((t) => t.value === asked)?.value ?? "internal";
  });
  const { data: board, isLoading } = useQuery<QcBoard>({ queryKey: ["/api/qc"], refetchOnMount: "always", refetchInterval: 60_000 });

  const today = board?.date ?? new Date().toISOString().slice(0, 10);
  const series = (board?.targets ?? []).filter((t) => t.isActive && t.materialActive);
  const measured = series.filter((t) => t.runsToday > 0).length;
  const open = series.reduce((s, t) => s + t.openRejections, 0);
  const expiring = (board?.materials ?? []).filter((m) => m.isActive && daysUntil(m.expiresOn, today) <= 30);
  const expired = expiring.filter((m) => daysUntil(m.expiresOn, today) < 0).length;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Laboratoriya" title="Sifat nazorati" description="Ichki nazorat, Westgard qoidalari, kalibratsiya, texnik xizmat va tashqi nazorat" />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard index={0} label="Faol seriyalar" value={series.length} hint={`${board?.materials.filter((m) => m.isActive).length ?? 0} ta nazorat materiali`} icon={ShieldCheck} isLoading={isLoading} />
        <StatCard
          index={1}
          label="Bugun o'lchangan"
          value={`${measured}/${series.length}`}
          hint={series.length - measured > 0 ? `${series.length - measured} ta seriya hali o'lchanmagan` : "Hamma seriya o'lchangan"}
          icon={CalendarCheck2}
          tone={series.length - measured > 0 ? "amber" : "emerald"}
          isLoading={isLoading}
          onClick={() => setTab("internal")}
        />
        <StatCard
          index={2}
          label="Chora kutilmoqda"
          value={open}
          hint={open > 0 ? "Rad etilgan natijalar" : "Rad etilgan natija yo'q"}
          icon={AlertOctagon}
          tone={open > 0 ? "rose" : "emerald"}
          isLoading={isLoading}
          onClick={() => setTab("internal")}
        />
        <StatCard
          index={3}
          label="Material muddati"
          value={expiring.length}
          hint={expired > 0 ? `${expired} tasining muddati o'tgan` : "30 kun ichida tugaydi"}
          icon={Beaker}
          tone={expired > 0 ? "rose" : expiring.length > 0 ? "amber" : "violet"}
          isLoading={isLoading}
          onClick={() => setTab("materials")}
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="h-auto flex-wrap justify-start">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} data-testid={`tab-qc-${t.value}`}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="internal" className="mt-4">
          {board ? <QcInternal board={board} onGoMaterials={() => setTab("materials")} /> : <div className="card-premium h-72 skeleton-shimmer" />}
        </TabsContent>
        <TabsContent value="materials" className="mt-4">
          {board ? <QcMaterials board={board} /> : <div className="card-premium h-72 skeleton-shimmer" />}
        </TabsContent>
        <TabsContent value="calibration" className="mt-4">
          <QcCalibrations />
        </TabsContent>
        <TabsContent value="maintenance" className="mt-4">
          <QcMaintenance today={today} />
        </TabsContent>
        <TabsContent value="eqa" className="mt-4">
          <QcEqa today={today} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
