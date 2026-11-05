import { PageHeader } from "@/components/ui-kit";
import { DepartmentsPanel } from "@/components/clinic-panels";

/** Bo'limlar: the clinic's departments (TZ §10 `departments`). */
export default function Departments() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Klinika"
        title="Bo'limlar"
        description="Shifokorlar, navbat va statsionar palatalari shu bo'limlarga bog'lanadi"
      />
      <DepartmentsPanel />
    </div>
  );
}
