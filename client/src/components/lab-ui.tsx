/**
 * Small lab visuals shared by the catalogue, the order, the sample panel and
 * the label (B4.3, B4.6): the tube's cap colour and the specimen name.
 */
import { TEST_GROUPS, TEST_GROUP_LABELS, TUBES, type SampleType, type TestGroup } from "@shared/lab-catalogue";
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

/**
 * The TZ §6.2 groups as filter chips with counts (catalogue and orders).
 * Groups with nothing in them are hidden, except the selected one, so a
 * filter that empties itself can still be switched off.
 */
export function GroupFilter({
  value,
  onChange,
  counts,
  total,
  testIdPrefix = "filter-group",
}: {
  value: TestGroup | "all";
  onChange: (value: TestGroup | "all") => void;
  counts: Partial<Record<TestGroup, number>>;
  total: number;
  testIdPrefix?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tahlil turi">
      {(["all", ...TEST_GROUPS] as const).map((g) => {
        const count = g === "all" ? total : (counts[g] ?? 0);
        if (g !== "all" && count === 0 && value !== g) return null;
        const active = value === g;
        return (
          <button
            key={g}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(g)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40",
            )}
            data-testid={`${testIdPrefix}-${g}`}
          >
            {g === "all" ? "Hammasi" : TEST_GROUP_LABELS[g]} <span className="tabular opacity-70">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

/** An order's test groups as compact tags: the first few, then "+n". */
export function GroupTags({ groups, max = 2, className }: { groups: TestGroup[]; max?: number; className?: string }) {
  if (groups.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const shown = groups.slice(0, max);
  const rest = groups.slice(max);
  return (
    <span className={cn("flex flex-wrap gap-1", className)} title={groups.map((g) => TEST_GROUP_LABELS[g]).join(", ")}>
      {shown.map((g) => (
        <span key={g} className="rounded-md border bg-muted/50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-foreground/80">
          {TEST_GROUP_LABELS[g]}
        </span>
      ))}
      {rest.length > 0 && (
        <span className="rounded-md px-1 py-0.5 text-[11px] font-medium leading-none text-muted-foreground">+{rest.length}</span>
      )}
    </span>
  );
}
