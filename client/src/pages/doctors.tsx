import { PageHeader } from "@/components/ui-kit";
import { DoctorsPanel } from "@/components/clinic-panels";

/** Shifokorlar: profiles, rooms, prices and weekly timetables (TZ §10 `doctors`). */
export default function Doctors() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Klinika"
        title="Shifokorlar"
        description="Mutaxassislik, kabinet, qabul narxi va haftalik ish jadvali — navbat shu asosda tuziladi"
      />
      <DoctorsPanel />
    </div>
  );
}
