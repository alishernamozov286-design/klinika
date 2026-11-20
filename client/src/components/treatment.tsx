/**
 * Davolash va retsept (B3.6, TZ §5.1.5): the editor in the examination window,
 * the read-only list, and the patient's treatment history.
 *
 * A medicine is picked from the warehouse catalogue (with whether it is on the
 * shelf) or typed by hand; a procedure from the "muolaja" services. Editing a
 * picked name turns the line into a hand-written one — the server takes
 * catalogue names from the catalogue. Rules: shared/prescription.ts.
 */
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck, PenLine, Pill, Plus, Syringe, Trash2 } from "lucide-react";
import type { PrescriptionCatalog, PrescriptionLine } from "@shared/schema";
import {
  ADMIN_ROUTES,
  ADMIN_ROUTE_LABELS,
  MAX_PRESCRIPTION_LINES,
  REGIMEN_SUGGESTIONS,
  blankLine,
  lineDirections,
  treatmentSummary,
  type AdminRoute,
  type PrescriptionKind,
  type TreatmentEntry,
} from "@shared/prescription";
import { inventoryKey } from "@shared/inventory";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatDay, money } from "@/lib/format";

const KIND_ICON: Record<PrescriptionKind, typeof Pill> = { medicine: Pill, procedure: Syringe };
const KIND_TONE: Record<PrescriptionKind, string> = {
  medicine: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  procedure: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
};
const NO_ROUTE = "__none__";

/** The editor. `lines` is the record's treatment; every change goes to `onChange` (the form autosaves). */
export function TreatmentEditor({
  lines,
  onChange,
  disabled,
  highlight,
}: {
  lines: PrescriptionLine[];
  onChange: (lines: PrescriptionLine[]) => void;
  disabled?: boolean;
  /** Outlined while correcting a signed record, when the treatment changed. */
  highlight?: boolean;
}) {
  const { data: catalog } = useQuery<PrescriptionCatalog>({ queryKey: ["/api/prescription-catalog"], refetchOnMount: "always" });
  const regimenList = useId();
  const set = (id: string, patch: Partial<PrescriptionLine>) => onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const add = (kind: PrescriptionKind) => {
    const line = blankLine(kind);
    onChange([...lines, line]);
    // Focus the new line's name once it is on screen.
    setTimeout(() => document.querySelector<HTMLInputElement>(`[data-rx-name="${line.id}"]`)?.focus(), 30);
  };
  const full = lines.length >= MAX_PRESCRIPTION_LINES;

  return (
    <div className={cn("space-y-3", highlight && "rounded-xl ring-2 ring-amber-500/30 ring-offset-2 ring-offset-background")} data-testid="treatment-editor">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <Label className="text-primary">Davolash</Label>
          <span className="text-xs text-muted-foreground">{lines.length ? treatmentSummary(lines) : "dori, doza, qabul qilish tartibi, davomiyligi, muolajalar"}</span>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => add("medicine")} disabled={disabled || full} data-testid="button-add-medicine">
            <Pill className="mr-1.5 h-3.5 w-3.5" />
            Dori
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => add("procedure")} disabled={disabled || full} data-testid="button-add-procedure">
            <Syringe className="mr-1.5 h-3.5 w-3.5" />
            Muolaja
          </Button>
        </div>
      </div>

      {lines.length === 0 ? (
        <button
          type="button"
          onClick={() => add("medicine")}
          disabled={disabled}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:pointer-events-none"
        >
          <Plus className="h-4 w-4" />
          Davolash belgilanmagan — dori yoki muolaja qo'shing
        </button>
      ) : (
        <ol className="space-y-2.5">
          {lines.map((l, i) => (
            <TreatmentLineEditor
              key={l.id}
              index={i}
              line={l}
              catalog={catalog}
              regimenList={regimenList}
              disabled={disabled}
              onChange={(patch) => set(l.id, patch)}
              onRemove={() => onChange(lines.filter((x) => x.id !== l.id))}
            />
          ))}
        </ol>
      )}
      <datalist id={regimenList}>
        {REGIMEN_SUGGESTIONS.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
    </div>
  );
}

function TreatmentLineEditor({
  index,
  line,
  catalog,
  regimenList,
  disabled,
  onChange,
  onRemove,
}: {
  index: number;
  line: PrescriptionLine;
  catalog: PrescriptionCatalog | undefined;
  regimenList: string;
  disabled?: boolean;
  onChange: (patch: Partial<PrescriptionLine>) => void;
  onRemove: () => void;
}) {
  const Icon = KIND_ICON[line.kind];
  const medicine = line.kind === "medicine";
  const linked = medicine ? line.itemId : line.serviceId;
  const stock = medicine && line.itemId ? catalog?.medicines.find((m) => m.id === line.itemId) : undefined;
  const num = (v: string) => {
    const n = Number(v);
    return v.trim() === "" || !Number.isFinite(n) || n < 1 ? null : Math.round(n);
  };
  return (
    <li className="rounded-xl border bg-muted/20 p-3" data-testid={`rx-line-${index}`}>
      <div className="flex items-start gap-2.5">
        <div className={cn("icon-tile mt-0.5 h-8 w-8 shrink-0", KIND_TONE[line.kind])} title={medicine ? "Dori vositasi" : "Muolaja"}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <NamePicker line={line} catalog={catalog} disabled={disabled} onChange={onChange} />
          <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            {linked ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                <BookOpenCheck className="h-3 w-3" />
                {medicine ? "Ombor katalogidan" : "Xizmatlar katalogidan"}
              </span>
            ) : line.name.trim() ? (
              <span className="inline-flex items-center gap-1">
                <PenLine className="h-3 w-3" />
                Qo'lda yozilgan
              </span>
            ) : null}
            {stock && (
              <Badge variant="outline" className={cn("h-4 px-1.5 text-[10px]", stock.inStock ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-300" : "border-amber-500/30 text-amber-700 dark:text-amber-300")}>
                {stock.inStock ? "omborda bor" : "omborda yo'q"}
              </Badge>
            )}
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={onRemove} disabled={disabled} aria-label="Qatorni olib tashlash" data-testid={`button-remove-rx-${index}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className={cn("mt-2.5 grid gap-2 sm:pl-[2.6rem]", medicine ? "sm:grid-cols-[1fr_1.1fr_1.6fr_0.8fr]" : "sm:grid-cols-[1.8fr_0.8fr_0.8fr]")}>
        {medicine && (
          <Field label="Doza">
            <Input value={line.dose ?? ""} onChange={(e) => onChange({ dose: e.target.value })} placeholder="500 mg · 1 tabletka" maxLength={60} disabled={disabled} className="h-9" data-testid={`input-rx-dose-${index}`} />
          </Field>
        )}
        {medicine && (
          <Field label="Yo'li">
            <Select value={line.route ?? NO_ROUTE} onValueChange={(v) => onChange({ route: v === NO_ROUTE ? null : (v as AdminRoute) })} disabled={disabled}>
              <SelectTrigger className="h-9" data-testid={`select-rx-route-${index}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ROUTE}>Ko'rsatilmagan</SelectItem>
                {ADMIN_ROUTES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ADMIN_ROUTE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <Field label="Qabul qilish tartibi">
          <Input
            value={line.regimen ?? ""}
            onChange={(e) => onChange({ regimen: e.target.value })}
            list={regimenList}
            placeholder={medicine ? "Kuniga 3 marta, ovqatdan keyin" : "Har kuni"}
            maxLength={160}
            disabled={disabled}
            className="h-9"
            data-testid={`input-rx-regimen-${index}`}
          />
        </Field>
        <Field label="Davomiyligi, kun">
          <Input
            inputMode="numeric"
            value={line.days ?? ""}
            onChange={(e) => onChange({ days: num(e.target.value) })}
            placeholder="—"
            disabled={disabled}
            className="h-9 text-right tabular"
            data-testid={`input-rx-days-${index}`}
          />
        </Field>
        {!medicine && (
          <Field label="Seanslar">
            <Input
              inputMode="numeric"
              value={line.sessions ?? ""}
              onChange={(e) => onChange({ sessions: num(e.target.value) })}
              placeholder="—"
              disabled={disabled}
              className="h-9 text-right tabular"
              data-testid={`input-rx-sessions-${index}`}
            />
          </Field>
        )}
        <div className={cn(medicine ? "sm:col-span-4" : "sm:col-span-3")}>
          <Input
            value={line.notes ?? ""}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="Izoh (ixtiyoriy): masalan, harorat 38° dan oshsa"
            maxLength={300}
            disabled={disabled}
            className="h-8 border-dashed text-xs"
            data-testid={`input-rx-notes-${index}`}
          />
        </div>
      </div>
    </li>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/** The name: a search over the catalogue that also accepts free text. */
function NamePicker({
  line,
  catalog,
  disabled,
  onChange,
}: {
  line: PrescriptionLine;
  catalog: PrescriptionCatalog | undefined;
  disabled?: boolean;
  onChange: (patch: Partial<PrescriptionLine>) => void;
}) {
  const medicine = line.kind === "medicine";
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const options = useMemo(() => {
    const q = inventoryKey(line.name);
    const pool = medicine
      ? (catalog?.medicines ?? []).map((m) => ({ id: m.id, name: m.name, hint: [m.manufacturer, m.unit].filter(Boolean).join(" · "), extra: m.inStock ? "omborda bor" : "omborda yo'q", ok: m.inStock }))
      : (catalog?.procedures ?? []).map((p) => ({ id: p.id, name: p.name, hint: money(p.price), extra: "", ok: true }));
    const found = q ? pool.filter((o) => inventoryKey(o.name).includes(q)) : pool;
    // Already chosen: no list until the name is edited.
    if ((medicine ? line.itemId : line.serviceId) && found.length === 1 && found[0].name === line.name) return [];
    return found.slice(0, 8);
  }, [catalog, line.name, line.itemId, line.serviceId, medicine]);

  const choose = (o: { id: string; name: string }) => {
    onChange(medicine ? { itemId: o.id, name: o.name } : { serviceId: o.id, name: o.name });
    setOpen(false);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || options.length === 0) return;
    if (e.key === "ArrowDown") setActive((a) => Math.min(options.length - 1, a + 1));
    else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
    else if (e.key === "Enter") choose(options[active]);
    else if (e.key === "Escape") setOpen(false);
    else return;
    e.preventDefault();
  };

  return (
    <div className="relative">
      <Input
        value={line.name}
        onChange={(e) => {
          // Editing a catalogue name makes the line hand-written.
          onChange(medicine ? { name: e.target.value, itemId: null } : { name: e.target.value, serviceId: null });
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={onKey}
        placeholder={medicine ? "Dori nomi — katalogdan qidiring yoki yozing" : "Muolaja — katalogdan tanlang yoki yozing"}
        maxLength={160}
        disabled={disabled}
        role="combobox"
        aria-expanded={open && options.length > 0}
        aria-autocomplete="list"
        className="h-9 font-medium"
        data-rx-name={line.id}
        data-testid={`input-rx-name-${line.id}`}
      />
      {open && options.length > 0 && (
        <ul role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
          {options.map((o, i) => (
            <li key={o.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (blurTimer.current) clearTimeout(blurTimer.current);
                  choose(o);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn("flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-sm", i === active && "bg-muted")}
                data-testid={`rx-option-${o.id}`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{o.name}</span>
                  {o.hint && <span className="block truncate text-xs text-muted-foreground">{o.hint}</span>}
                </span>
                {o.extra && <span className={cn("shrink-0 text-[11px]", o.ok ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-300")}>{o.extra}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The treatment as read: numbered, name bold, how to take it under it. */
export function TreatmentView({ lines, dense }: { lines: readonly PrescriptionLine[]; dense?: boolean }) {
  if (!lines.length) return null;
  return (
    <ol className={cn("space-y-2", dense && "space-y-1.5")} data-testid="treatment-view">
      {lines.map((l, i) => {
        const Icon = KIND_ICON[l.kind];
        return (
          <li key={l.id} className="flex gap-2.5">
            <span className={cn("icon-tile mt-0.5 h-6 w-6 shrink-0", KIND_TONE[l.kind])}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                <span className="mr-1 text-muted-foreground tabular">{i + 1}.</span>
                {l.name}
                {l.kind === "procedure" && <span className="ml-1.5 text-xs font-normal text-muted-foreground">muolaja</span>}
              </p>
              {lineDirections(l) && <p className="text-sm text-muted-foreground">{lineDirections(l)}</p>}
              {l.notes && <p className="text-xs italic text-muted-foreground">{l.notes}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** TZ §5.1.2 "Davolash tarixi": what was prescribed at each signed examination. */
export function TreatmentHistory({ entries }: { entries: TreatmentEntry[] }) {
  if (!entries.length) return <p className="text-sm text-muted-foreground">Tasdiqlangan ko'riklarda davolash belgilanmagan.</p>;
  return (
    <ol className="space-y-4" data-testid="treatment-history">
      {entries.map((e) => (
        <li key={e.recordId} className="border-l-2 border-primary/30 pl-3">
          <p className="mb-1.5 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{formatDay(e.date)}</span> · {e.doctorName} ({e.specialty}){e.version > 1 ? ` · v${e.version}` : ""}
          </p>
          <TreatmentView lines={e.lines} dense />
        </li>
      ))}
    </ol>
  );
}
