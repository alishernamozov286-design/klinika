/**
 * MKB-10 code picker (TZ §5.1.3; B3.4). Optional by design: the diagnosis is
 * the doctor's text, the code sits beside it. Searches by code ("I1", "e11.9")
 * or by words of the Russian or Uzbek name; arrow keys and Enter choose.
 */
import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, X } from "lucide-react";
import type { IcdEntry, IcdLabel } from "@shared/schema";
import { icdDisplayName } from "@shared/icd10";
import { useDebounced } from "@/hooks/use-debounced";
import { cn } from "@/lib/utils";

/** Names for codes already chosen — one cached request per set of codes. */
export function useIcdLabels(codes: (string | null | undefined)[]) {
  const list = Array.from(new Set(codes.filter((c): c is string => Boolean(c)))).sort();
  const { data = [] } = useQuery<IcdLabel[]>({
    queryKey: [`/api/icd10/lookup?codes=${encodeURIComponent(list.join(","))}`],
    enabled: list.length > 0,
    staleTime: 10 * 60_000,
  });
  return new Map(data.map((r) => [r.code, r]));
}

/** "I10" with the name beside it: Uzbek when the clinic has it, Russian otherwise. */
export function IcdCodeBadge({ code, label, className }: { code: string; label?: IcdLabel | null; className?: string }) {
  return (
    <span
      className={cn("inline-flex max-w-full items-baseline gap-1.5 rounded-md border border-primary/25 bg-primary/[0.06] px-1.5 py-0.5 text-xs", className)}
      title={label ? [label.nameUz, label.nameRu].filter(Boolean).join(" / ") : undefined}
      data-testid={`icd-badge-${code}`}
    >
      <span className="font-mono font-bold text-primary">{code}</span>
      {label && <span className="truncate text-foreground/80">{icdDisplayName(label)}</span>}
    </span>
  );
}

export function IcdPicker({
  value,
  onChange,
  disabled,
  testId,
}: {
  value: string | null;
  /** The chosen entry comes along, so the caller can fill an empty diagnosis text. */
  onChange: (code: string | null, entry?: IcdEntry) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const q = useDebounced(query.trim(), 200);
  const labels = useIcdLabels([value]);

  const { data: results = [], isFetching } = useQuery<IcdEntry[]>({
    queryKey: [`/api/icd10?q=${encodeURIComponent(q)}&limit=30`],
    enabled: open && q.length >= 2,
    staleTime: 5 * 60_000,
  });
  useEffect(() => setActive(0), [q]);

  // Closes when focus or a click leaves the picker.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const choose = (entry: IcdEntry) => {
    onChange(entry.code, entry);
    setQuery("");
    setOpen(false);
  };

  if (value) {
    return (
      <div className="flex min-h-9 items-center gap-2" data-testid={testId}>
        <IcdCodeBadge code={value} label={labels.get(value)} className="min-w-0" />
        {!disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="MKB-10 kodini olib tashlash"
            data-testid={testId ? `${testId}-clear` : undefined}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  const showList = open && q.length >= 2;
  return (
    <div ref={boxRef} className="relative" data-testid={testId}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!showList || results.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(results.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(results[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="MKB-10 kodi (ixtiyoriy): kod yoki kasallik nomi…"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          className="h-9 w-full rounded-md border border-dashed bg-background pl-8 pr-8 text-sm placeholder:text-muted-foreground/80 focus:border-solid focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
          data-testid={testId ? `${testId}-input` : undefined}
        />
        {isFetching && <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      {showList && (
        <div
          id={listId}
          role="listbox"
          // Wider than a half-width column so long Russian names stay on one or two lines.
          className="absolute left-0 z-30 mt-1 max-h-80 w-[max(100%,30rem)] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg"
        >
          {results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">{isFetching ? "Qidirilmoqda…" : "Topilmadi"}</p>
          ) : (
            results.map((r, i) => (
              <button
                key={r.code}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(r)}
                className={cn("flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left", i === active && "bg-muted")}
                data-testid={`icd-option-${r.code}`}
              >
                <span className="w-14 shrink-0 font-mono text-sm font-bold text-primary">{r.code}</span>
                <span className="min-w-0 flex-1">
                  {r.nameUz && <span className="block text-sm">{r.nameUz}</span>}
                  <span className={cn("block", r.nameUz ? "text-xs text-muted-foreground" : "text-sm")}>{r.nameRu}</span>
                </span>
                {r.block && <span className="shrink-0 pt-0.5 font-mono text-[10px] text-muted-foreground">{r.block}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
