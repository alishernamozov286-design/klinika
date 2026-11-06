import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Activity,
  ClipboardList,
  FlaskConical,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Power,
  ScanLine,
  Sparkles,
  Stethoscope,
  Syringe,
  Tags,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  SERVICE_KINDS,
  SERVICE_KIND_LABELS,
  insertServiceSchema,
  type DepartmentWithUsage,
  type PriceListItem,
  type PriceListKind,
  type ServiceKind,
  type ServiceWithDetails,
} from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, Money, PageHeader, StatCard, TableSkeleton } from "@/components/ui-kit";
import { MoneyInput, SearchInput } from "@/components/inputs";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ExportButtons } from "@/components/export-buttons";
import type { ExportColumn } from "@/lib/export-types";
import { apiRequest, invalidateApi } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const KIND_ICONS: Record<PriceListKind, LucideIcon> = {
  konsultatsiya: Stethoscope,
  laboratoriya: FlaskConical,
  uzi: ScanLine,
  muolaja: Syringe,
  boshqa: ClipboardList,
};

const KIND_TONES: Record<PriceListKind, string> = {
  konsultatsiya: "bg-sky-500/10 text-sky-700 border-sky-500/25 dark:text-sky-300",
  laboratoriya: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-300",
  uzi: "bg-violet-500/10 text-violet-700 border-violet-500/25 dark:text-violet-300",
  muolaja: "bg-amber-500/10 text-amber-700 border-amber-500/25 dark:text-amber-300",
  boshqa: "bg-slate-500/10 text-slate-700 border-slate-500/25 dark:text-slate-300",
};

function KindBadge({ kind }: { kind: PriceListKind }) {
  const Icon = KIND_ICONS[kind];
  return (
    <Badge variant="outline" className={cn("gap-1.5 whitespace-nowrap font-medium", KIND_TONES[kind])}>
      <Icon className="h-3 w-3" />
      {SERVICE_KIND_LABELS[kind]}
    </Badge>
  );
}

/** A starting set for a clinic with an empty catalogue; every row is editable afterwards. */
const SAMPLE_SERVICES: { name: string; kind: ServiceKind; price: number; durationMinutes: number | null }[] = [
  { name: "Terapevt ko'rigi (birlamchi)", kind: "konsultatsiya", price: 100_000, durationMinutes: 20 },
  { name: "Takroriy ko'rik", kind: "konsultatsiya", price: 60_000, durationMinutes: 15 },
  { name: "Qorin bo'shlig'i UZI", kind: "uzi", price: 120_000, durationMinutes: 20 },
  { name: "Qalqonsimon bez UZI", kind: "uzi", price: 90_000, durationMinutes: 15 },
  { name: "EKG", kind: "boshqa", price: 50_000, durationMinutes: 10 },
  { name: "Vena ichiga ukol", kind: "muolaja", price: 30_000, durationMinutes: 10 },
];

const PRICE_EXPORT: ExportColumn<PriceListItem>[] = [
  { header: "Xizmat", value: (r) => r.name, width: 44 },
  { header: "Turi", value: (r) => SERVICE_KIND_LABELS[r.kind], width: 18 },
  { header: "Bo'lim / guruh", value: (r) => r.group ?? "", width: 26 },
  { header: "Narx", value: (r) => r.price, type: "money", width: 16 },
];

/**
 * Xizmatlar (TZ §4.1.5, §9.1 "Xizmatlar narxlari").
 *
 * Two views on one screen: the catalogue the clinic edits, and the full
 * price list the desk reads — services and lab tests together, because a
 * patient asking "how much?" does not care which catalogue a line lives in.
 */
export default function Services() {
  const { can } = useAuth();
  const canManage = can("services.manage");
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Klinika"
        title="Xizmatlar"
        description="Shifokor ko'rigi, UZI, muolajalar va boshqa xizmatlar — narxlari bilan. Laboratoriya tahlillari ham narxlar ro'yxatida."
      />
      <Tabs defaultValue={canManage ? "catalogue" : "prices"}>
        <TabsList className="h-auto flex-wrap justify-start">
          {canManage && (
            <TabsTrigger value="catalogue" data-testid="tab-services-catalogue">
              <Tags className="mr-2 h-4 w-4" />
              Xizmatlar katalogi
            </TabsTrigger>
          )}
          <TabsTrigger value="prices" data-testid="tab-services-prices">
            <ClipboardList className="mr-2 h-4 w-4" />
            Narxlar ro'yxati
          </TabsTrigger>
        </TabsList>
        {canManage && (
          <TabsContent value="catalogue" className="mt-6">
            <CataloguePanel />
          </TabsContent>
        )}
        <TabsContent value="prices" className="mt-6">
          <PriceListPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------- catalogue

function CataloguePanel() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | ServiceKind>("all");
  const [editing, setEditing] = useState<ServiceWithDetails | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<ServiceWithDetails | null>(null);

  const { data: list = [], isLoading } = useQuery<ServiceWithDetails[]>({ queryKey: ["/api/services"] });
  const { data: departments = [] } = useQuery<DepartmentWithUsage[]>({ queryKey: ["/api/departments"] });

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter(
      (s) =>
        (kindFilter === "all" || s.kind === kindFilter) &&
        (!q || s.name.toLowerCase().includes(q) || (s.departmentName ?? "").toLowerCase().includes(q)),
    );
  }, [list, search, kindFilter]);

  const active = list.filter((s) => s.isActive);
  const byKind = (k: ServiceKind) => active.filter((s) => s.kind === k).length;

  const toggle = useMutation({
    mutationFn: async (s: ServiceWithDetails) => {
      await apiRequest("PATCH", `/api/services/${s.id}`, { isActive: !s.isActive });
      return s;
    },
    onSuccess: (s) => {
      invalidateApi("/api/services", "/api/price-list");
      toast({ title: s.isActive ? "Xizmat to'xtatildi" : "Xizmat qayta yoqildi", description: s.name });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Saqlanmadi", description: err.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/services/${id}`);
    },
    onSuccess: () => {
      invalidateApi("/api/services", "/api/price-list");
      toast({ title: "Xizmat o'chirildi" });
      setDeleting(null);
    },
    onError: (err: Error) => {
      setDeleting(null);
      toast({ variant: "destructive", title: "O'chirilmadi", description: err.message });
    },
  });

  const seed = useMutation({
    mutationFn: async () => {
      for (const s of SAMPLE_SERVICES) {
        await apiRequest("POST", "/api/services", { ...s, departmentId: null, description: null, isActive: true });
      }
    },
    onSuccess: () => {
      invalidateApi("/api/services", "/api/price-list");
      toast({ title: "Namuna xizmatlar qo'shildi", description: "Narxlarni klinikangizga moslab tahrirlang" });
    },
    onError: (err: Error) => {
      invalidateApi("/api/services", "/api/price-list");
      toast({ variant: "destructive", title: "To'liq qo'shilmadi", description: err.message });
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Faol xizmatlar" value={active.length} icon={Tags} index={0} isLoading={isLoading} />
        <StatCard label="Shifokor ko'rigi" value={byKind("konsultatsiya")} icon={Stethoscope} tone="primary" index={1} isLoading={isLoading} />
        <StatCard label="UZI" value={byKind("uzi")} icon={ScanLine} tone="violet" index={2} isLoading={isLoading} />
        <StatCard label="Muolaja va boshqa" value={byKind("muolaja") + byKind("boshqa")} icon={Activity} tone="amber" index={3} isLoading={isLoading} />
      </div>

      <div className="card-premium flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Xizmat yoki bo'lim nomi"
            className="sm:max-w-xs"
            data-testid="input-search-services"
          />
          <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as typeof kindFilter)}>
            <SelectTrigger className="sm:w-52" data-testid="select-service-kind-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha turlar ({list.length})</SelectItem>
              {SERVICE_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {SERVICE_KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="shrink-0 shadow-brand"
          data-testid="button-add-service"
        >
          <Plus className="mr-2 h-4 w-4" />
          Yangi xizmat
        </Button>
      </div>

      <div className="card-premium overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={4} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={Tags}
            title="Xizmatlar katalogi bo'sh"
            description="Shifokor ko'rigi, UZI va muolajalarni narxi bilan kiriting. Qabulga yozishda shu narx olinadi."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Xizmat qo'shish
                </Button>
                <Button variant="outline" onClick={() => seed.mutate()} disabled={seed.isPending} data-testid="button-seed-services">
                  {seed.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Namuna to'plam
                </Button>
              </div>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="table-premium">
              <TableHeader>
                <TableRow>
                  <TableHead>Xizmat</TableHead>
                  <TableHead>Turi</TableHead>
                  <TableHead className="hidden md:table-cell">Bo'lim</TableHead>
                  <TableHead className="hidden text-center sm:table-cell">Davomiyligi</TableHead>
                  <TableHead className="text-right">Narx</TableHead>
                  <TableHead className="hidden text-center lg:table-cell">Qabullarda</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      Hech narsa topilmadi
                    </TableCell>
                  </TableRow>
                )}
                {visible.map((s) => (
                  <TableRow key={s.id} className={cn(!s.isActive && "opacity-60")} data-testid={`row-service-${s.id}`}>
                    <TableCell>
                      <p className="font-medium">{s.name}</p>
                      {s.description && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{s.description}</p>}
                      {!s.isActive && (
                        <Badge variant="secondary" className="mt-1 text-[10px]">
                          To'xtatilgan
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <KindBadge kind={s.kind} />
                    </TableCell>
                    <TableCell className="hidden text-sm md:table-cell">
                      {s.departmentName ?? <span className="text-muted-foreground">Umumiy</span>}
                    </TableCell>
                    <TableCell className="hidden text-center text-sm tabular sm:table-cell">
                      {s.durationMinutes ? `${s.durationMinutes} daq.` : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={s.price} className="font-semibold" />
                    </TableCell>
                    <TableCell className="hidden text-center text-sm tabular text-muted-foreground lg:table-cell">
                      {s.appointmentCount || "—"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Amallar" data-testid={`button-service-menu-${s.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(s);
                              setOpen(true);
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Tahrirlash
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggle.mutate(s)}>
                            <Power className="mr-2 h-4 w-4" />
                            {s.isActive ? "To'xtatish" : "Qayta yoqish"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleting(s)}
                            disabled={s.appointmentCount > 0}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            O'chirish
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

      <ServiceDialog open={open} onOpenChange={setOpen} service={editing} departments={departments} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Xizmatni o'chirish"
        description={
          <>
            <b>{deleting?.name}</b> katalogdan o'chiriladi. Ishlatilgan xizmatni o'chirib bo'lmaydi — uni to'xtatish kifoya.
          </>
        }
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        isPending={remove.isPending}
      />
    </div>
  );
}

function ServiceDialog({
  open,
  onOpenChange,
  service,
  departments,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: ServiceWithDetails | null;
  departments: DepartmentWithUsage[];
}) {
  // Remounted per service so the form starts from that row.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && <ServiceForm key={service?.id ?? "new"} service={service} departments={departments} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ServiceForm({
  service,
  departments,
  onDone,
}: {
  service: ServiceWithDetails | null;
  departments: DepartmentWithUsage[];
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(service?.name ?? "");
  const [kind, setKind] = useState<ServiceKind>(service?.kind ?? "konsultatsiya");
  const [departmentId, setDepartmentId] = useState(service?.departmentId ?? "none");
  const [price, setPrice] = useState<number>(service?.price ?? 0);
  const [duration, setDuration] = useState(service?.durationMinutes ? String(service.durationMinutes) : "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [isActive, setIsActive] = useState(service?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const parsed = insertServiceSchema.safeParse({
        name,
        kind,
        departmentId: departmentId === "none" ? null : departmentId,
        price,
        durationMinutes: duration ? Number(duration) : null,
        description,
        isActive,
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Ma'lumot noto'g'ri");
      if (service) await apiRequest("PATCH", `/api/services/${service.id}`, parsed.data);
      else await apiRequest("POST", "/api/services", parsed.data);
    },
    onSuccess: () => {
      invalidateApi("/api/services", "/api/price-list");
      toast({ title: service ? "Xizmat saqlandi" : "Xizmat qo'shildi", description: name });
      onDone();
    },
    onError: (err: Error) => setError(err.message),
  });

  const usable = departments.filter((d) => d.isActive || d.id === service?.departmentId);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{service ? "Xizmatni tahrirlash" : "Yangi xizmat"}</DialogTitle>
        <DialogDescription>Narx o'zgarsa, avval yozilgan qabullar eski narxda qoladi.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="svc-name">Nomi</Label>
          <Input id="svc-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus data-testid="input-service-name" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Turi</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as ServiceKind)}>
              <SelectTrigger data-testid="select-service-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {SERVICE_KIND_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Bo'lim</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger data-testid="select-service-department">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Umumiy (bo'limsiz)</SelectItem>
                {usable.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc-price">Narx</Label>
            <MoneyInput id="svc-price" value={price} onChange={setPrice} data-testid="input-service-price" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc-duration">Davomiyligi, daqiqa</Label>
            <Input
              id="svc-duration"
              inputMode="numeric"
              value={duration}
              onChange={(e) => setDuration(e.target.value.replace(/\D/g, "").slice(0, 3))}
              placeholder="ixtiyoriy"
              data-testid="input-service-duration"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="svc-desc">Tavsif</Label>
          <Textarea id="svc-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="ixtiyoriy" />
        </div>
        <label className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm">
          <span>Faol — qabulga yozishda tanlash mumkin</span>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Bekor qilish
        </Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending || name.trim().length < 2} data-testid="button-save-service">
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Saqlash
        </Button>
      </DialogFooter>
    </>
  );
}

// --------------------------------------------------------------- price list

function PriceListPanel() {
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | PriceListKind>("all");
  const { data: items = [], isLoading } = useQuery<PriceListItem[]>({ queryKey: ["/api/price-list?active=1"] });

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter(
        (i) =>
          (kindFilter === "all" || i.kind === kindFilter) &&
          (!q || i.name.toLowerCase().includes(q) || (i.group ?? "").toLowerCase().includes(q)),
      )
      .sort((a, b) => a.kind.localeCompare(b.kind) || (a.group ?? "").localeCompare(b.group ?? "") || a.name.localeCompare(b.name));
  }, [items, search, kindFilter]);

  const kinds: PriceListKind[] = ["konsultatsiya", "uzi", "muolaja", "boshqa", "laboratoriya"];

  return (
    <div className="space-y-4">
      <div className="card-premium flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <SearchInput value={search} onChange={setSearch} placeholder="Xizmat yoki tahlil" className="sm:max-w-xs" data-testid="input-search-prices" />
          <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as typeof kindFilter)}>
            <SelectTrigger className="sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Hammasi ({items.length})</SelectItem>
              {kinds.map((k) => (
                <SelectItem key={k} value={k}>
                  {SERVICE_KIND_LABELS[k]} ({items.filter((i) => i.kind === k).length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ExportButtons
          testIdPrefix="export-prices"
          disabled={isLoading}
          build={() => ({
            filename: "narxlar",
            title: "Xizmatlar narxlari",
            subtitle: `${visible.length} ta xizmat`,
            sheetName: "Narxlar",
            columns: PRICE_EXPORT,
            rows: visible,
          })}
        />
      </div>

      <div className="card-premium overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : visible.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Hech narsa topilmadi" description="Qidiruv yoki filtrni o'zgartirib ko'ring." />
        ) : (
          <div className="overflow-x-auto">
            <Table className="table-premium">
              <TableHeader>
                <TableRow>
                  <TableHead>Xizmat</TableHead>
                  <TableHead>Turi</TableHead>
                  <TableHead className="hidden sm:table-cell">Bo'lim / guruh</TableHead>
                  <TableHead className="text-right">Narx</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((i) => (
                  <TableRow key={`${i.source}-${i.id}`} data-testid={`row-price-${i.source}-${i.id}`}>
                    <TableCell className="font-medium">{i.name}</TableCell>
                    <TableCell>
                      <KindBadge kind={i.kind} />
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{i.group ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Money value={i.price} className="font-semibold" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Laboratoriya tahlillarining narxi tahlillar katalogida o'zgartiriladi
        {can("tests.manage") && (
          <>
            {" "}
            (
            <Link href="/settings" className="text-primary underline-offset-2 hover:underline">
              Sozlamalar → Tahlillar
            </Link>
            )
          </>
        )}
        .
      </p>
    </div>
  );
}
