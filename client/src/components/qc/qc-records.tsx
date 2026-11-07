/**
 * The logs of TZ §6.5 besides daily QC: calibration history (with reagent LOT
 * and expiry), analyzer maintenance (with what is due next) and external /
 * interlaboratory QC results (z-score per ISO 13528). Append-only.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarClock, Globe2, Loader2, Plus, Settings2, Wrench } from "lucide-react";
import type { CalibrationView, DeviceMaintenanceView, EqaResultView } from "@shared/schema";
import {
  CALIBRATION_RESULTS,
  CALIBRATION_RESULT_LABELS,
  EQA_EVALUATION_LABELS,
  MAINTENANCE_KINDS,
  MAINTENANCE_KIND_LABELS,
  daysUntil,
  eqaEvaluation,
  roundZ,
  zScore,
  type CalibrationResult,
  type EqaEvaluation,
  type MaintenanceKind,
} from "@shared/qc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, TableSkeleton } from "@/components/ui-kit";
import { TextPromptDialog, fmtNum, localNow, parseNumber, toIso, useLabDevices, useLabTests } from "@/components/qc/qc-ui";
import { apiRequest, invalidateApi } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime } from "@/lib/format";

const NO_TEST = "__none__";

function Toolbar({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="card-premium flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function FormDialog({
  open,
  onClose,
  title,
  description,
  formId,
  pending,
  error,
  children,
  onSubmit,
  testId,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  formId: string;
  pending: boolean;
  error: string | null;
  children: ReactNode;
  onSubmit: () => void;
  testId: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          id={formId}
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          {children}
          {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" form={formId} disabled={pending} data-testid={`button-save-${testId}`}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeviceSelect({ value, onChange, testId }: { value: string; onChange: (v: string) => void; testId: string }) {
  const devices = useLabDevices();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger data-testid={testId}>
        <SelectValue placeholder="Tanlang" />
      </SelectTrigger>
      <SelectContent>
        {devices.map((d) => (
          <SelectItem key={d.id} value={d.id}>
            {d.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TestSelect({ value, onChange, optional, testId }: { value: string; onChange: (v: string) => void; optional?: boolean; testId: string }) {
  const tests = useLabTests();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger data-testid={testId}>
        <SelectValue placeholder="Tanlang" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {optional && <SelectItem value={NO_TEST}>Barcha tahlillar</SelectItem>}
        {tests.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            {t.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const Field = ({ id, label, children, wide }: { id?: string; label: string; children: ReactNode; wide?: boolean }) => (
  <div className={cn("space-y-1.5", wide && "sm:col-span-2")}>
    <Label htmlFor={id}>{label}</Label>
    {children}
  </div>
);

// ================================================================ calibration

export function QcCalibrations() {
  const { can } = useAuth();
  const { toast } = useToast();
  const { data = [], isLoading } = useQuery<CalibrationView[]>({ queryKey: ["/api/qc/calibrations"], refetchOnMount: "always" });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    deviceId: "",
    testId: NO_TEST,
    performedAt: localNow(),
    calibratorName: "",
    calibratorLot: "",
    calibratorExpiresOn: "",
    reagentLot: "",
    reagentExpiresOn: "",
    result: "passed" as CalibrationResult,
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  useEffect(() => {
    if (open) {
      setF((x) => ({ ...x, performedAt: localNow(), notes: "" }));
      setError(null);
    }
  }, [open]);

  const save = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/qc/calibrations", {
        ...f,
        testId: f.testId === NO_TEST ? null : f.testId,
        performedAt: toIso(f.performedAt),
      });
    },
    onSuccess: () => {
      invalidateApi("/api/qc/calibrations");
      toast({ title: "Kalibratsiya yozildi" });
      setOpen(false);
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="space-y-4">
      <Toolbar
        title="Kalibratsiya tarixi"
        description="Qaysi qurilma, qaysi tahlil, qaysi kalibrator va reagent LOT bilan kalibrlangan, natijasi qanday."
        action={
          can("qc.enter") && (
            <Button className="shrink-0 shadow-brand" onClick={() => setOpen(true)} data-testid="button-add-calibration">
              <Plus className="mr-2 h-4 w-4" />
              Kalibratsiya yozish
            </Button>
          )
        }
      />
      <div className="card-premium overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={3} />
        ) : data.length === 0 ? (
          <EmptyState icon={Settings2} title="Kalibratsiya yozilmagan" description="Har bir kalibratsiyani kalibrator va reagent LOT raqami bilan yozing." />
        ) : (
          <div className="overflow-x-auto">
            <Table className="table-premium">
              <TableHeader>
                <TableRow>
                  <TableHead>Vaqt</TableHead>
                  <TableHead>Qurilma · tahlil</TableHead>
                  <TableHead className="hidden md:table-cell">Kalibrator</TableHead>
                  <TableHead className="hidden lg:table-cell">Reagent</TableHead>
                  <TableHead>Natija</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((c) => (
                  <TableRow key={c.id} data-testid={`row-calibration-${c.id}`}>
                    <TableCell className="whitespace-nowrap text-sm tabular">
                      {formatDateTime(c.performedAt)}
                      <span className="block text-xs text-muted-foreground">{c.performedByName}</span>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{c.deviceName}</p>
                      <p className="text-xs text-muted-foreground">{c.testName ?? "Barcha tahlillar"}</p>
                    </TableCell>
                    <TableCell className="hidden text-sm md:table-cell">
                      {c.calibratorName}
                      <span className="block font-mono text-xs text-muted-foreground">
                        {c.calibratorLot ? `LOT ${c.calibratorLot}` : ""}
                        {c.calibratorExpiresOn ? ` · ${formatDate(c.calibratorExpiresOn)} gacha` : ""}
                      </span>
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">
                      {c.reagentLot ? `LOT ${c.reagentLot}` : "—"}
                      {c.reagentExpiresOn ? ` · ${formatDate(c.reagentExpiresOn)} gacha` : ""}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-medium",
                          c.result === "passed"
                            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
                        )}
                      >
                        {CALIBRATION_RESULT_LABELS[c.result]}
                      </Badge>
                      {c.notes && <p className="mt-1 max-w-[220px] text-xs text-muted-foreground">{c.notes}</p>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <FormDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Kalibratsiya yozish"
        description="Muddati o'tgan kalibrator yoki reagent bilan kalibratsiya qabul qilinmaydi."
        formId="calibration-form"
        pending={save.isPending}
        error={error}
        onSubmit={() => save.mutate()}
        testId="calibration"
      >
        <Field label="Qurilma">
          <DeviceSelect value={f.deviceId} onChange={(v) => set("deviceId", v)} testId="select-cal-device" />
        </Field>
        <Field label="Tahlil">
          <TestSelect value={f.testId} onChange={(v) => set("testId", v)} optional testId="select-cal-test" />
        </Field>
        <Field id="cal-name" label="Kalibrator">
          <Input id="cal-name" value={f.calibratorName} onChange={(e) => set("calibratorName", e.target.value)} placeholder="Multi Calibrator" data-testid="input-cal-name" />
        </Field>
        <Field id="cal-time" label="Vaqt">
          <Input id="cal-time" type="datetime-local" value={f.performedAt} max={localNow()} onChange={(e) => set("performedAt", e.target.value)} />
        </Field>
        <Field id="cal-lot" label="Kalibrator LOT">
          <Input id="cal-lot" value={f.calibratorLot} onChange={(e) => set("calibratorLot", e.target.value)} className="font-mono" />
        </Field>
        <Field id="cal-exp" label="Kalibrator muddati">
          <Input id="cal-exp" type="date" value={f.calibratorExpiresOn} onChange={(e) => set("calibratorExpiresOn", e.target.value)} data-testid="input-cal-exp" />
        </Field>
        <Field id="cal-rlot" label="Reagent LOT">
          <Input id="cal-rlot" value={f.reagentLot} onChange={(e) => set("reagentLot", e.target.value)} className="font-mono" />
        </Field>
        <Field id="cal-rexp" label="Reagent muddati">
          <Input id="cal-rexp" type="date" value={f.reagentExpiresOn} onChange={(e) => set("reagentExpiresOn", e.target.value)} />
        </Field>
        <Field label="Natija">
          <Select value={f.result} onValueChange={(v) => set("result", v as CalibrationResult)}>
            <SelectTrigger data-testid="select-cal-result">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CALIBRATION_RESULTS.map((r) => (
                <SelectItem key={r} value={r}>
                  {CALIBRATION_RESULT_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="cal-notes" label="Izoh" wide>
          <Textarea id="cal-notes" value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Ixtiyoriy: egri chiziq, faktor, sabab" />
        </Field>
      </FormDialog>
    </div>
  );
}

// ================================================================ maintenance

export function QcMaintenance({ today }: { today: string }) {
  const { can } = useAuth();
  const { toast } = useToast();
  const { data = [], isLoading } = useQuery<DeviceMaintenanceView[]>({ queryKey: ["/api/qc/maintenance"], refetchOnMount: "always" });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ deviceId: "", kind: "daily" as MaintenanceKind, performedAt: localNow(), description: "", nextDueOn: "" });
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  useEffect(() => {
    if (open) {
      setF((x) => ({ ...x, performedAt: localNow(), description: "", nextDueOn: "" }));
      setError(null);
    }
  }, [open]);

  /** For each device and kind, the newest entry: is its next one due? */
  const due = useMemo(() => {
    const latest = new Map<string, DeviceMaintenanceView>();
    for (const m of data) {
      const key = `${m.deviceId}:${m.kind}`;
      if (!latest.has(key)) latest.set(key, m); // data is newest first
    }
    return Array.from(latest.values())
      .filter((m) => m.nextDueOn && daysUntil(m.nextDueOn, today) <= 7)
      .sort((a, b) => a.nextDueOn!.localeCompare(b.nextDueOn!));
  }, [data, today]);

  const save = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/qc/maintenance", { ...f, performedAt: toIso(f.performedAt), nextDueOn: f.nextDueOn || null });
    },
    onSuccess: () => {
      invalidateApi("/api/qc/maintenance");
      toast({ title: "Texnik xizmat yozildi" });
      setOpen(false);
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="space-y-4">
      <Toolbar
        title="Analizator texnik xizmat jurnali"
        description="Kundalik, haftalik, oylik va profilaktik ishlar, ta'mirlash va servis muhandisi tashriflari."
        action={
          can("qc.enter") && (
            <Button className="shrink-0 shadow-brand" onClick={() => setOpen(true)} data-testid="button-add-maintenance">
              <Plus className="mr-2 h-4 w-4" />
              Xizmat yozish
            </Button>
          )
        }
      />
      {due.length > 0 && (
        <div className="card-premium p-4" data-testid="list-maintenance-due">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="h-4 w-4 text-amber-600" />
            Navbatdagi xizmatlar
          </p>
          <ul className="flex flex-wrap gap-2">
            {due.map((m) => {
              const left = daysUntil(m.nextDueOn!, today);
              return (
                <li
                  key={m.id}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs",
                    left < 0 ? "border-rose-500/30 bg-rose-500/5 text-rose-800 dark:text-rose-200" : "border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-200",
                  )}
                >
                  <span className="font-semibold">{m.deviceName}</span> · {MAINTENANCE_KIND_LABELS[m.kind]} ·{" "}
                  {left < 0 ? `${-left} kun kechikdi` : left === 0 ? "bugun" : `${left} kundan keyin`}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className="card-premium overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={3} />
        ) : data.length === 0 ? (
          <EmptyState icon={Wrench} title="Jurnal bo'sh" description="Har bir texnik xizmatni bajarilgan kuni yozing; keyingi sanani ko'rsatsangiz, tizim eslatadi." />
        ) : (
          <div className="overflow-x-auto">
            <Table className="table-premium">
              <TableHeader>
                <TableRow>
                  <TableHead>Vaqt</TableHead>
                  <TableHead>Qurilma</TableHead>
                  <TableHead>Turi</TableHead>
                  <TableHead className="hidden md:table-cell">Nima qilindi</TableHead>
                  <TableHead className="hidden sm:table-cell">Keyingisi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((m) => (
                  <TableRow key={m.id} data-testid={`row-maintenance-${m.id}`}>
                    <TableCell className="whitespace-nowrap text-sm tabular">
                      {formatDateTime(m.performedAt)}
                      <span className="block text-xs text-muted-foreground">{m.performedByName}</span>
                    </TableCell>
                    <TableCell className="font-medium">{m.deviceName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">
                        {MAINTENANCE_KIND_LABELS[m.kind]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden max-w-[320px] text-sm md:table-cell">{m.description}</TableCell>
                    <TableCell className="hidden text-sm tabular sm:table-cell">{m.nextDueOn ? formatDate(m.nextDueOn) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <FormDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Texnik xizmat yozish"
        description="Yozuv o'chirilmaydi. Keyingi sana ko'rsatilsa, muddat yaqinlashganda eslatiladi."
        formId="maintenance-form"
        pending={save.isPending}
        error={error}
        onSubmit={() => save.mutate()}
        testId="maintenance"
      >
        <Field label="Qurilma">
          <DeviceSelect value={f.deviceId} onChange={(v) => set("deviceId", v)} testId="select-mt-device" />
        </Field>
        <Field label="Turi">
          <Select value={f.kind} onValueChange={(v) => set("kind", v as MaintenanceKind)}>
            <SelectTrigger data-testid="select-mt-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MAINTENANCE_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {MAINTENANCE_KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="mt-desc" label="Nima qilindi" wide>
          <Textarea id="mt-desc" value={f.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="Masalan: kyuvetalar yuvildi, probe tozalandi, filtr almashtirildi" data-testid="input-mt-desc" />
        </Field>
        <Field id="mt-time" label="Vaqt">
          <Input id="mt-time" type="datetime-local" value={f.performedAt} max={localNow()} onChange={(e) => set("performedAt", e.target.value)} />
        </Field>
        <Field id="mt-next" label="Keyingi xizmat sanasi">
          <Input id="mt-next" type="date" value={f.nextDueOn} min={today} onChange={(e) => set("nextDueOn", e.target.value)} data-testid="input-mt-next" />
        </Field>
      </FormDialog>
    </div>
  );
}

// ================================================================ external QC

const EVAL_TONE: Record<EqaEvaluation, string> = {
  acceptable: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  questionable: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  unacceptable: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

export function QcEqa({ today }: { today: string }) {
  const { can } = useAuth();
  const { toast } = useToast();
  const { data = [], isLoading } = useQuery<EqaResultView[]>({ queryKey: ["/api/qc/eqa"], refetchOnMount: "always" });
  const [open, setOpen] = useState(false);
  const [voiding, setVoiding] = useState<EqaResultView | null>(null);
  const [voidError, setVoidError] = useState<string | null>(null);
  const [f, setF] = useState({ provider: "", cycle: "", sampleCode: "", testId: "", sampleDate: today, reportedValue: "", assignedValue: "", sdpa: "", notes: "" });
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  useEffect(() => {
    if (open) {
      setF((x) => ({ ...x, sampleCode: "", reportedValue: "", assignedValue: "", sdpa: "", notes: "", sampleDate: today }));
      setError(null);
    }
  }, [open, today]);

  const rep = parseNumber(f.reportedValue);
  const asg = parseNumber(f.assignedValue);
  const sd = parseNumber(f.sdpa);
  const previewZ = Number.isFinite(rep) && Number.isFinite(asg) && sd > 0 ? roundZ(zScore(rep, asg, sd)) : null;
  const live = data.filter((e) => !e.voidedAt);
  const counts = { acceptable: 0, questionable: 0, unacceptable: 0 } as Record<EqaEvaluation, number>;
  for (const e of live) counts[e.evaluation] += 1;

  const save = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/qc/eqa", { ...f, reportedValue: rep, assignedValue: asg, sdpa: sd, sampleCode: f.sampleCode || null, notes: f.notes || null });
    },
    onSuccess: () => {
      invalidateApi("/api/qc/eqa");
      toast({ title: "Tashqi nazorat natijasi yozildi" });
      setOpen(false);
    },
    onError: (err: Error) => setError(err.message),
  });
  const voidIt = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await apiRequest("POST", `/api/qc/eqa/${id}/void`, { reason });
    },
    onSuccess: () => {
      invalidateApi("/api/qc/eqa");
      setVoiding(null);
      toast({ title: "Yozuv bekor qilindi" });
    },
    onError: (err: Error) => setVoidError(err.message),
  });

  return (
    <div className="space-y-4">
      <Toolbar
        title="Laboratoriyalararo sifat nazorati"
        description="Tashqi dastur (EQA / PT) natijalari: z = (bizning natija − belgilangan qiymat) / SD. |z| ≤ 2 qoniqarli, 2–3 shubhali, > 3 qoniqarsiz."
        action={
          can("qc.enter") && (
            <Button className="shrink-0 shadow-brand" onClick={() => setOpen(true)} data-testid="button-add-eqa">
              <Plus className="mr-2 h-4 w-4" />
              Natija yozish
            </Button>
          )
        }
      />
      {live.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {(Object.keys(counts) as EqaEvaluation[]).map((k) => (
            <span key={k} className={cn("rounded-full border px-3 py-1 font-medium", EVAL_TONE[k])}>
              {EQA_EVALUATION_LABELS[k]}: <span className="tabular">{counts[k]}</span>
            </span>
          ))}
        </div>
      )}
      <div className="card-premium overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={3} />
        ) : data.length === 0 ? (
          <EmptyState icon={Globe2} title="Natija yozilmagan" description="Tashqi dastur hisobotidagi belgilangan qiymat va SD bilan har bir namunani yozing." />
        ) : (
          <div className="overflow-x-auto">
            <Table className="table-premium">
              <TableHeader>
                <TableRow>
                  <TableHead>Dastur · tsikl</TableHead>
                  <TableHead>Tahlil</TableHead>
                  <TableHead className="text-right">Bizniki</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Belgilangan ± SD</TableHead>
                  <TableHead className="text-right">z</TableHead>
                  <TableHead>Baho</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((e) => (
                  <TableRow key={e.id} className={cn(e.voidedAt && "opacity-55")} data-testid={`row-eqa-${e.id}`}>
                    <TableCell>
                      <p className="font-medium">{e.provider}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.cycle}
                        {e.sampleCode ? ` · ${e.sampleCode}` : ""} · {formatDate(e.sampleDate)}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {e.testName}
                      {e.deviceName && <span className="block text-xs text-muted-foreground">{e.deviceName}</span>}
                    </TableCell>
                    <TableCell className={cn("text-right font-semibold tabular", e.voidedAt && "line-through")}>{fmtNum(e.reportedValue)}</TableCell>
                    <TableCell className="hidden text-right tabular sm:table-cell">
                      {fmtNum(e.assignedValue)} ± {fmtNum(e.sdpa)}
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {e.z > 0 ? "+" : ""}
                      {e.z.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {e.voidedAt ? (
                        <span className="text-xs text-muted-foreground">Bekor qilingan: {e.voidReason}</span>
                      ) : (
                        <Badge variant="outline" className={cn("font-medium", EVAL_TONE[e.evaluation])}>
                          {EQA_EVALUATION_LABELS[e.evaluation]}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!e.voidedAt && can("qc.manage") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-muted-foreground"
                          onClick={() => {
                            setVoidError(null);
                            setVoiding(e);
                          }}
                          data-testid={`button-eqa-void-${e.id}`}
                        >
                          Bekor qilish
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <FormDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Tashqi nazorat natijasi"
        description="Belgilangan qiymat va SD — dastur provayderi hisobotidan."
        formId="eqa-form"
        pending={save.isPending}
        error={error}
        onSubmit={() => save.mutate()}
        testId="eqa"
      >
        <Field id="eqa-provider" label="Dastur / provayder">
          <Input id="eqa-provider" value={f.provider} onChange={(e) => set("provider", e.target.value)} placeholder="RIQAS, Bio-Rad EQAS…" data-testid="input-eqa-provider" />
        </Field>
        <Field id="eqa-cycle" label="Tsikl">
          <Input id="eqa-cycle" value={f.cycle} onChange={(e) => set("cycle", e.target.value)} placeholder="2026-11" data-testid="input-eqa-cycle" />
        </Field>
        <Field label="Tahlil">
          <TestSelect value={f.testId} onChange={(v) => set("testId", v)} testId="select-eqa-test" />
        </Field>
        <Field id="eqa-code" label="Namuna kodi">
          <Input id="eqa-code" value={f.sampleCode} onChange={(e) => set("sampleCode", e.target.value)} className="font-mono" />
        </Field>
        <Field id="eqa-rep" label="Bizning natija">
          <Input id="eqa-rep" inputMode="decimal" value={f.reportedValue} onChange={(e) => set("reportedValue", e.target.value)} className="tabular" data-testid="input-eqa-reported" />
        </Field>
        <Field id="eqa-date" label="Namuna sanasi">
          <Input id="eqa-date" type="date" value={f.sampleDate} max={today} onChange={(e) => set("sampleDate", e.target.value)} />
        </Field>
        <Field id="eqa-asg" label="Belgilangan qiymat">
          <Input id="eqa-asg" inputMode="decimal" value={f.assignedValue} onChange={(e) => set("assignedValue", e.target.value)} className="tabular" data-testid="input-eqa-assigned" />
        </Field>
        <Field id="eqa-sd" label="SD (baholash uchun)">
          <Input id="eqa-sd" inputMode="decimal" value={f.sdpa} onChange={(e) => set("sdpa", e.target.value)} className="tabular" data-testid="input-eqa-sd" />
        </Field>
        {previewZ !== null && (
          <p className="text-sm sm:col-span-2" data-testid="text-eqa-preview">
            z = <span className="font-semibold tabular">{previewZ > 0 ? "+" : ""}{previewZ.toFixed(2)}</span> →{" "}
            <Badge variant="outline" className={cn("font-medium", EVAL_TONE[eqaEvaluation(previewZ)])}>
              {EQA_EVALUATION_LABELS[eqaEvaluation(previewZ)]}
            </Badge>
          </p>
        )}
        <Field id="eqa-notes" label="Izoh" wide>
          <Textarea id="eqa-notes" value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Ixtiyoriy: shubhali yoki qoniqarsiz bo'lsa, sabab va chora" />
        </Field>
      </FormDialog>

      <TextPromptDialog
        open={!!voiding}
        onOpenChange={(o) => !o && setVoiding(null)}
        title="Natijani bekor qilish"
        description="Yozuv o'chirilmaydi, hisobotlardan chiqariladi."
        label="Sabab"
        confirmLabel="Bekor qilish"
        destructive
        pending={voidIt.isPending}
        error={voidError}
        onConfirm={(reason) => voiding && voidIt.mutate({ id: voiding.id, reason })}
        testId="eqa-void"
      />
    </div>
  );
}
