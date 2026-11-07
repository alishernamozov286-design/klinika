/**
 * Nazorat materiallari (B4.8, TZ §6.5): control material lots by level, and
 * the series set on each (test, device, target mean and SD). Changing a
 * target affects new runs only; recorded runs keep the target they were
 * judged against.
 */
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Beaker, Loader2, MoreVertical, Pencil, Plus, Power } from "lucide-react";
import type { QcBoard, QcMaterial, QcTargetView } from "@shared/schema";
import { insertQcMaterialSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui-kit";
import { ExpiryBadge, fmtNum, parseNumber, useLabDevices, useLabTests } from "@/components/qc/qc-ui";
import { apiRequest, invalidateApi } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const NO_DEVICE = "__none__";

export function QcMaterials({ board }: { board: QcBoard }) {
  const { can } = useAuth();
  const { toast } = useToast();
  const canManage = can("qc.manage");
  const [materialDialog, setMaterialDialog] = useState<{ open: boolean; material: QcMaterial | null }>({ open: false, material: null });
  const [targetDialog, setTargetDialog] = useState<{ open: boolean; materialId: string | null; target: QcTargetView | null }>({
    open: false,
    materialId: null,
    target: null,
  });

  const toggle = useMutation({
    mutationFn: async ({ url, isActive }: { url: string; isActive: boolean }) => {
      await apiRequest("PATCH", url, { isActive });
      return isActive;
    },
    onSuccess: (isActive) => {
      invalidateApi("/api/qc");
      toast({ title: isActive ? "Qayta faollashtirildi" : "Ishlatishdan olindi" });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Saqlanmadi", description: err.message }),
  });

  return (
    <div className="space-y-4">
      <div className="card-premium flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium">Nazorat materiallari va seriyalar</p>
          <p className="text-sm text-muted-foreground">
            Har bir material LOT va daraja bo'yicha alohida. Seriya — material, tahlil va qurilma uchun o'rtacha qiymat va SD.
          </p>
        </div>
        {canManage && (
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              disabled={board.materials.length === 0}
              onClick={() => setTargetDialog({ open: true, materialId: null, target: null })}
              data-testid="button-add-target"
            >
              <Plus className="mr-2 h-4 w-4" />
              Yangi seriya
            </Button>
            <Button className="shadow-brand" onClick={() => setMaterialDialog({ open: true, material: null })} data-testid="button-add-material">
              <Plus className="mr-2 h-4 w-4" />
              Yangi material
            </Button>
          </div>
        )}
      </div>

      {board.materials.length === 0 ? (
        <div className="card-premium">
          <EmptyState
            icon={Beaker}
            title="Nazorat materiali kiritilmagan"
            description="Masalan: Bio-Rad Lyphochek Assayed Chemistry, 1-daraja, LOT 26431, muddati 2027-06-30. Har bir darajani alohida kiriting."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {board.materials.map((m) => {
            const series = board.targets.filter((t) => t.materialId === m.id);
            return (
              <article key={m.id} className={cn("card-premium overflow-hidden", !m.isActive && "opacity-60")} data-testid={`card-qc-material-${m.id}`}>
                <header className="flex flex-col gap-2 border-b px-5 py-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="icon-tile h-10 w-10 shrink-0 bg-primary/10 text-primary">
                      <Beaker className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-semibold">
                        {m.name} <span className="font-normal text-muted-foreground">· {m.level}</span>
                      </h3>
                      <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        <span className="font-mono">LOT {m.lotNumber}</span>
                        {m.manufacturer && <span>{m.manufacturer}</span>}
                        <ExpiryBadge day={m.expiresOn} today={board.date} />
                        {!m.isActive && <Badge variant="secondary">Ishlatilmaydi</Badge>}
                      </p>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setTargetDialog({ open: true, materialId: m.id, target: null })}
                        disabled={!m.isActive}
                        data-testid={`button-add-target-${m.id}`}
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Seriya
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Amallar">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setMaterialDialog({ open: true, material: m })}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Tahrirlash
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggle.mutate({ url: `/api/qc/materials/${m.id}`, isActive: !m.isActive })}>
                            <Power className="mr-2 h-4 w-4" />
                            {m.isActive ? "Ishlatishdan olish" : "Qayta faollashtirish"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </header>
                {series.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-muted-foreground">Bu materialga hali seriya belgilanmagan.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table className="table-premium">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tahlil</TableHead>
                          <TableHead className="hidden sm:table-cell">Qurilma</TableHead>
                          <TableHead className="text-right">O'rtacha</TableHead>
                          <TableHead className="text-right">SD</TableHead>
                          <TableHead className="hidden text-right sm:table-cell">CV</TableHead>
                          <TableHead className="hidden text-right md:table-cell">Natijalar</TableHead>
                          <TableHead className="w-24" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {series.map((t) => (
                          <TableRow key={t.id} className={cn(!t.isActive && "opacity-55")} data-testid={`row-qc-target-${t.id}`}>
                            <TableCell className="font-medium">
                              {t.testName}
                              {!t.isActive && <span className="ml-2 text-xs text-muted-foreground">(to'xtatilgan)</span>}
                            </TableCell>
                            <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{t.deviceName ?? "Har qanday"}</TableCell>
                            <TableCell className="text-right tabular">
                              {fmtNum(t.mean)} <span className="text-xs text-muted-foreground">{t.unit ?? ""}</span>
                            </TableCell>
                            <TableCell className="text-right tabular">{fmtNum(t.sd)}</TableCell>
                            <TableCell className="hidden text-right tabular sm:table-cell">{((t.sd / Math.abs(t.mean || 1)) * 100).toFixed(1)}%</TableCell>
                            <TableCell className="hidden text-right tabular md:table-cell">{t.runs}</TableCell>
                            <TableCell className="text-right">
                              {canManage && (
                                <div className="flex justify-end gap-1">
                                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Tahrirlash" onClick={() => setTargetDialog({ open: true, materialId: m.id, target: t })} data-testid={`button-edit-target-${t.id}`}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    aria-label={t.isActive ? "To'xtatish" : "Faollashtirish"}
                                    onClick={() => toggle.mutate({ url: `/api/qc/targets/${t.id}`, isActive: !t.isActive })}
                                  >
                                    <Power className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <MaterialDialog state={materialDialog} onClose={() => setMaterialDialog({ open: false, material: null })} />
      <TargetDialog state={targetDialog} materials={board.materials.filter((m) => m.isActive)} onClose={() => setTargetDialog({ open: false, materialId: null, target: null })} />
    </div>
  );
}

function MaterialDialog({ state, onClose }: { state: { open: boolean; material: QcMaterial | null }; onClose: () => void }) {
  const { toast } = useToast();
  const m = state.material;
  const [form, setForm] = useState({ name: "", manufacturer: "", lotNumber: "", level: "1-daraja", expiresOn: "", notes: "" });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  useEffect(() => {
    if (!state.open) return;
    setForm({
      name: m?.name ?? "",
      manufacturer: m?.manufacturer ?? "",
      lotNumber: m?.lotNumber ?? "",
      level: m?.level ?? "1-daraja",
      expiresOn: m?.expiresOn ?? "",
      notes: m?.notes ?? "",
    });
    setError(null);
  }, [state.open, m]);

  const save = useMutation({
    mutationFn: async () => {
      const parsed = insertQcMaterialSchema.safeParse({ ...form, isActive: m?.isActive ?? true });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
      if (m) await apiRequest("PATCH", `/api/qc/materials/${m.id}`, parsed.data);
      else await apiRequest("POST", "/api/qc/materials", parsed.data);
    },
    onSuccess: () => {
      invalidateApi("/api/qc");
      toast({ title: m ? "Material yangilandi" : "Material qo'shildi" });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{m ? "Materialni tahrirlash" : "Yangi nazorat materiali"}</DialogTitle>
          <DialogDescription>Har bir daraja va LOT alohida material sifatida kiritiladi.</DialogDescription>
        </DialogHeader>
        <form
          id="qc-material-form"
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="qm-name">Nomi</Label>
            <Input id="qm-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Lyphochek Assayed Chemistry" data-testid="input-qm-name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qm-man">Ishlab chiqaruvchi</Label>
            <Input id="qm-man" value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} placeholder="Bio-Rad" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qm-level">Daraja</Label>
            <Input id="qm-level" value={form.level} onChange={(e) => set("level", e.target.value)} placeholder="1-daraja / Normal / Patologik" data-testid="input-qm-level" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qm-lot">LOT raqami</Label>
            <Input id="qm-lot" value={form.lotNumber} onChange={(e) => set("lotNumber", e.target.value)} className="font-mono" data-testid="input-qm-lot" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qm-exp">Yaroqlilik muddati</Label>
            <Input id="qm-exp" type="date" value={form.expiresOn} onChange={(e) => set("expiresOn", e.target.value)} data-testid="input-qm-exp" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="qm-notes">Izoh</Label>
            <Textarea id="qm-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Ixtiyoriy: saqlash sharoiti, ochilgandan keyingi muddat" />
          </div>
          {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" form="qc-material-form" disabled={save.isPending} data-testid="button-save-material">
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TargetDialog({
  state,
  materials,
  onClose,
}: {
  state: { open: boolean; materialId: string | null; target: QcTargetView | null };
  materials: QcMaterial[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const tests = useLabTests();
  const devices = useLabDevices();
  const t = state.target;
  const [materialId, setMaterialId] = useState("");
  const [testId, setTestId] = useState("");
  const [deviceId, setDeviceId] = useState(NO_DEVICE);
  const [mean, setMean] = useState("");
  const [sd, setSd] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Reset only when the dialog opens. `materials` is a fresh array on every
  // parent render, so depending on it would wipe what the user is typing.
  const defaultMaterial = t?.materialId ?? state.materialId ?? materials[0]?.id ?? "";
  useEffect(() => {
    if (!state.open) return;
    setMaterialId(defaultMaterial);
    setTestId(t?.testId ?? "");
    setDeviceId(t?.deviceId ?? NO_DEVICE);
    setMean(t ? String(t.mean) : "");
    setSd(t ? String(t.sd) : "");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.open]);

  const test = tests.find((x) => x.id === testId);
  const m = parseNumber(mean);
  const s = parseNumber(sd);
  const cv = Number.isFinite(m) && Number.isFinite(s) && m !== 0 ? (s / Math.abs(m)) * 100 : null;

  const save = useMutation({
    mutationFn: async () => {
      if (t) {
        await apiRequest("PATCH", `/api/qc/targets/${t.id}`, { mean: m, sd: s });
      } else {
        await apiRequest("POST", "/api/qc/targets", {
          materialId,
          testId,
          deviceId: deviceId === NO_DEVICE ? null : deviceId,
          mean: m,
          sd: s,
          unit: test?.unit ?? null,
        });
      }
    },
    onSuccess: () => {
      invalidateApi("/api/qc");
      toast({ title: t ? "Seriya yangilandi" : "Seriya qo'shildi", description: t ? "Yangi qiymatlar keyingi natijalarga qo'llanadi" : undefined });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t ? "Seriyani tahrirlash" : "Yangi nazorat seriyasi"}</DialogTitle>
          <DialogDescription>
            {t
              ? `${t.testName} · ${t.level}. Yozilgan natijalar o'z baholarini saqlaydi.`
              : "O'rtacha qiymat va SD — material pasportidagi yoki laboratoriyada kamida 20 ta o'lchovdan hisoblangan qiymat."}
          </DialogDescription>
        </DialogHeader>
        <form
          id="qc-target-form"
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          {!t && (
            <>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Material</Label>
                <Select value={materialId} onValueChange={setMaterialId}>
                  <SelectTrigger data-testid="select-qt-material">
                    <SelectValue placeholder="Tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.map((x) => (
                      <SelectItem key={x.id} value={x.id}>
                        {x.name} · {x.level} · LOT {x.lotNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tahlil</Label>
                <Select value={testId} onValueChange={setTestId}>
                  <SelectTrigger data-testid="select-qt-test">
                    <SelectValue placeholder="Tanlang" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {tests.map((x) => (
                      <SelectItem key={x.id} value={x.id}>
                        {x.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Qurilma</Label>
                <Select value={deviceId} onValueChange={setDeviceId}>
                  <SelectTrigger data-testid="select-qt-device">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_DEVICE}>Ko'rsatilmagan</SelectItem>
                    {devices.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="qt-mean">O'rtacha qiymat{test?.unit || t?.unit ? `, ${test?.unit ?? t?.unit}` : ""}</Label>
            <Input id="qt-mean" inputMode="decimal" value={mean} onChange={(e) => setMean(e.target.value)} className="tabular" data-testid="input-qt-mean" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qt-sd">SD</Label>
            <Input id="qt-sd" inputMode="decimal" value={sd} onChange={(e) => setSd(e.target.value)} className="tabular" data-testid="input-qt-sd" />
          </div>
          {cv !== null && (
            <p className="text-xs text-muted-foreground sm:col-span-2">
              CV {cv.toFixed(1)}% · ±2SD: {fmtNum(m - 2 * s)} – {fmtNum(m + 2 * s)} · ±3SD: {fmtNum(m - 3 * s)} – {fmtNum(m + 3 * s)}
            </p>
          )}
          {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" form="qc-target-form" disabled={save.isPending} data-testid="button-save-target">
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
