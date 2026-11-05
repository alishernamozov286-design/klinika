import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BedDouble,
  Building2,
  CalendarClock,
  DoorOpen,
  FlaskConical,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Power,
  ScanLine,
  Sparkles,
  Stethoscope,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  DEPARTMENT_KINDS,
  DEPARTMENT_KIND_LABELS,
  WEEKDAYS,
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
  insertDepartmentSchema,
  insertDoctorSchema,
  type DepartmentKind,
  type DepartmentWithUsage,
  type DoctorWithDetails,
  type ScheduleSlot,
} from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, EmptyState, Money, RoleBadge, TableSkeleton } from "@/components/ui-kit";
import { MoneyInput, SearchInput } from "@/components/inputs";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { apiRequest, invalidateApi } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

// ================================================================ departments

const KIND_ICONS: Record<DepartmentKind, LucideIcon> = {
  ambulator: Stethoscope,
  diagnostika: ScanLine,
  laboratoriya: FlaskConical,
  statsionar: BedDouble,
  boshqa: Building2,
};

const KIND_TONES: Record<DepartmentKind, string> = {
  ambulator: "bg-sky-500/10 text-sky-700 border-sky-500/25 dark:text-sky-300",
  diagnostika: "bg-violet-500/10 text-violet-700 border-violet-500/25 dark:text-violet-300",
  laboratoriya: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-300",
  statsionar: "bg-rose-500/10 text-rose-700 border-rose-500/25 dark:text-rose-300",
  boshqa: "bg-slate-500/10 text-slate-700 border-slate-500/25 dark:text-slate-300",
};

/** A starting set for a clinic setting up from nothing; every one is editable afterwards. */
const SAMPLE_DEPARTMENTS: { name: string; kind: DepartmentKind; description: string }[] = [
  { name: "Terapiya", kind: "ambulator", description: "Umumiy amaliyot va terapevt qabuli" },
  { name: "Laboratoriya", kind: "laboratoriya", description: "Klinik va biokimyoviy tahlillar" },
  { name: "UZI diagnostika", kind: "diagnostika", description: "Ultratovush tekshiruvlari" },
  { name: "Statsionar", kind: "statsionar", description: "Yotib davolanish bo'limi" },
];

/**
 * Sozlamalar → Bo'limlar (TZ §10 `departments`).
 *
 * A department in use is closed rather than deleted: its doctors keep their
 * history and the reports keep their grouping. Deletion is only offered for an
 * empty one, typically a typo.
 */
export function DepartmentsPanel() {
  const { toast } = useToast();
  const { data: list = [], isLoading } = useQuery<DepartmentWithUsage[]>({ queryKey: ["/api/departments"] });
  const [editing, setEditing] = useState<DepartmentWithUsage | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<DepartmentWithUsage | null>(null);

  const toggle = useMutation({
    mutationFn: async (d: DepartmentWithUsage) => {
      await apiRequest("PATCH", `/api/departments/${d.id}`, { isActive: !d.isActive });
      return d;
    },
    onSuccess: (d) => {
      invalidateApi("/api/departments", "/api/doctors");
      toast({ title: d.isActive ? `"${d.name}" yopildi` : `"${d.name}" qayta ochildi` });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Saqlanmadi", description: err.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/departments/${id}`);
    },
    onSuccess: () => {
      invalidateApi("/api/departments");
      toast({ title: "Bo'lim o'chirildi" });
      setDeleting(null);
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "O'chirilmadi", description: err.message }),
  });

  const seed = useMutation({
    mutationFn: async () => {
      // One at a time: each is its own audited create, and a name that
      // already exists should not stop the rest.
      for (const d of SAMPLE_DEPARTMENTS) {
        await apiRequest("POST", "/api/departments", d).catch(() => undefined);
      }
    },
    onSuccess: () => {
      invalidateApi("/api/departments");
      toast({ title: "Namuna bo'limlar qo'shildi", description: "Ularni o'zingizga moslab tahrirlashingiz mumkin" });
    },
  });

  const active = list.filter((d) => d.isActive).length;

  return (
    <div className="space-y-4">
      <div className="card-premium flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium">Klinika bo'limlari</p>
          <p className="text-sm text-muted-foreground">
            Shifokorlar, navbat va statsionar palatalari shu bo'limlarga bog'lanadi.
            {list.length > 0 && ` ${active} ta faol, ${list.length - active} ta yopilgan.`}
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="shrink-0 shadow-brand"
          data-testid="button-add-department"
        >
          <Plus className="mr-2 h-4 w-4" />
          Yangi bo'lim
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card-premium h-40 skeleton-shimmer" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="card-premium">
          <EmptyState
            icon={Building2}
            title="Hali bo'lim yo'q"
            description="Bo'limlarni o'zingiz qo'shing yoki namunaviy to'plamdan boshlang: Terapiya, Laboratoriya, UZI diagnostika, Statsionar."
            action={
              <Button variant="outline" onClick={() => seed.mutate()} disabled={seed.isPending}>
                {seed.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Namuna bo'limlarni qo'shish
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((d) => {
            const Icon = KIND_ICONS[d.kind] ?? Building2;
            return (
              <article
                key={d.id}
                className={cn("card-premium flex flex-col p-5", !d.isActive && "opacity-60")}
                data-testid={`card-department-${d.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className={cn("icon-tile h-11 w-11 shrink-0 border", KIND_TONES[d.kind])}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[15px] font-semibold">{d.name}</h3>
                    <p className="text-xs text-muted-foreground">{DEPARTMENT_KIND_LABELS[d.kind]}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="-mr-2 -mt-1 h-8 w-8" aria-label="Amallar">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditing(d);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Tahrirlash
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggle.mutate(d)}>
                        <Power className="mr-2 h-4 w-4" />
                        {d.isActive ? "Yopish" : "Qayta ochish"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        disabled={d.doctorCount > 0}
                        onClick={() => setDeleting(d)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {d.doctorCount > 0 ? "O'chirish (shifokorlari bor)" : "O'chirish"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
                  {d.description || "Tavsif kiritilmagan"}
                </p>
                <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span className="tabular">{d.doctorCount}</span> ta shifokor
                  </span>
                  {d.isActive ? (
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Faol
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Yopilgan</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <DepartmentDialog open={open} onOpenChange={setOpen} department={editing} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Bo'limni o'chirish"
        description={
          <>
            <b>{deleting?.name}</b> bo'limi butunlay o'chiriladi.
          </>
        }
        confirmLabel="O'chirish"
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        isPending={remove.isPending}
      />
    </div>
  );
}

function DepartmentDialog({
  open,
  onOpenChange,
  department,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  department: DepartmentWithUsage | null;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<DepartmentKind>("ambulator");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(department?.name ?? "");
    setKind(department?.kind ?? "ambulator");
    setDescription(department?.description ?? "");
    setError(null);
  }, [open, department]);

  const save = useMutation({
    mutationFn: async () => {
      const parsed = insertDepartmentSchema.safeParse({ name, kind, description: description.trim() || null });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
      const { isActive: _keep, ...body } = parsed.data;
      if (department) await apiRequest("PATCH", `/api/departments/${department.id}`, body);
      else await apiRequest("POST", "/api/departments", body);
    },
    onSuccess: () => {
      invalidateApi("/api/departments", "/api/doctors");
      toast({ title: department ? "Bo'lim yangilandi" : "Bo'lim qo'shildi" });
      onOpenChange(false);
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{department ? "Bo'limni tahrirlash" : "Yangi bo'lim"}</DialogTitle>
          <DialogDescription>Bo'lim turi u keyinchalik qaysi modullarda ishlatilishini belgilaydi.</DialogDescription>
        </DialogHeader>
        <form
          id="department-form"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="dept-name">Nomi</Label>
            <Input
              id="dept-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Masalan: Kardiologiya"
              data-testid="input-department-name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Turi</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as DepartmentKind)}>
              <SelectTrigger data-testid="select-department-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENT_KINDS.map((k) => {
                  const Icon = KIND_ICONS[k];
                  return (
                    <SelectItem key={k} value={k}>
                      <span className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        {DEPARTMENT_KIND_LABELS[k]}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dept-description">Tavsif</Label>
            <Textarea
              id="dept-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Ixtiyoriy"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button type="submit" form="department-form" disabled={save.isPending} data-testid="button-save-department">
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================================================================== doctors

/** Suggestions only — the field accepts any specialty the clinic has. */
const SPECIALTIES = [
  "Terapevt",
  "Kardiolog",
  "Nevrolog",
  "Endokrinolog",
  "Gastroenterolog",
  "Pediatr",
  "Ginekolog",
  "Urolog",
  "LOR (otorinolaringolog)",
  "Oftalmolog",
  "Dermatolog",
  "Xirurg",
  "Travmatolog",
  "UZI shifokori",
  "Rentgenolog",
  "Laborant-shifokor",
];

const SLOT_OPTIONS = [10, 15, 20, 30, 40, 45, 60];

/** Mon–Sat 08:00–17:00, the most common shape; a starting point, not a rule. */
const PRESETS: { label: string; days: number[]; start: string; end: string }[] = [
  { label: "Du–Ju, 08:00–17:00", days: [1, 2, 3, 4, 5], start: "08:00", end: "17:00" },
  { label: "Du–Sh, 08:00–14:00", days: [1, 2, 3, 4, 5, 6], start: "08:00", end: "14:00" },
  { label: "Du–Sh, 09:00–18:00", days: [1, 2, 3, 4, 5, 6], start: "09:00", end: "18:00" },
];

/** Compact week strip: which days the doctor sees patients. */
function WeekStrip({ schedule }: { schedule: ScheduleSlot[] }) {
  const days = new Map<number, ScheduleSlot[]>();
  for (const s of schedule) days.set(s.day, [...(days.get(s.day) ?? []), s]);
  return (
    <div className="flex gap-0.5">
      {WEEKDAYS.map((d) => {
        const slots = days.get(d);
        const title = slots ? `${WEEKDAY_LABELS[d]}: ${slots.map((s) => `${s.start}–${s.end}`).join(", ")}` : `${WEEKDAY_LABELS[d]}: dam olish`;
        return (
          <span
            key={d}
            title={title}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-semibold",
              slots ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground/50",
            )}
          >
            {WEEKDAY_SHORT[d]}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Sozlamalar → Shifokorlar (TZ §10 `doctors`).
 *
 * A doctor here is a staff account plus what the appointment book needs:
 * specialty, department, room, price, slot length and a weekly timetable.
 */
export function DoctorsPanel() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [editing, setEditing] = useState<DoctorWithDetails | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<DoctorWithDetails | null>(null);

  const { data: doctors = [], isLoading } = useQuery<DoctorWithDetails[]>({ queryKey: ["/api/doctors"] });
  const { data: departments = [] } = useQuery<DepartmentWithUsage[]>({ queryKey: ["/api/departments"] });

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return doctors.filter(
      (d) =>
        (deptFilter === "all" || (deptFilter === "none" ? !d.departmentId : d.departmentId === deptFilter)) &&
        (!q ||
          d.fullName.toLowerCase().includes(q) ||
          d.specialty.toLowerCase().includes(q) ||
          (d.room ?? "").toLowerCase().includes(q)),
    );
  }, [doctors, search, deptFilter]);

  const toggle = useMutation({
    mutationFn: async (d: DoctorWithDetails) => {
      await apiRequest("PATCH", `/api/doctors/${d.id}`, { isActive: !d.isActive });
      return d;
    },
    onSuccess: (d) => {
      invalidateApi("/api/doctors", "/api/departments");
      toast({ title: d.isActive ? "Qabul to'xtatildi" : "Qabul qayta ochildi", description: d.fullName });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Saqlanmadi", description: err.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/doctors/${id}`);
    },
    onSuccess: () => {
      invalidateApi("/api/doctors", "/api/departments");
      toast({ title: "Shifokor profili o'chirildi" });
      setDeleting(null);
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "O'chirilmadi", description: err.message }),
  });

  return (
    <div className="space-y-4">
      <div className="card-premium flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Ism, mutaxassislik yoki kabinet"
            className="sm:max-w-xs"
            data-testid="input-search-doctors"
          />
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha bo'limlar ({doctors.length})</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name} ({d.doctorCount})
                </SelectItem>
              ))}
              <SelectItem value="none">Bo'limsiz</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="shrink-0 shadow-brand"
          data-testid="button-add-doctor"
        >
          <Plus className="mr-2 h-4 w-4" />
          Yangi shifokor
        </Button>
      </div>

      <div className="card-premium overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={3} />
        ) : doctors.length === 0 ? (
          <EmptyState
            icon={Stethoscope}
            title="Hali shifokor yo'q"
            description="Avval Xodimlar bo'limida xodim yarating (masalan, Shifokor roli bilan), so'ng unga shu yerda shifokor profilini oching."
            action={
              <Button onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Shifokor qo'shish
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="table-premium">
              <TableHeader>
                <TableRow>
                  <TableHead>Shifokor</TableHead>
                  <TableHead>Bo'lim</TableHead>
                  <TableHead>Kabinet</TableHead>
                  <TableHead className="text-right">Qabul narxi</TableHead>
                  <TableHead>Ish kunlari</TableHead>
                  <TableHead className="text-center">Holat</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      Hech kim topilmadi
                    </TableCell>
                  </TableRow>
                )}
                {visible.map((d) => (
                  <TableRow key={d.id} className={cn(!d.isActive && "opacity-60")} data-testid={`row-doctor-${d.username}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar name={d.fullName} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{d.fullName}</p>
                          <p className="truncate text-xs text-muted-foreground">{d.specialty}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{d.departmentName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      {d.room ? (
                        <span className="inline-flex items-center gap-1 text-sm">
                          <DoorOpen className="h-3.5 w-3.5 text-muted-foreground" />
                          {d.room}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={d.consultationPrice} className="font-semibold" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <WeekStrip schedule={d.schedule} />
                        <span className="hidden text-[11px] text-muted-foreground xl:inline">{d.slotMinutes} daq.</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {!d.userActive ? (
                        <Badge variant="outline" className="border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300">
                          Hisob bloklangan
                        </Badge>
                      ) : d.isActive ? (
                        <Badge variant="outline" className="gap-1.5 border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Qabul qiladi
                        </Badge>
                      ) : (
                        <Badge variant="secondary">To'xtatilgan</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Amallar">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(d);
                              setOpen(true);
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Tahrirlash
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggle.mutate(d)}>
                            <Power className="mr-2 h-4 w-4" />
                            {d.isActive ? "Qabulni to'xtatish" : "Qabulni ochish"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleting(d)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Profilni o'chirish
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <DoctorDialog open={open} onOpenChange={setOpen} doctor={editing} departments={departments} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Shifokor profilini o'chirish"
        description={
          <>
            <b>{deleting?.fullName}</b>ning shifokor profili o'chiriladi. Xodim hisobi saqlanib qoladi.
          </>
        }
        confirmLabel="O'chirish"
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        isPending={remove.isPending}
      />
    </div>
  );
}

type Candidate = { id: string; fullName: string; role: string; roleName: string };
type DayRow = { on: boolean; start: string; end: string };

const emptyWeek = (): Record<number, DayRow> =>
  Object.fromEntries(WEEKDAYS.map((d) => [d, { on: false, start: "08:00", end: "17:00" }]));

/** The editor shows one window per day; a day saved with several is shown as one window spanning them. */
function toWeek(schedule: ScheduleSlot[]): Record<number, DayRow> {
  const week = emptyWeek();
  for (const s of schedule) {
    const row = week[s.day];
    if (!row.on) week[s.day] = { on: true, start: s.start, end: s.end };
    else week[s.day] = { on: true, start: row.start < s.start ? row.start : s.start, end: row.end > s.end ? row.end : s.end };
  }
  return week;
}

function DoctorDialog({
  open,
  onOpenChange,
  doctor,
  departments,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  doctor: DoctorWithDetails | null;
  departments: DepartmentWithUsage[];
}) {
  const { toast } = useToast();
  const { can } = useAuth();
  const [userId, setUserId] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [departmentId, setDepartmentId] = useState("none");
  const [room, setRoom] = useState("");
  const [price, setPrice] = useState(0);
  const [slotMinutes, setSlotMinutes] = useState(20);
  const [week, setWeek] = useState<Record<number, DayRow>>(emptyWeek);
  const [error, setError] = useState<string | null>(null);

  const { data: candidates = [], isLoading: loadingCandidates } = useQuery<Candidate[]>({
    queryKey: ["/api/doctors/candidates"],
    enabled: open && !doctor,
  });

  useEffect(() => {
    if (!open) return;
    setUserId("");
    setSpecialty(doctor?.specialty ?? "");
    setDepartmentId(doctor?.departmentId ?? "none");
    setRoom(doctor?.room ?? "");
    setPrice(doctor?.consultationPrice ?? 0);
    setSlotMinutes(doctor?.slotMinutes ?? 20);
    setWeek(doctor ? toWeek(doctor.schedule) : emptyWeek());
    setError(null);
  }, [open, doctor]);

  const setDay = (day: number, patch: Partial<DayRow>) => setWeek((w) => ({ ...w, [day]: { ...w[day], ...patch } }));

  const applyPreset = (p: (typeof PRESETS)[number]) =>
    setWeek(
      Object.fromEntries(
        WEEKDAYS.map((d) => [d, p.days.includes(d) ? { on: true, start: p.start, end: p.end } : { ...week[d], on: false }]),
      ),
    );

  const workingDays = WEEKDAYS.filter((d) => week[d].on).length;
  const openDepartments = departments.filter((d) => d.isActive || d.id === doctor?.departmentId);

  const save = useMutation({
    mutationFn: async () => {
      const schedule = WEEKDAYS.filter((d) => week[d].on).map((d) => ({ day: d, start: week[d].start, end: week[d].end }));
      const body = {
        ...(doctor ? {} : { userId }),
        specialty,
        departmentId: departmentId === "none" ? null : departmentId,
        room: room.trim() || null,
        consultationPrice: price,
        slotMinutes,
        schedule,
      };
      const schema = doctor ? insertDoctorSchema.omit({ userId: true }) : insertDoctorSchema;
      const parsed = schema.safeParse(body);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
      const { isActive: _keep, ...payload } = parsed.data;
      if (doctor) await apiRequest("PATCH", `/api/doctors/${doctor.id}`, payload);
      else await apiRequest("POST", "/api/doctors", payload);
    },
    onSuccess: () => {
      invalidateApi("/api/doctors", "/api/departments");
      toast({ title: doctor ? "Shifokor yangilandi" : "Shifokor qo'shildi" });
      onOpenChange(false);
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>{doctor ? doctor.fullName : "Yangi shifokor"}</DialogTitle>
          <DialogDescription>
            {doctor ? "Shifokor profili va ish jadvali" : "Mavjud xodimga shifokor profilini oching"}
          </DialogDescription>
        </DialogHeader>

        <form
          id="doctor-form"
          className="flex-1 space-y-5 overflow-y-auto px-6 py-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          {!doctor && (
            <div className="space-y-1.5">
              <Label>Xodim</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger data-testid="select-doctor-user">
                  <SelectValue placeholder={loadingCandidates ? "Yuklanmoqda..." : "Xodimni tanlang"} />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {candidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        {c.fullName}
                        <RoleBadge role={c.role} name={c.roleName} className="h-5 px-1.5 text-[10px]" />
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!loadingCandidates && candidates.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Profilsiz faol xodim yo'q.
                  {can("users.manage") ? " Avval Xodimlar bo'limida xodim yarating." : " Administratordan xodim yaratishni so'rang."}
                </p>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="doctor-specialty">Mutaxassislik</Label>
              <Input
                id="doctor-specialty"
                list="specialty-options"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="Masalan: Kardiolog"
                data-testid="input-doctor-specialty"
              />
              <datalist id="specialty-options">
                {SPECIALTIES.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label>Bo'lim</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger data-testid="select-doctor-department">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Bo'limsiz</SelectItem>
                  {openDepartments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doctor-room">Kabinet</Label>
              <Input id="doctor-room" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Masalan: 204" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doctor-price">Qabul narxi</Label>
              <MoneyInput id="doctor-price" value={price} onChange={setPrice} data-testid="input-doctor-price" />
            </div>
          </div>

          <section className="overflow-hidden rounded-xl border">
            <header className="flex flex-col gap-3 border-b bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <div className="icon-tile h-8 w-8 bg-primary/10 text-primary">
                  <CalendarClock className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Ish jadvali</p>
                  <p className="text-xs text-muted-foreground">
                    Haftasiga {workingDays} kun · navbat shu jadval bo'yicha tuziladi
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label className="whitespace-nowrap text-xs text-muted-foreground">Bir qabul</Label>
                <Select value={String(slotMinutes)} onValueChange={(v) => setSlotMinutes(Number(v))}>
                  <SelectTrigger className="h-8 w-28" data-testid="select-doctor-slot">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SLOT_OPTIONS.map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {m} daqiqa
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </header>
            <div className="flex flex-wrap gap-1.5 border-b px-4 py-2.5">
              {PRESETS.map((p) => (
                <Button key={p.label} type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyPreset(p)}>
                  {p.label}
                </Button>
              ))}
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setWeek(emptyWeek())}>
                Tozalash
              </Button>
            </div>
            <div className="divide-y">
              {WEEKDAYS.map((d) => {
                const row = week[d];
                return (
                  <div key={d} className="flex items-center gap-3 px-4 py-2">
                    <Switch checked={row.on} onCheckedChange={(on) => setDay(d, { on })} data-testid={`switch-day-${d}`} />
                    <span className={cn("w-24 text-sm", row.on ? "font-medium" : "text-muted-foreground")}>{WEEKDAY_LABELS[d]}</span>
                    {row.on ? (
                      <div className="flex items-center gap-2">
                        <Input type="time" value={row.start} onChange={(e) => setDay(d, { start: e.target.value })} className="h-8 w-[110px] tabular" />
                        <span className="text-muted-foreground">–</span>
                        <Input type="time" value={row.end} onChange={(e) => setDay(d, { end: e.target.value })} className="h-8 w-[110px] tabular" />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Dam olish</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </form>

        <DialogFooter className="flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:space-x-0">
          <p className="min-w-0 text-sm text-destructive">{error}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Bekor qilish
            </Button>
            <Button
              type="submit"
              form="doctor-form"
              disabled={save.isPending || (!doctor && !userId)}
              data-testid="button-save-doctor"
            >
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Saqlash
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
