/**
 * Yotqizish (B6.2, TZ §8.1.2): taking a patient in (patient, free bed,
 * admitting doctor, time), the stay's card (bed periods, move, cancel), the
 * list of patients in hospital, and the patient card's inpatient history.
 * Rules: shared/inpatient.ts.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, ArrowRightLeft, BedSingle, Loader2, LogIn, Stethoscope, UserRound, XCircle } from "lucide-react";
import type { AdmissionView, DoctorWithDetails, Patient, WardView } from "@shared/schema";
import { ADMISSION_STATUS_LABELS, WARD_GENDER_LABELS, stayDay, type AdmissionStatus } from "@shared/inpatient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PatientNumber, TableSkeleton } from "@/components/ui-kit";
import { SearchInput } from "@/components/inputs";
import { TextPromptDialog } from "@/components/qc/qc-ui";
import { apiRequest, invalidateApi } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { dayKey, formatDate, formatDateTime, money } from "@/lib/format";

export const refreshInpatient = () => invalidateApi("/api/wards", "/api/admissions", "/api/patients");

const STATUS_TONE: Record<AdmissionStatus, string> = {
  active: "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300",
  discharged: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  cancelled: "border-border bg-muted text-muted-foreground",
};

/** "2026-11-22T10:30" in the browser's clock, for datetime-local. */
const localInput = (d = new Date()) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};

/** A patient's gender against a ward meant for men or women only. */
function genderClash(ward: WardView | undefined, gender: string | null | undefined): string | null {
  if (!ward || ward.gender === "mixed" || !gender) return null;
  const g = gender.toLowerCase();
  const male = g.startsWith("erk") || g === "male" || g === "m";
  const female = g.startsWith("ayol") || g === "female" || g === "f";
  if ((ward.gender === "male" && female) || (ward.gender === "female" && male)) return `Palata ${ward.name} — ${WARD_GENDER_LABELS[ward.gender].toLowerCase()} uchun`;
  return null;
}

/** Free beds by ward, for a picker. */
function useFreeBeds() {
  const { data: wards = [] } = useQuery<WardView[]>({ queryKey: ["/api/wards"] });
  return useMemo(() => wards.filter((w) => w.isActive).map((w) => ({ ward: w, beds: w.beds.filter((b) => b.isActive && b.display === "ready") })).filter((g) => g.beds.length), [wards]);
}

function BedPicker({ value, onChange, exceptBedId, testId }: { value: string; onChange: (bedId: string) => void; exceptBedId?: string; testId: string }) {
  const groups = useFreeBeds();
  if (!groups.length) return <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Bo'sh yotoq yo'q.</p>;
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm" data-testid={testId}>
      <option value="">Yotoqni tanlang…</option>
      {groups.map(({ ward, beds }) => (
        <optgroup key={ward.id} label={`${ward.departmentName} · palata ${ward.name} (${WARD_GENDER_LABELS[ward.gender].toLowerCase()}, ${money(ward.dayPrice)}/kun)`}>
          {beds
            .filter((b) => b.id !== exceptBedId)
            .map((b) => (
              <option key={b.id} value={b.id}>
                Palata {ward.name} · yotoq {b.label}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------- admit

export function AdmitDialog({ open, onOpenChange, presetBedId, presetPatient }: { open: boolean; onOpenChange: (o: boolean) => void; presetBedId?: string | null; presetPatient?: Patient | null }) {
  const { toast } = useToast();
  const [patient, setPatient] = useState<Patient | null>(presetPatient ?? null);
  const [search, setSearch] = useState("");
  const [bedId, setBedId] = useState(presetBedId ?? "");
  const [doctorId, setDoctorId] = useState("");
  const [at, setAt] = useState(localInput());
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setPatient(presetPatient ?? null);
    setBedId(presetBedId ?? "");
    setAt(localInput());
    setReason("");
    setError(null);
    setSearch("");
  }, [open, presetBedId, presetPatient]);

  const { data: found } = useQuery<{ items: Patient[] }>({ queryKey: [`/api/patients?search=${encodeURIComponent(search.trim())}&limit=8`], enabled: open && !patient });
  const { data: doctors = [] } = useQuery<DoctorWithDetails[]>({ queryKey: ["/api/doctors?active=1"], enabled: open });
  const { data: wards = [] } = useQuery<WardView[]>({ queryKey: ["/api/wards"], enabled: open });
  const ward = wards.find((w) => w.beds.some((b) => b.id === bedId));
  // The ward's own department's doctors first.
  const sortedDoctors = useMemo(() => [...doctors].sort((a, b) => Number(b.departmentId === ward?.departmentId) - Number(a.departmentId === ward?.departmentId)), [doctors, ward]);
  useEffect(() => {
    if (open && !doctorId && sortedDoctors[0]) setDoctorId(sortedDoctors[0].id);
  }, [open, doctorId, sortedDoctors]);
  const clash = genderClash(ward, patient?.gender);

  const admit = useMutation({
    mutationFn: async () => (await (await apiRequest("POST", "/api/admissions", { patientId: patient!.id, bedId, doctorId, admittedAt: new Date(at).toISOString(), reason: reason.trim() || null })).json()) as AdmissionView,
    onSuccess: (a) => {
      refreshInpatient();
      onOpenChange(false);
      toast({ title: `${a.patientName} yotqizildi`, description: `Statsionar karta №${a.number} · palata ${a.current?.wardName}, yotoq ${a.current?.bedLabel}` });
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-lg flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogIn className="h-5 w-5 text-primary" />
            Bemorni yotqizish
          </DialogTitle>
          <DialogDescription>Bemor, bo'sh yotoq, qabul qiluvchi shifokor va yotqizish vaqti (TZ §8.1.2).</DialogDescription>
        </DialogHeader>
        <form
          className="min-h-0 space-y-4 overflow-y-auto px-1"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            admit.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>Bemor</Label>
            {patient ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/[0.04] p-3">
                <p className="flex min-w-0 items-center gap-2 font-medium">
                  <PatientNumber value={patient.patientNumber} size="sm" />
                  <span className="truncate" data-testid="text-admit-patient">
                    {patient.fullName}
                  </span>
                </p>
                {!presetPatient && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setPatient(null)}>
                    O'zgartirish
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <SearchInput value={search} onChange={setSearch} placeholder="Raqam, ism yoki telefon…" data-testid="input-admit-patient-search" />
                <div className="max-h-44 divide-y overflow-auto rounded-xl border">
                  {(found?.items ?? []).length === 0 ? (
                    <p className="p-3 text-center text-sm text-muted-foreground">Bemor topilmadi</p>
                  ) : (
                    found!.items.map((p) => (
                      <button key={p.id} type="button" onClick={() => setPatient(p)} className="flex w-full items-center gap-2 p-2.5 text-left text-sm hover:bg-muted/60" data-testid={`option-admit-patient-${p.patientNumber}`}>
                        <PatientNumber value={p.patientNumber} size="sm" />
                        <span className="truncate">{p.fullName}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Yotoq</Label>
            <BedPicker value={bedId} onChange={setBedId} testId="select-admit-bed" />
            {clash && (
              <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300" data-testid="admit-gender-warning">
                <AlertTriangle className="h-3.5 w-3.5" />
                {clash}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admit-doctor">Qabul qiluvchi shifokor</Label>
            <select id="admit-doctor" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm" data-testid="select-admit-doctor">
              {sortedDoctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullName} — {d.specialty}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admit-at">Yotqizish vaqti</Label>
            <Input id="admit-at" type="datetime-local" value={at} max={localInput()} onChange={(e) => setAt(e.target.value)} data-testid="input-admit-at" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admit-reason">Sabab / dastlabki tashxis</Label>
            <Textarea id="admit-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} data-testid="input-admit-reason" />
          </div>
          {error && (
            <p className="text-sm text-destructive" data-testid="text-admit-error">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" className="shadow-brand" disabled={!patient || !bedId || !doctorId || admit.isPending} data-testid="button-confirm-admit">
              {admit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yotqizish
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- the stay

export function AdmissionDialog({ admissionId, onClose }: { admissionId: string | null; onClose: () => void }) {
  const { can } = useAuth();
  const { toast } = useToast();
  const { data: a } = useQuery<AdmissionView>({ queryKey: [`/api/admissions/${admissionId}`], enabled: Boolean(admissionId), refetchOnMount: "always" });
  const [moving, setMoving] = useState(false);
  const [bedId, setBedId] = useState("");
  const [note, setNote] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const manage = can("admissions.manage") && a?.status === "active";
  useEffect(() => {
    setMoving(false);
    setBedId("");
    setNote("");
    setError(null);
  }, [admissionId]);

  const transfer = useMutation({
    mutationFn: async () => (await (await apiRequest("POST", `/api/admissions/${admissionId}/transfer`, { bedId, note: note.trim() || null })).json()) as AdmissionView,
    onSuccess: (x) => {
      refreshInpatient();
      setMoving(false);
      setBedId("");
      setNote("");
      toast({ title: `${x.patientName} ko'chirildi`, description: `Palata ${x.current?.wardName}, yotoq ${x.current?.bedLabel}` });
    },
    onError: (e: Error) => setError(e.message),
  });
  const cancel = useMutation({
    mutationFn: async (reason: string) => (await (await apiRequest("POST", `/api/admissions/${admissionId}/cancel`, { reason })).json()) as AdmissionView,
    onSuccess: () => {
      refreshInpatient();
      setCancelling(false);
      toast({ title: "Yotqizish bekor qilindi" });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Dialog open={Boolean(admissionId)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-lg flex-col">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <BedSingle className="h-5 w-5 text-primary" />
            {a ? `Statsionar karta №${a.number}` : "Statsionar karta"}
            {a && (
              <Badge variant="outline" className={cn("font-medium", STATUS_TONE[a.status])}>
                {ADMISSION_STATUS_LABELS[a.status]}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>{a ? `${a.departmentName}${a.current ? ` · palata ${a.current.wardName}, yotoq ${a.current.bedLabel}` : ""}` : "Yuklanmoqda…"}</DialogDescription>
        </DialogHeader>
        {a && (
          <div className="min-h-0 space-y-4 overflow-y-auto px-1 text-sm" data-testid="admission-card">
            <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <p className="flex min-w-0 items-center gap-2 font-medium">
                <PatientNumber value={a.patientNumber} size="sm" />
                <span className="truncate">{a.patientName}</span>
              </p>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/patients/${a.patientId}`}>
                  <UserRound className="mr-1.5 h-4 w-4" />
                  Karta
                </Link>
              </Button>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <dt className="text-xs text-muted-foreground">Yotqizilgan</dt>
                <dd className="font-medium">{formatDateTime(a.admittedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Kun</dt>
                <dd className="font-medium" data-testid="admission-day">
                  {a.status === "active" ? `${stayDay(dayKey(new Date(a.admittedAt)), dayKey(new Date()))}-kun` : "—"}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Qabul qiluvchi shifokor</dt>
                <dd className="flex items-center gap-1.5 font-medium">
                  <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
                  {a.doctorName}
                  {a.doctorSpecialty ? <span className="font-normal text-muted-foreground">· {a.doctorSpecialty}</span> : null}
                </dd>
              </div>
              {a.reason && (
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">Sabab / dastlabki tashxis</dt>
                  <dd>{a.reason}</dd>
                </div>
              )}
            </dl>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Yotoqlar</p>
              <ol className="space-y-1.5" data-testid="admission-stays">
                {a.stays.map((s) => (
                  <li key={s.id} className={cn("flex items-start justify-between gap-3 rounded-lg border px-3 py-2", !s.toAt && "border-sky-500/40 bg-sky-500/5")}>
                    <span>
                      <span className="font-medium">
                        Palata {s.wardName} · yotoq {s.bedLabel}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {formatDateTime(s.fromAt)} — {s.toAt ? formatDateTime(s.toAt) : "hozir"}
                        {s.note ? ` · ${s.note}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular">{money(s.dayPrice)}/kun</span>
                  </li>
                ))}
              </ol>
            </div>
            {a.status === "cancelled" && (
              <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                Bekor qilindi: {a.cancelledByName}, {a.cancelledAt ? formatDateTime(a.cancelledAt) : ""} — {a.cancelReason}
              </p>
            )}
            {manage && moving && (
              <div className="space-y-2 rounded-xl border p-3">
                <Label>Yangi yotoq</Label>
                <BedPicker value={bedId} onChange={setBedId} exceptBedId={a.current?.bedId} testId="select-transfer-bed" />
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Sabab (ixtiyoriy)" maxLength={300} data-testid="input-transfer-note" />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setMoving(false)}>
                    Bekor
                  </Button>
                  <Button size="sm" disabled={!bedId || transfer.isPending} onClick={() => transfer.mutate()} data-testid="button-confirm-transfer">
                    {transfer.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                    Ko'chirish
                  </Button>
                </div>
              </div>
            )}
            {error && (
              <p className="text-sm text-destructive" data-testid="text-admission-error">
                {error}
              </p>
            )}
          </div>
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          {manage ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMoving(true)} disabled={moving} data-testid="button-transfer">
                <ArrowRightLeft className="mr-1.5 h-4 w-4" />
                Ko'chirish
              </Button>
              <Button variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => setCancelling(true)} data-testid="button-cancel-admission">
                <XCircle className="mr-1.5 h-4 w-4" />
                Bekor qilish
              </Button>
            </div>
          ) : (
            <span />
          )}
          <Button variant="outline" onClick={onClose}>
            Yopish
          </Button>
        </DialogFooter>
      </DialogContent>
      <TextPromptDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title="Yotqizish bekor qilinsinmi?"
        description="Faqat xato yotqizilgan bo'lsa. Yozuv o'chirilmaydi, yotoq bo'shaydi. Bemorni chiqarish — kasallik tarixi va epikriz bilan (B6.7)."
        label="Sabab"
        confirmLabel="Bekor qilish"
        destructive
        pending={cancel.isPending}
        error={error}
        onConfirm={(r) => cancel.mutate(r)}
        testId="admission-cancel"
      />
    </Dialog>
  );
}

// ---------------------------------------------------------------- patients in hospital

export function AdmissionsTab({ onOpen }: { onOpen: (id: string) => void }) {
  const { data: rows = [], isLoading } = useQuery<AdmissionView[]>({ queryKey: ["/api/admissions?status=active"], refetchOnMount: "always", refetchInterval: 30_000 });
  const [search, setSearch] = useState("");
  const today = dayKey(new Date());
  const q = search.trim().toLowerCase();
  const shown = rows.filter((a) => !q || a.patientName.toLowerCase().includes(q) || String(a.patientNumber) === q.replace("#", "") || (a.current?.wardName ?? "").toLowerCase() === q);
  return (
    <div className="space-y-3" data-testid="admissions-tab">
      <div className="card-premium flex items-center justify-between gap-3 p-3">
        <p className="text-sm text-muted-foreground">
          Statsionarda: <span className="font-semibold text-foreground tabular">{rows.length}</span> ta bemor
        </p>
        <SearchInput value={search} onChange={setSearch} placeholder="Bemor, ID yoki palata…" className="w-full max-w-xs" data-testid="input-search-admissions" />
      </div>
      <div className="card-premium overflow-hidden">
        {isLoading ? (
          <TableSkeleton />
        ) : shown.length === 0 ? (
          <EmptyState icon={BedSingle} title="Statsionarda bemor yo'q" description={rows.length ? "Qidiruv bo'yicha topilmadi." : "“Yotqizish” bilan bemorni bo'sh yotoqqa yotqizing."} />
        ) : (
          <div className="overflow-x-hidden md:overflow-x-auto">
            <Table className="table-premium">
              <TableHeader>
                <TableRow>
                  <TableHead>Bemor</TableHead>
                  <TableHead>Joy</TableHead>
                  <TableHead className="hidden md:table-cell">Shifokor</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Yotqizilgan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((a) => (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => onOpen(a.id)} data-testid={`row-admission-${a.number}`}>
                    <TableCell>
                      <p className="font-medium">{a.patientName}</p>
                      <p className="text-xs text-muted-foreground tabular">
                        #{a.patientNumber} · karta №{a.number}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{a.current ? `${a.current.wardName} / ${a.current.bedLabel}` : "—"}</p>
                      <p className="text-xs text-muted-foreground">{a.departmentName}</p>
                    </TableCell>
                    <TableCell className="hidden text-sm md:table-cell">{a.doctorName}</TableCell>
                    <TableCell className="hidden text-right sm:table-cell">
                      <p className="tabular">{formatDate(a.admittedAt)}</p>
                      <p className="text-xs text-muted-foreground">{stayDay(dayKey(new Date(a.admittedAt)), today)}-kun</p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

/** The patient card's inpatient history (TZ §4.2 / B2.4: "statsionar tarixi"). */
export function PatientAdmissions({ patientId }: { patientId: string }) {
  const { data: rows = [], isLoading } = useQuery<AdmissionView[]>({ queryKey: [`/api/admissions?patientId=${patientId}`], refetchOnMount: "always" });
  const [open, setOpen] = useState<string | null>(null);
  if (isLoading) return <div className="h-32 skeleton-shimmer rounded-xl" />;
  if (!rows.length) return <EmptyState icon={BedSingle} title="Statsionar tarixi yo'q" description="Bemor statsionarga yotqizilmagan." />;
  return (
    <>
      <ul className="divide-y rounded-xl border" data-testid="patient-admissions">
        {rows.map((a) => (
          <li key={a.id}>
            <button type="button" onClick={() => setOpen(a.id)} className="flex w-full items-start justify-between gap-3 p-3 text-left hover:bg-muted/50">
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  Statsionar karta №{a.number}
                  <Badge variant="outline" className={cn("text-[10px] font-medium", STATUS_TONE[a.status])}>
                    {ADMISSION_STATUS_LABELS[a.status]}
                  </Badge>
                </span>
                <span className="block text-xs text-muted-foreground">
                  {a.departmentName} · {a.stays.map((s) => `palata ${s.wardName}`).filter((v, i, xs) => xs.indexOf(v) === i).join(" → ")} · {a.doctorName}
                </span>
              </span>
              <span className="shrink-0 text-right text-xs text-muted-foreground tabular">
                {formatDate(a.admittedAt)}
                {a.dischargedAt ? ` — ${formatDate(a.dischargedAt)}` : a.status === "active" ? " — hozir" : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <AdmissionDialog admissionId={open} onClose={() => setOpen(null)} />
    </>
  );
}
