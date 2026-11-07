/**
 * Analizatorlar (B4.9, TZ §6.4): the lab's instruments, how each is connected
 * (protocol is checked device by device, manual entry until then — D-4), and
 * the device error log. Rules and labels: shared/lab-devices.ts.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  History,
  Loader2,
  MapPin,
  Microscope,
  MoreVertical,
  Pencil,
  Plug,
  Plus,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";
import type { LabDeviceErrorWithDevice, LabDeviceWithStats } from "@shared/schema";
import { insertDeviceSchema } from "@shared/schema";
import {
  DEVICE_CONNECTIONS,
  DEVICE_CONNECTION_LABELS,
  DEVICE_DIRECTIONS,
  DEVICE_DIRECTION_LABELS,
  DEVICE_STATUSES,
  DEVICE_STATUS_LABELS,
  ERROR_SEVERITIES,
  ERROR_SEVERITY_LABELS,
  TZ_ANALYZERS,
  type DeviceConnection,
  type DeviceDirection,
  type DeviceStatus,
  type ErrorSeverity,
} from "@shared/lab-devices";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, PageHeader, SectionCard, StatCard, TableSkeleton } from "@/components/ui-kit";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { apiRequest, invalidateApi } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, timeAgo } from "@/lib/format";

const STATUS_STYLES: Record<DeviceStatus, string> = {
  active: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  maintenance: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  out_of_service: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};
const STATUS_DOTS: Record<DeviceStatus, string> = {
  active: "bg-emerald-500",
  maintenance: "bg-amber-500",
  out_of_service: "bg-rose-500",
};
const SEVERITY_STYLES: Record<ErrorSeverity, string> = {
  warning: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  error: "border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  critical: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", STATUS_STYLES[status])}>
      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOTS[status])} />
      {DEVICE_STATUS_LABELS[status]}
    </Badge>
  );
}

function SeverityBadge({ severity }: { severity: ErrorSeverity }) {
  return (
    <Badge variant="outline" className={cn("font-medium", SEVERITY_STYLES[severity])}>
      {ERROR_SEVERITY_LABELS[severity]}
    </Badge>
  );
}

export default function Devices() {
  const { toast } = useToast();
  const { can } = useAuth();
  const canManage = can("devices.manage");
  const canLog = can("devices.log");

  const [editing, setEditing] = useState<LabDeviceWithStats | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<LabDeviceWithStats | null>(null);
  const [logging, setLogging] = useState<LabDeviceWithStats | null>(null);
  const [resolving, setResolving] = useState<LabDeviceErrorWithDevice | null>(null);
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [deviceFilter, setDeviceFilter] = useState<string | null>(null);

  const { data: devices = [], isLoading } = useQuery<LabDeviceWithStats[]>({
    queryKey: ["/api/devices"],
    refetchOnMount: "always",
  });
  const params = new URLSearchParams();
  if (onlyOpen) params.set("open", "1");
  if (deviceFilter) params.set("deviceId", deviceFilter);
  const { data: log = [], isLoading: logLoading } = useQuery<LabDeviceErrorWithDevice[]>({
    queryKey: [`/api/device-errors?${params.toString()}`],
    refetchOnMount: "always",
  });

  const stats = useMemo(
    () => ({
      active: devices.filter((d) => d.status === "active").length,
      down: devices.filter((d) => d.status !== "active").length,
      open: devices.reduce((s, d) => s + d.openErrors, 0),
      manual: devices.filter((d) => d.connection === "manual").length,
    }),
    [devices],
  );

  const setStatus = useMutation({
    mutationFn: async ({ d, status }: { d: LabDeviceWithStats; status: DeviceStatus }) => {
      await apiRequest("PATCH", `/api/devices/${d.id}`, { status });
      return { d, status };
    },
    onSuccess: ({ d, status }) => {
      invalidateApi("/api/devices");
      toast({ title: `"${d.name}": ${DEVICE_STATUS_LABELS[status].toLowerCase()}` });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Saqlanmadi", description: err.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/devices/${id}`);
    },
    onSuccess: () => {
      invalidateApi("/api/devices");
      setDeleting(null);
      toast({ title: "Qurilma o'chirildi" });
    },
    onError: (err: Error) => {
      setDeleting(null);
      toast({ variant: "destructive", title: "O'chirilmadi", description: err.message });
    },
  });

  const seed = useMutation({
    mutationFn: async () => {
      // One at a time: each is its own audited create, and a name that
      // already exists should not stop the rest.
      for (const a of TZ_ANALYZERS) {
        await apiRequest("POST", "/api/devices", { ...a, connection: "manual", status: "active" }).catch(() => undefined);
      }
    },
    onSuccess: () => {
      invalidateApi("/api/devices");
      toast({ title: "TZ'dagi analizatorlar qo'shildi", description: "Seriya raqami, joylashuv va ulanish usulini to'ldiring" });
    },
  });

  const filteredName = deviceFilter ? devices.find((d) => d.id === deviceFilter)?.name : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Laboratoriya"
        title="Analizatorlar"
        description="Qurilmalar, ulanish usuli va xatolar jurnali"
        actions={
          canManage && (
            <Button
              className="shadow-brand"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              data-testid="button-add-device"
            >
              <Plus className="mr-2 h-4 w-4" />
              Yangi qurilma
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard index={0} label="Jami qurilmalar" value={devices.length} hint={`${stats.active} tasi ishlamoqda`} icon={Microscope} isLoading={isLoading} />
        <StatCard
          index={1}
          label="Ishlamayotgan"
          value={stats.down}
          hint="Texnik xizmatda yoki ishdan chiqqan"
          icon={Wrench}
          tone={stats.down > 0 ? "amber" : "emerald"}
          isLoading={isLoading}
        />
        <StatCard
          index={2}
          label="Ochiq xatolar"
          value={stats.open}
          hint={stats.open > 0 ? "Hal qilinishi kerak" : "Hammasi hal qilingan"}
          icon={AlertTriangle}
          tone={stats.open > 0 ? "rose" : "emerald"}
          isLoading={isLoading}
        />
        <StatCard
          index={3}
          label="Qo'lda kiritiladi"
          value={stats.manual}
          hint="Protokol hali ulanmagan (TZ §6.4)"
          icon={Plug}
          tone="violet"
          isLoading={isLoading}
        />
      </div>

      {/* ------------------------------------------------------- devices */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card-premium h-52 skeleton-shimmer" />
          ))}
        </div>
      ) : devices.length === 0 ? (
        <div className="card-premium">
          <EmptyState
            icon={Microscope}
            title="Hali qurilma qo'shilmagan"
            description="Analizatorlarni o'zingiz qo'shing yoki TZ §6.4 dagi ro'yxatdan boshlang: Snibe MAGLUMI X3 va 600, Mindray BA-88A va BS-240 Pro, Dymind DH26, Merilyzer EIAQUANT."
            action={
              canManage ? (
                <Button variant="outline" onClick={() => seed.mutate()} disabled={seed.isPending} data-testid="button-seed-devices">
                  {seed.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  TZ'dagi analizatorlarni qo'shish
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {devices.map((d) => (
            <article
              key={d.id}
              className={cn("card-premium flex flex-col p-5", d.status === "out_of_service" && "ring-1 ring-rose-500/20")}
              data-testid={`card-device-${d.id}`}
            >
              <div className="flex items-start gap-3">
                <div className="icon-tile h-11 w-11 shrink-0 border bg-primary/10 text-primary">
                  <Cpu className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[15px] font-semibold">{d.name}</h3>
                  <p className="truncate text-xs text-muted-foreground">
                    {[d.manufacturer, d.model && d.model !== d.name ? d.model : null].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                {(canManage || canLog) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="-mr-2 -mt-1 h-8 w-8" aria-label="Amallar" data-testid={`menu-device-${d.id}`}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      {canManage && (
                        <DropdownMenuItem
                          onClick={() => {
                            setEditing(d);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Tahrirlash
                        </DropdownMenuItem>
                      )}
                      {canManage && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Holati</DropdownMenuLabel>
                          {DEVICE_STATUSES.filter((s) => s !== d.status).map((s) => (
                            <DropdownMenuItem key={s} onClick={() => setStatus.mutate({ d, status: s })} data-testid={`status-${s}-${d.id}`}>
                              <span className={cn("mr-2 h-2 w-2 rounded-full", STATUS_DOTS[s])} />
                              {DEVICE_STATUS_LABELS[s]}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleting(d)}
                            data-testid={`delete-device-${d.id}`}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            O'chirish
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <DeviceStatusBadge status={d.status} />
                <Badge variant="secondary" className="font-normal">
                  {DEVICE_DIRECTION_LABELS[d.direction]}
                </Badge>
              </div>

              <dl className="mb-4 mt-4 space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Plug className="h-3.5 w-3.5 shrink-0" />
                  <dt className="sr-only">Ulanish</dt>
                  <dd className={cn(d.connection === "manual" ? "text-violet-700 dark:text-violet-300" : "text-foreground")}>
                    {DEVICE_CONNECTION_LABELS[d.connection]}
                  </dd>
                </div>
                {d.location && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <dt className="sr-only">Joylashuv</dt>
                    <dd className="truncate text-foreground">{d.location}</dd>
                  </div>
                )}
                {(d.serialNumber || d.installedOn) && (
                  <p className="text-xs text-muted-foreground">
                    {d.serialNumber && <span className="font-mono">S/N {d.serialNumber}</span>}
                    {d.serialNumber && d.installedOn && " · "}
                    {d.installedOn && `O'rnatilgan: ${formatDate(d.installedOn)}`}
                  </p>
                )}
              </dl>

              <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
                <button
                  type="button"
                  className="text-left text-xs"
                  onClick={() => {
                    setDeviceFilter(d.id);
                    setOnlyOpen(false);
                    document.getElementById("device-log")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  data-testid={`button-device-log-${d.id}`}
                >
                  {d.openErrors > 0 ? (
                    <span className="font-semibold text-rose-600 dark:text-rose-400">{d.openErrors} ta ochiq xato</span>
                  ) : (
                    <span className="text-muted-foreground">{d.errorCount > 0 ? `Jurnalda ${d.errorCount} ta yozuv` : "Jurnal bo'sh"}</span>
                  )}
                  {d.lastErrorAt && <span className="block text-muted-foreground">Oxirgisi {timeAgo(d.lastErrorAt)}</span>}
                </button>
                {canLog && (
                  <Button size="sm" variant="outline" onClick={() => setLogging(d)} data-testid={`button-log-error-${d.id}`}>
                    <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
                    Xato qayd etish
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* ----------------------------------------------------------- log */}
      <div id="device-log" className="scroll-mt-20">
        <SectionCard
          icon={History}
          title="Xatolar jurnali"
          description={filteredName ? `${filteredName} qurilmasi` : "Barcha qurilmalar, eng yangisi birinchi"}
          flush
          action={
            <div className="flex flex-wrap items-center justify-end gap-2">
              {filteredName && (
                <Button variant="ghost" size="sm" onClick={() => setDeviceFilter(null)} data-testid="button-clear-device-filter">
                  Barcha qurilmalar
                </Button>
              )}
              <div className="flex rounded-lg border p-0.5" role="group" aria-label="Filtr">
                {[
                  { v: true, label: "Ochiq" },
                  { v: false, label: "Hammasi" },
                ].map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    aria-pressed={onlyOpen === o.v}
                    onClick={() => setOnlyOpen(o.v)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      onlyOpen === o.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                    data-testid={`filter-log-${o.v ? "open" : "all"}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          }
        >
          {logLoading ? (
            <TableSkeleton rows={3} />
          ) : log.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title={onlyOpen ? "Ochiq xato yo'q" : "Jurnal bo'sh"}
              description={onlyOpen ? "Qayd etilgan hamma xato hal qilingan." : "Qurilma xatosi bo'lganda kartadagi “Xato qayd etish” tugmasidan yozing."}
            />
          ) : (
            <ul className="divide-y" data-testid="list-device-errors">
              {log.map((e) => (
                <li key={e.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:gap-4" data-testid={`row-device-error-${e.id}`}>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={e.severity} />
                      <span className="text-sm font-semibold">{e.deviceName}</span>
                      {e.code && <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{e.code}</span>}
                    </div>
                    <p className="text-sm">{e.message}</p>
                    {e.actionTaken && <p className="text-xs text-muted-foreground">Ko'rilgan chora: {e.actionTaken}</p>}
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(e.occurredAt)}
                      {e.reportedByName ? ` · ${e.reportedByName}` : ""}
                    </p>
                    {e.resolvedAt && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-400" data-testid={`text-resolution-${e.id}`}>
                        <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 -translate-y-px" />
                        Hal qilindi: {e.resolution} · {formatDateTime(e.resolvedAt)}
                        {e.resolvedByName ? ` · ${e.resolvedByName}` : ""}
                      </p>
                    )}
                  </div>
                  {!e.resolvedAt && canLog && (
                    <Button size="sm" variant="outline" className="shrink-0 self-start" onClick={() => setResolving(e)} data-testid={`button-resolve-${e.id}`}>
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      Hal qilindi
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <DeviceDialog open={formOpen} onOpenChange={setFormOpen} device={editing} />
      <LogErrorDialog device={logging} onClose={() => setLogging(null)} />
      <ResolveDialog entry={resolving} onClose={() => setResolving(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`"${deleting?.name}" o'chirilsinmi?`}
        description={
          deleting && deleting.errorCount > 0
            ? "Bu qurilmaning xatolar jurnali bor, shuning uchun o'chirilmaydi. Uni “Ishdan chiqqan” deb belgilang."
            : "Faqat xato bilan qo'shilgan, jurnali bo'lmagan qurilmani o'chirish mumkin."
        }
        isPending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}

// ------------------------------------------------------------------ dialogs

function DeviceDialog({ open, onOpenChange, device }: { open: boolean; onOpenChange: (o: boolean) => void; device: LabDeviceWithStats | null }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "",
    manufacturer: "",
    model: "",
    serialNumber: "",
    direction: "biokimyo" as DeviceDirection,
    connection: "manual" as DeviceConnection,
    status: "active" as DeviceStatus,
    location: "",
    installedOn: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setForm({
      name: device?.name ?? "",
      manufacturer: device?.manufacturer ?? "",
      model: device?.model ?? "",
      serialNumber: device?.serialNumber ?? "",
      direction: device?.direction ?? "biokimyo",
      connection: device?.connection ?? "manual",
      status: device?.status ?? "active",
      location: device?.location ?? "",
      installedOn: device?.installedOn ?? "",
      notes: device?.notes ?? "",
    });
    setError(null);
  }, [open, device]);

  const save = useMutation({
    mutationFn: async () => {
      const parsed = insertDeviceSchema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
      if (device) await apiRequest("PATCH", `/api/devices/${device.id}`, parsed.data);
      else await apiRequest("POST", "/api/devices", parsed.data);
    },
    onSuccess: () => {
      invalidateApi("/api/devices", "/api/device-errors");
      toast({ title: device ? "Qurilma yangilandi" : "Qurilma qo'shildi" });
      onOpenChange(false);
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{device ? "Qurilmani tahrirlash" : "Yangi qurilma"}</DialogTitle>
          <DialogDescription>Ulanish protokoli tekshirilmaguncha "Qo'lda kiritish" qoldiring (TZ §6.4).</DialogDescription>
        </DialogHeader>
        <form
          id="device-form"
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="device-name">Nomi</Label>
            <Input id="device-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Masalan: BS-240 Pro" data-testid="input-device-name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="device-manufacturer">Ishlab chiqaruvchi</Label>
            <Input id="device-manufacturer" value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} placeholder="Mindray" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="device-model">Model</Label>
            <Input id="device-model" value={form.model} onChange={(e) => set("model", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Yo'nalish</Label>
            <Select value={form.direction} onValueChange={(v) => set("direction", v as DeviceDirection)}>
              <SelectTrigger data-testid="select-device-direction">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEVICE_DIRECTIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {DEVICE_DIRECTION_LABELS[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Ulanish usuli</Label>
            <Select value={form.connection} onValueChange={(v) => set("connection", v as DeviceConnection)}>
              <SelectTrigger data-testid="select-device-connection">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEVICE_CONNECTIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {DEVICE_CONNECTION_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="device-serial">Seriya raqami</Label>
            <Input id="device-serial" value={form.serialNumber} onChange={(e) => set("serialNumber", e.target.value)} className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="device-location">Joylashuv</Label>
            <Input id="device-location" value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Masalan: 2-qavat, biokimyo xonasi" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="device-installed">O'rnatilgan sana</Label>
            <Input id="device-installed" type="date" value={form.installedOn} onChange={(e) => set("installedOn", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Holati</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v as DeviceStatus)}>
              <SelectTrigger data-testid="select-device-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEVICE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {DEVICE_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="device-notes">Izoh</Label>
            <Textarea id="device-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Ixtiyoriy: servis kompaniyasi, kafolat muddati…" />
          </div>
          {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button type="submit" form="device-form" disabled={save.isPending} data-testid="button-save-device">
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "YYYY-MM-DDTHH:mm" in local time, for a datetime-local input. */
const localNow = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

function LogErrorDialog({ device, onClose }: { device: LabDeviceWithStats | null; onClose: () => void }) {
  const { toast } = useToast();
  const [severity, setSeverity] = useState<ErrorSeverity>("error");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [occurredAt, setOccurredAt] = useState(localNow());
  const [retire, setRetire] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!device) return;
    setSeverity("error");
    setCode("");
    setMessage("");
    setActionTaken("");
    setOccurredAt(localNow());
    setRetire(false);
    setError(null);
  }, [device]);

  const save = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/devices/${device!.id}/errors`, {
        severity,
        code: code || null,
        message,
        actionTaken: actionTaken || null,
        occurredAt: occurredAt ? new Date(occurredAt).toISOString() : null,
        markOutOfService: retire,
      });
    },
    onSuccess: () => {
      invalidateApi("/api/devices", "/api/device-errors");
      toast({ title: "Xato jurnalga yozildi", description: retire ? `"${device?.name}" ishdan chiqqan deb belgilandi` : undefined });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const alreadyDown = device?.status === "out_of_service";

  return (
    <Dialog open={!!device} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Xato qayd etish
          </DialogTitle>
          <DialogDescription>{device?.name} · yozuv o'chirilmaydi, keyin “Hal qilindi” deb yopiladi.</DialogDescription>
        </DialogHeader>
        <form
          id="device-error-form"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Daraja">
            {ERROR_SEVERITIES.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={severity === s}
                onClick={() => {
                  setSeverity(s);
                  if (s === "critical" && !alreadyDown) setRetire(true);
                }}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm transition-colors",
                  severity === s ? cn("font-medium", SEVERITY_STYLES[s]) : "hover:bg-muted",
                )}
                data-testid={`severity-${s}`}
              >
                {ERROR_SEVERITY_LABELS[s]}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_1.4fr]">
            <div className="space-y-1.5">
              <Label htmlFor="error-code">Xato kodi</Label>
              <Input id="error-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="E-12" className="font-mono" data-testid="input-error-code" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="error-time">Qachon</Label>
              <Input id="error-time" type="datetime-local" value={occurredAt} max={localNow()} onChange={(e) => setOccurredAt(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="error-message">Nima bo'ldi</Label>
            <Textarea
              id="error-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Masalan: lampa energiyasi past, kalibrlash o'tmadi"
              data-testid="input-error-message"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="error-action">Ko'rilgan chora</Label>
            <Textarea id="error-action" value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} rows={2} placeholder="Ixtiyoriy" />
          </div>
          {!alreadyDown && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-sm">
              <Checkbox checked={retire} onCheckedChange={(v) => setRetire(v === true)} className="mt-0.5" data-testid="checkbox-retire" />
              <span>
                <span className="font-medium">Qurilmani “Ishdan chiqqan” deb belgilash</span>
                <span className="block text-xs text-muted-foreground">Tuzatilguncha unda tahlil qilinmasligi uchun.</span>
              </span>
            </label>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" form="device-error-form" disabled={save.isPending} data-testid="button-save-error">
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Jurnalga yozish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResolveDialog({ entry, onClose }: { entry: LabDeviceErrorWithDevice | null; onClose: () => void }) {
  const { toast } = useToast();
  const [resolution, setResolution] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setResolution("");
    setError(null);
  }, [entry]);

  const save = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/device-errors/${entry!.id}/resolve`, { resolution });
    },
    onSuccess: () => {
      invalidateApi("/api/devices", "/api/device-errors");
      toast({ title: "Xato hal qilindi deb belgilandi", description: "Qurilma holatini kerak bo'lsa alohida o'zgartiring" });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Dialog open={!!entry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Xato hal qilindi</DialogTitle>
          <DialogDescription>
            {entry?.deviceName}: {entry?.message}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="resolution">Nima qilindi</Label>
          <Textarea
            id="resolution"
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            rows={3}
            placeholder="Masalan: lampa almashtirildi, qayta kalibrlandi"
            data-testid="input-resolution"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-confirm-resolve">
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
