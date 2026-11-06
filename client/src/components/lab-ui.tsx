/**
 * Small lab visuals shared by the catalogue, the order, the sample panel and
 * the label (B4.3, B4.6): the tube's cap colour and the specimen name.
 */
import { TUBES, type SampleType } from "@shared/lab-catalogue";
import { cn } from "@/lib/utils";

/** The cap colour as a dot, with the specimen name beside it. */
export function TubeDot({ type, label = true, className }: { type: SampleType; label?: boolean; className?: string }) {
  const tube = TUBES[type] ?? TUBES.boshqa;
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)} title={tube.container}>
      <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10" style={{ backgroundColor: tube.color }} aria-hidden />
      {label && <span>{tube.label}</span>}
    </span>
  );
}
