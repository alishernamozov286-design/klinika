/**
 * Statsionar (TZ §8). B6.1: palatalar va yotoqlar — the structure (inpatient
 * department → ward → bed, with the bed-day price) and the bed board. A bed's
 * colour comes with an icon and a word, never colour alone. Rules:
 * shared/inpatient.ts.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { BedDouble, BedSingle, Brush, Building2, CheckCircle2, Loader2, LogIn, MoreHorizontal, Pencil, Plus, Trash2, UserRound, Wrench } from "lucide-react";
import type { BedView, Department, WardView } from "@shared/schema";
import {
  BED_DISPLAY_LABELS,
  BED_STATES,
  BED_STATE_LABELS,
  MAX_BEDS_PER_WARD,
  WARD_GENDERS,
  WARD_GENDER_LABELS,
  countBeds,
  occupancy,
  type BedDisplay,
  type BedState,
  type WardGender,
} from "@shared/inpatient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState, PageHeader, StatCard } from "@/components/ui-kit";
import { MoneyInput } from "@/components/inputs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdmissionDialog, AdmissionsTab, AdmitDialog } from "@/components/inpatient/admissions";
import { apiRequest, invalidateApi } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDateTime, money } from "@/lib/format";

/** Status colours (reserved) each with its own icon. */
const DISPLAY_STYLE: Record<BedDisplay, { tile: string; icon: typeof BedSingle }> = {
  ready: { tile: "border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300", icon: CheckCircle2 },
  occupied: { tile: "border-sky-500/40 bg-sky-500/15 text-sky-900 dark:text-sky-200", icon: UserRound },
  cleaning: { tile: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300", icon: Brush },
  maintenance: { tile: "border-rose-500/35 bg-rose-500/10 text-rose-800 dark:text-rose-300", icon: Wrench },
};
type Filter = "all" | BedDisplay;
const refresh = () => invalidateApi("/api/wards", "/api/admissions");

export default function Inpatient() {
  const { can } = useAuth();
  const manage = can("beds.manage");
  const { data: wards = [], isLoading } = useQuery<WardView[]>({ queryKey: ["/api/wards"], refetchOnMount: "always", refetchInterval: 30_000 });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });
  const inpatientDepts = departments.filter((d) => d.kind === "statsionar" && d.isActive);
  const [dept, setDept] = useState<string>("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [wardDialog, setWardDialog] = useState<{ open: boolean; ward: WardView | null }>({ open: false, ward: null });
  const [adding, setAdding] = useState<WardView | null>(null);
  const [bed, setBed] = useState<{ bed: BedView; ward: WardView } | null>(null);
  const [tab, setTab] = useState<"patients" | "beds">(() => (new URLSearchParams(window.location.search).get("tab") === "beds" ? "beds" : "patients"));
  const [admitting, setAdmitting] = useState<{ open: boolean; bedId: string | null }>({ open: false, bedId: null });
  const [stay, setStay] = useState<string | null>(null);
  const { toast } = useToast();

  const allBeds = wards.filter((w) => w.isActive).flatMap((w) => w.beds);
  const counts = countBeds(allBeds);
  const occ = occupancy(counts);
  const visible = wards.filter((w) => (showInactive || w.isActive) && (dept === "all" || w.departmentId === dept));
  const byDept = useMemo(() => {
    const m = new Map<string, { name: string; wards: WardView[] }>();
    for (const w of visible) {
      const g = m.get(w.departmentId) ?? { name: w.departmentName, wards: [] };
      g.wards.push(w);
      m.set(w.departmentId, g);
    }
    return [...m.entries()];
  }, [visible]);

  const removeWard = useMutation({
    mutationFn: async (w: WardView) => apiRequest("DELETE", `/api/wards/${w.id}`),
    onSuccess: () => {
      refresh();
      toast({ title: "Palata o'chirildi" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "O'chirilmadi", description: e.message }),
  });
  const toggleWard = useMutation({
    mutationFn: async (w: WardView) => apiRequest("PATCH", `/api/wards/${w.id}`, { isActive: !w.isActive }),
    onSuccess: () => refresh(),
    onError: (e: Error) => toast({ variant: "destructive", title: "Bajarilmadi", description: e.message }),
  });

  const filters: { key: Filter; label: string; n: number }[] = [
    { key: "all", label: "Hammasi", n: counts.total },
    { key: "ready", label: BED_DISPLAY_LABELS.ready, n: counts.free },
    { key: "occupied", label: BED_DISPLAY_LABELS.occupied, n: counts.occupied },
    { key: "cleaning", label: BED_DISPLAY_LABELS.cleaning, n: counts.cleaning },
    { key: "maintenance", label: BED_DISPLAY_LABELS.maintenance, n: counts.maintenance },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Statsionar"
        title="Statsionar"
        description="Statsionardagi bemorlar, yotqizish va ko'chirish, palatalar va yotoqlar (TZ §8)"
        actions={
          <div className="flex flex-wrap gap-2">
            {can("admissions.manage") && counts.free > 0 && (
              <Button className="shadow-brand" onClick={() => setAdmitting({ open: true, bedId: null })} data-testid="button-admit">
                <LogIn className="mr-2 h-4 w-4" />
                Yotqizish
              </Button>
            )}
            {manage && inpatientDepts.length > 0 && (
              <Button variant="outline" onClick={() => setWardDialog({ open: true, ward: null })} data-testid="button-add-ward">
                <Plus className="mr-2 h-4 w-4" />
                Palata qo'shish
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <StatCard index={0} label="Yotoqlar" value={counts.total} hint={`${wards.filter((w) => w.isActive).length} ta palatada`} icon={BedDouble} isLoading={isLoading} />
        <StatCard index={1} label="Bo'sh" value={counts.free} hint="Bemor qabul qilishga tayyor" icon={CheckCircle2} tone="emerald" isLoading={isLoading} onClick={() => setFilter("ready")} />
        <StatCard index={2} label="Band" value={counts.occupied} hint={occ !== null ? `Bandlik ${occ}%` : "Yotoq yo'q"} icon={UserRound} tone="violet" isLoading={isLoading} onClick={() => setFilter("occupied")} />
        <StatCard
          index={3}
          label="Tozalanmoqda / ta'mirda"
          value={`${counts.cleaning} / ${counts.maintenance}`}
          hint="Hozircha ishlatib bo'lmaydi"
          icon={Wrench}
          tone={counts.cleaning + counts.maintenance ? "amber" : "emerald"}
          isLoading={isLoading}
          onClick={() => setFilter(counts.maintenance ? "maintenance" : "cleaning")}
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "patients" | "beds")}>
        <TabsList>
          <TabsTrigger value="patients" data-testid="tab-inpatient-patients">
            Bemorlar
          </TabsTrigger>
          <TabsTrigger value="beds" data-testid="tab-inpatient-beds">
            Palata va yotoqlar
          </TabsTrigger>
        </TabsList>
        <TabsContent value="patients" className="mt-4">
          <AdmissionsTab onOpen={setStay} />
        </TabsContent>
        <TabsContent value="beds" className="mt-4 space-y-6">
      {!isLoading && inpatientDepts.length === 0 && wards.length === 0 ? (
        <div className="card-premium">
          <EmptyState
            icon={Building2}
            title="Statsionar bo'lim yo'q"
            description="Palata qo'shish uchun avval turi “Statsionar” bo'lgan bo'lim yarating."
            action={
              can("departments.manage") ? (
                <Button asChild variant="outline">
                  <Link href="/departments">Klinika → Bo'limlar</Link>
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <div className="card-premium flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Yotoq holati">
              {filters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", filter === f.key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40")}
                  data-testid={`bed-filter-${f.key}`}
                >
                  {f.label} <span className="tabular opacity-80">({f.n})</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {inpatientDepts.length > 1 && (
                <select value={dept} onChange={(e) => setDept(e.target.value)} className="h-8 rounded-md border bg-card px-2 text-xs" aria-label="Bo'lim" data-testid="select-ward-department">
                  <option value="all">Barcha bo'limlar</option>
                  {inpatientDepts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              )}
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="accent-primary" />
                Faolsizlarni ko'rsatish
              </label>
            </div>
          </div>

          {isLoading ? (
            <div className="h-64 skeleton-shimmer rounded-2xl" />
          ) : byDept.length === 0 ? (
            <div className="card-premium">
              <EmptyState icon={BedDouble} title="Palata yo'q" description={manage ? "“Palata qo'shish” bilan birinchi palatani va uning yotoqlarini yarating." : "Palatalar hali kiritilmagan."} />
            </div>
          ) : (
            byDept.map(([id, g]) => (
              <section key={id} className="space-y-3" data-testid={`dept-${id}`}>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  {g.name}
                </h2>
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {g.wards.map((w) => {
                    const c = countBeds(w.beds);
                    const beds = w.beds.filter((b) => (showInactive || b.isActive) && (filter === "all" || b.display === filter));
                    return (
                      <article key={w.id} className={cn("card-premium flex flex-col p-4", !w.isActive && "opacity-60")} data-testid={`ward-${w.name}`}>
                        <header className="mb-3 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="flex flex-wrap items-center gap-2 font-semibold">
                              Palata {w.name}
                              <Badge variant="outline" className="text-[10px] font-medium">
                                {WARD_GENDER_LABELS[w.gender]}
                              </Badge>
                              {!w.isActive && (
                                <Badge variant="outline" className="text-[10px]">
                                  faolsiz
                                </Badge>
                              )}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {w.floor !== null ? `${w.floor}-qavat · ` : ""}yotoq-kun {money(w.dayPrice)} · {c.free}/{c.total} bo'sh
                            </p>
                          </div>
                          {manage && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Palata amallari" data-testid={`ward-menu-${w.name}`}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setWardDialog({ open: true, ward: w })}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Tahrirlash
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setAdding(w)} data-testid={`ward-add-beds-${w.name}`}>
                                  <Plus className="mr-2 h-4 w-4" />
                                  Yotoq qo'shish
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toggleWard.mutate(w)}>{w.isActive ? "Faolsizlantirish" : "Faollashtirish"}</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" disabled={w.beds.length > 0} onClick={() => removeWard.mutate(w)}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  O'chirish{w.beds.length ? " (yotoqlar bor)" : ""}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </header>
                        {w.beds.length === 0 ? (
                          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                            Yotoq yo'q
                            {manage && (
                              <Button size="sm" variant="outline" onClick={() => setAdding(w)}>
                                <Plus className="mr-1.5 h-4 w-4" />
                                Yotoq qo'shish
                              </Button>
                            )}
                          </div>
                        ) : beds.length === 0 ? (
                          <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">Bu holatda yotoq yo'q</p>
                        ) : (
                          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                            {beds.map((b) => {
                              const st = DISPLAY_STYLE[b.display];
                              const Icon = st.icon;
                              return (
                                <button
                                  key={b.id}
                                  type="button"
                                  onClick={() => (b.occupant ? setStay(b.occupant.admissionId) : setBed({ bed: b, ward: w }))}
                                  className={cn("flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-center transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", st.tile, !b.isActive && "border-dashed opacity-50")}
                                  aria-label={`Yotoq ${b.label}: ${BED_DISPLAY_LABELS[b.display]}`}
                                  data-testid={`bed-${w.name}-${b.label}`}
                                >
                                  <span className="flex items-center gap-1 text-sm font-semibold">
                                    <BedSingle className="h-4 w-4" />
                                    {b.label}
                                  </span>
                                  <span className="flex items-center gap-1 text-[10px] font-medium leading-tight">
                                    <Icon className="h-3 w-3 shrink-0" />
                                    <span className="line-clamp-1">{b.occupant ? b.occupant.patientName.split(" ")[0] : BED_DISPLAY_LABELS[b.display]}</span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </>
      )}

        </TabsContent>
      </Tabs>

      <WardDialog open={wardDialog.open} ward={wardDialog.ward} departments={inpatientDepts} onOpenChange={(o) => setWardDialog((s) => ({ ...s, open: o }))} />
      <AddBedsDialog ward={adding} onClose={() => setAdding(null)} />
      <BedDialog
        target={bed}
        onClose={() => setBed(null)}
        onAdmit={(bedId) => {
          setBed(null);
          setAdmitting({ open: true, bedId });
        }}
      />
      <AdmitDialog open={admitting.open} presetBedId={admitting.bedId} onOpenChange={(o) => setAdmitting((s) => ({ ...s, open: o }))} />
      <AdmissionDialog admissionId={stay} onClose={() => setStay(null)} />
    </div>
  );
}

// ---------------------------------------------------------------- dialogs

function WardDialog({ open, ward, departments, onOpenChange }: { open: boolean; ward: WardView | null; departments: Department[]; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const editing = Boolean(ward);
  const [form, setForm] = useState({ departmentId: "", name: "", floor: "", gender: "mixed" as WardGender, dayPrice: 0, note: "", beds: 4 });
  const [error, setError] = useState<string | null>(null);
  const [seenFor, setSeenFor] = useState<string | null | undefined>(undefined);
  // Reset the form each time the dialog opens for a (different) ward.
  if (open && seenFor !== (ward?.id ?? null)) {
    setSeenFor(ward?.id ?? null);
    setError(null);
    setForm(
      ward
        ? { departmentId: ward.departmentId, name: ward.name, floor: ward.floor === null ? "" : String(ward.floor), gender: ward.gender, dayPrice: ward.dayPrice, note: ward.note ?? "", beds: 0 }
        : { departmentId: departments[0]?.id ?? "", name: "", floor: "", gender: "mixed", dayPrice: 0, note: "", beds: 4 },
    );
  }
  if (!open && seenFor !== undefined) setSeenFor(undefined);

  const save = useMutation({
    mutationFn: async () => {
      const body = { departmentId: form.departmentId, name: form.name, floor: form.floor === "" ? null : Number(form.floor), gender: form.gender, dayPrice: form.dayPrice, note: form.note.trim() || null };
      const w = (await (await apiRequest(editing ? "PATCH" : "POST", editing ? `/api/wards/${ward!.id}` : "/api/wards", body)).json()) as WardView;
      if (!editing && form.beds > 0) await apiRequest("POST", `/api/wards/${w.id}/beds`, { count: form.beds });
      return w;
    },
    onSuccess: (w) => {
      refresh();
      onOpenChange(false);
      toast({ title: editing ? `Palata ${w.name} saqlandi` : `Palata ${w.name} qo'shildi`, description: !editing && form.beds ? `${form.beds} ta yotoq bilan` : undefined });
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? `Palata ${ward!.name}` : "Yangi palata"}</DialogTitle>
          <DialogDescription>Yotoq-kun narxi statsionar hisobvarag'iga shu narx bilan tushadi.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            save.mutate();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ward-department">Bo'lim</Label>
              <select id="ward-department" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm" data-testid="select-ward-dept">
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ward-name">Raqami yoki nomi</Label>
              <Input id="ward-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={40} placeholder="101" data-testid="input-ward-name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ward-floor">Qavat</Label>
              <Input id="ward-floor" inputMode="numeric" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value.replace(/[^\d-]/g, "") })} placeholder="1" data-testid="input-ward-floor" />
            </div>
            <div className="space-y-1.5">
              <Label>Kimlar uchun</Label>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Kimlar uchun">
                {WARD_GENDERS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={form.gender === g}
                    onClick={() => setForm({ ...form, gender: g })}
                    className={cn("rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors", form.gender === g ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40")}
                    data-testid={`ward-gender-${g}`}
                  >
                    {WARD_GENDER_LABELS[g]}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ward-price">Yotoq-kun narxi</Label>
              <MoneyInput id="ward-price" value={form.dayPrice} onChange={(v) => setForm({ ...form, dayPrice: v })} data-testid="input-ward-price" />
            </div>
            {!editing && (
              <div className="space-y-1.5">
                <Label htmlFor="ward-beds">Yotoqlar soni</Label>
                <Input id="ward-beds" inputMode="numeric" value={form.beds || ""} onChange={(e) => setForm({ ...form, beds: Math.min(MAX_BEDS_PER_WARD, Number(e.target.value.replace(/\D/g, "")) || 0) })} placeholder="0" data-testid="input-ward-beds" />
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ward-note">Izoh</Label>
              <Textarea id="ward-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} maxLength={300} />
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive" data-testid="text-ward-error">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" className="shadow-brand" disabled={save.isPending || !form.name.trim() || !form.departmentId} data-testid="button-save-ward">
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Saqlash
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddBedsDialog({ ward, onClose }: { ward: WardView | null; onClose: () => void }) {
  const { toast } = useToast();
  const [count, setCount] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const add = useMutation({
    mutationFn: async () => (await (await apiRequest("POST", `/api/wards/${ward!.id}/beds`, { count })).json()) as WardView,
    onSuccess: (w) => {
      refresh();
      onClose();
      setCount(1);
      toast({ title: `Palata ${w.name}: ${count} ta yotoq qo'shildi` });
    },
    onError: (e: Error) => setError(e.message),
  });
  return (
    <Dialog open={Boolean(ward)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Palata {ward?.name}: yotoq qo'shish</DialogTitle>
          <DialogDescription>Raqamlar palatadagi oxirgi raqamdan davom etadi. Palatada ko'pi bilan {MAX_BEDS_PER_WARD} ta yotoq.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="beds-count">Nechta</Label>
          <Input id="beds-count" inputMode="numeric" value={count || ""} onChange={(e) => setCount(Math.min(MAX_BEDS_PER_WARD, Number(e.target.value.replace(/\D/g, "")) || 0))} data-testid="input-beds-count" />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button className="shadow-brand" disabled={!count || add.isPending} onClick={() => add.mutate()} data-testid="button-confirm-add-beds">
            {add.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Qo'shish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const STATE_ICON: Record<BedState, typeof BedSingle> = { ready: CheckCircle2, cleaning: Brush, maintenance: Wrench };

function BedDialog({ target, onClose, onAdmit }: { target: { bed: BedView; ward: WardView } | null; onClose: () => void; onAdmit: (bedId: string) => void }) {
  const { can } = useAuth();
  const { toast } = useToast();
  const manage = can("beds.manage");
  const setsState = can("beds.state") || manage;
  const [state, setState] = useState<BedState | null>(null);
  const [note, setNote] = useState("");
  const [label, setLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const b = target?.bed;
  const chosen = state ?? b?.state ?? "ready";
  const reset = () => {
    setState(null);
    setNote("");
    setLabel(null);
    setError(null);
  };
  const close = () => {
    reset();
    onClose();
  };
  const done = (title: string) => {
    refresh();
    toast({ title });
    close();
  };
  const saveState = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/beds/${b!.id}/state`, { state: chosen, note: note.trim() || null }),
    onSuccess: () => done(`Yotoq ${b!.label}: ${BED_STATE_LABELS[chosen].toLowerCase()}`),
    onError: (e: Error) => setError(e.message),
  });
  const saveBed = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => apiRequest("PATCH", `/api/beds/${b!.id}`, patch),
    onSuccess: () => done(`Yotoq ${label ?? b!.label} saqlandi`),
    onError: (e: Error) => setError(e.message),
  });
  const remove = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/beds/${b!.id}`),
    onSuccess: () => done(`Yotoq ${b!.label} o'chirildi`),
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BedSingle className="h-5 w-5 text-primary" />
            Palata {target?.ward.name} · yotoq {b?.label}
          </DialogTitle>
          <DialogDescription>
            {b ? BED_DISPLAY_LABELS[b.display] : ""}
            {b?.stateChangedAt ? ` · ${formatDateTime(b.stateChangedAt)}, ${b.stateChangedByName ?? "—"}` : ""}
            {b?.stateNote ? ` — ${b.stateNote}` : ""}
          </DialogDescription>
        </DialogHeader>
        {b && can("admissions.manage") && b.display === "ready" && b.isActive && target?.ward.isActive && (
          <Button className="w-full shadow-brand" onClick={() => onAdmit(b.id)} data-testid="button-admit-here">
            <LogIn className="mr-2 h-4 w-4" />
            Shu yotoqqa yotqizish
          </Button>
        )}
        {b && setsState && b.display !== "occupied" && (
          <div className="space-y-3">
            <Label>Holati</Label>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Yotoq holati">
              {BED_STATES.map((s) => {
                const Icon = STATE_ICON[s];
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={chosen === s}
                    onClick={() => setState(s)}
                    className={cn("flex flex-col items-center gap-1 rounded-lg border p-2.5 text-xs font-medium transition-colors", chosen === s ? DISPLAY_STYLE[s].tile + " ring-2 ring-primary/40" : "bg-card hover:border-primary/40")}
                    data-testid={`bed-state-${s}`}
                  >
                    <Icon className="h-4 w-4" />
                    {BED_STATE_LABELS[s]}
                  </button>
                );
              })}
            </div>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300} placeholder={chosen === "maintenance" ? "Nima buzilgan (majburiy)" : "Izoh (ixtiyoriy)"} data-testid="input-bed-note" />
            <Button className="w-full shadow-brand" disabled={saveState.isPending || chosen === b.state || (chosen === "maintenance" && !note.trim())} onClick={() => saveState.mutate()} data-testid="button-save-bed-state">
              {saveState.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Holatni saqlash
            </Button>
          </div>
        )}
        {b && manage && (
          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="bed-label">Yotoq raqami</Label>
            <div className="flex gap-2">
              <Input id="bed-label" value={label ?? b.label} onChange={(e) => setLabel(e.target.value)} maxLength={10} className="w-28" data-testid="input-bed-label" />
              <Button variant="outline" disabled={!label || label === b.label || saveBed.isPending} onClick={() => saveBed.mutate({ label })}>
                Saqlash
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => saveBed.mutate({ isActive: !b.isActive })} data-testid="button-toggle-bed">
                {b.isActive ? "Faolsizlantirish" : "Faollashtirish"}
              </Button>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => remove.mutate()} data-testid="button-delete-bed">
                <Trash2 className="mr-1.5 h-4 w-4" />
                O'chirish
              </Button>
            </div>
          </div>
        )}
        {error && (
          <p className="text-sm text-destructive" data-testid="text-bed-error">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Yopish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
