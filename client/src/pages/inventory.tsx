/**
 * Ombor (Bosqich 5, TZ §7): the product catalogue with stock on hand (B5.1),
 * receipts (B5.2), issues (B5.3), stock and expiry (B5.4), counts (B5.5)
 * and lab reagent consumption (B5.6).
 * Rules: shared/inventory.ts.
 */
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Boxes,
  FlaskConical,
  Gauge,
  Loader2,
  MoreVertical,
  Package,
  Pencil,
  Pill,
  Plus,
  ShieldCheck,
  SprayCan,
  Syringe,
  Tags,
  TestTube2,
  Trash2,
  Warehouse,
} from "lucide-react";
import type { InventoryItem, InventoryItemView, StockCountView } from "@shared/schema";
import { insertInventoryItemSchema } from "@shared/schema";
import {
  DEFAULT_UNIT,
  INVENTORY_KINDS,
  INVENTORY_KIND_LABELS,
  INVENTORY_KIND_SHORT,
  UNIT_SUGGESTIONS,
  inventoryKey,
  type InventoryKind,
} from "@shared/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Receipts } from "@/components/inventory/receipts";
import { Issues } from "@/components/inventory/issues";
import { Counts } from "@/components/inventory/counts";
import { Consumption } from "@/components/inventory/consumption";
import { StockAlertsBanner, StockView, type StockAlertTarget, type StockWindow } from "@/components/inventory/stock";
import type { StockAlerts } from "@shared/inventory";
import { EmptyState, Money, PageHeader, StatCard, TableSkeleton } from "@/components/ui-kit";
import { MoneyInput, SearchInput } from "@/components/inputs";
import { ExportButtons } from "@/components/export-buttons";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { ExportColumn } from "@/lib/export-types";
import { apiRequest, invalidateApi } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";

const KIND_ICONS: Record<InventoryKind, ComponentType<{ className?: string }>> = {
  reagent: FlaskConical,
  calibrator: Gauge,
  control: ShieldCheck,
  tube: TestTube2,
  syringe: Syringe,
  consumable: Package,
  medicine: Pill,
  disinfectant: SprayCan,
};
const KIND_TONES: Record<InventoryKind, string> = {
  reagent: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  calibrator: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  control: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  tube: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  syringe: "bg-teal-500/10 text-teal-700 dark:text-teal-300",
  consumable: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  medicine: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  disinfectant: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
};

const qty = (n: number) => String(Number(n.toFixed(3)));

const EXPORT_COLUMNS: ExportColumn<InventoryItemView>[] = [
  { header: "Nomi", value: (i) => i.name, width: 34 },
  { header: "Turi", value: (i) => INVENTORY_KIND_LABELS[i.kind], width: 24 },
  { header: "Artikul", value: (i) => i.code ?? "", width: 12 },
  { header: "Ishlab chiqaruvchi", value: (i) => i.manufacturer ?? "", width: 18 },
  { header: "Birlik", value: (i) => i.unit, width: 9 },
  { header: "Qoldiq", value: (i) => i.onHand, type: "number", width: 10 },
  { header: "Minimal qoldiq", value: (i) => i.minStock, type: "number", width: 12 },
  { header: "Narx", value: (i) => i.salePrice ?? 0, type: "money", width: 13 },
  { header: "Holat", value: (i) => (i.isActive ? "Faol" : "Faolsiz"), width: 9 },
];

type InventoryTab = "items" | "stock" | "receipts" | "issues" | "counts" | "consumption";
const TABS: readonly InventoryTab[] = ["items", "stock", "receipts", "issues", "counts", "consumption"];

export default function Inventory() {
  const { can } = useAuth();
  const { toast } = useToast();
  const canManage = can("inventory.manage");
  const { data: items = [], isLoading } = useQuery<InventoryItemView[]>({ queryKey: ["/api/inventory/items"], refetchOnMount: "always" });
  // TZ §7.3: the warnings sit above every tab.
  const { data: alerts } = useQuery<StockAlerts>({ queryKey: ["/api/inventory/alerts"], refetchOnMount: "always" });
  // An open count is marked on its tab, so it is not forgotten half-done.
  const { data: stockCounts = [] } = useQuery<StockCountView[]>({ queryKey: ["/api/inventory/counts"], refetchOnMount: "always" });
  const openCount = stockCounts.find((c) => c.status === "open");
  const [tab, setTab] = useState<InventoryTab>(() => {
    const asked = new URLSearchParams(window.location.search).get("tab");
    return TABS.includes(asked as InventoryTab) ? (asked as InventoryTab) : "items";
  });
  const [stockWindow, setStockWindow] = useState<StockWindow>(() => {
    const w = new URLSearchParams(window.location.search).get("window");
    return w === "expired" || w === "soon" || w === "watch" ? w : "all";
  });
  const openStock = (w: StockAlertTarget) => {
    if (w === "consumption") return setTab("consumption");
    setStockWindow(w === "low" ? "all" : w);
    setTab("stock");
    if (w === "low") setTimeout(() => document.getElementById("low-stock")?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
  };

  const [kind, setKind] = useState<InventoryKind | "all">("all");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; item: InventoryItem | null }>({ open: false, item: null });
  const [deleting, setDeleting] = useState<InventoryItem | null>(null);

  const visible = items.filter((i) => showInactive || i.isActive);
  const counts = useMemo(() => {
    const c: Partial<Record<InventoryKind, number>> = {};
    for (const i of visible) c[i.kind] = (c[i.kind] ?? 0) + 1;
    return c;
  }, [visible]);
  const q = inventoryKey(search);
  const rows = visible.filter(
    (i) =>
      (kind === "all" || i.kind === kind) &&
      (!q || inventoryKey(i.name).includes(q) || inventoryKey(i.code ?? "").includes(q) || inventoryKey(i.manufacturer ?? "").includes(q)),
  );
  const active = items.filter((i) => i.isActive);
  const kindsUsed = new Set(active.map((i) => i.kind)).size;
  const unpriced = active.filter((i) => i.salePrice === null).length;
  // One rule for "kam qolgan" everywhere: usable (unexpired) stock, from the server (shared/inventory.ts summarizeStock).
  const lowIds = new Set((alerts?.lowStock ?? []).map((l) => l.id));
  const low = lowIds.size;

  const toggle = useMutation({
    mutationFn: async (i: InventoryItem) => {
      await apiRequest("PATCH", `/api/inventory/items/${i.id}`, { isActive: !i.isActive });
      return i;
    },
    onSuccess: (i) => {
      invalidateApi("/api/inventory");
      toast({ title: i.isActive ? `"${i.name}" faolsizlantirildi` : `"${i.name}" qayta faollashtirildi` });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Saqlanmadi", description: err.message }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/inventory/items/${id}`);
    },
    onSuccess: () => {
      invalidateApi("/api/inventory");
      setDeleting(null);
      toast({ title: "Mahsulot o'chirildi" });
    },
    onError: (err: Error) => {
      setDeleting(null);
      toast({ variant: "destructive", title: "O'chirilmadi", description: err.message });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ombor"
        title="Ombor"
        description="Reagentlar, kalibratorlar, nazorat materiallari, sarf materiallari va dori vositalari (TZ §7.2)"
        actions={
          <div className="flex items-center gap-2">
            {can("data.export") && (
              <ExportButtons
                testIdPrefix="export-inventory"
                disabled={isLoading}
                build={() => ({
                  filename: "ombor-katalogi",
                  title: "Ombor mahsulotlari katalogi",
                  subtitle: [kind === "all" ? "Barcha turlar" : INVENTORY_KIND_LABELS[kind], search ? `qidiruv: "${search}"` : null, `${rows.length} ta mahsulot`]
                    .filter(Boolean)
                    .join(" · "),
                  columns: EXPORT_COLUMNS,
                  rows,
                })}
              />
            )}
            {canManage && (
              <Button className="shadow-brand" onClick={() => setDialog({ open: true, item: null })} data-testid="button-add-item">
                <Plus className="mr-2 h-4 w-4" />
                Yangi mahsulot
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard index={0} label="Faol mahsulotlar" value={active.length} hint={`Katalogda jami ${items.length} ta`} icon={Boxes} isLoading={isLoading} />
        <StatCard index={1} label="Mahsulot turlari" value={`${kindsUsed}/8`} hint="TZ §7.2 bo'yicha" icon={Warehouse} tone="violet" isLoading={isLoading} />
        <StatCard
          index={2}
          label="Narxi belgilanmagan"
          value={unpriced}
          hint={unpriced > 0 ? "Sotuv yoki hisobdan chiqarish narxi" : "Hammasining narxi bor"}
          icon={Tags}
          tone={unpriced > 0 ? "amber" : "emerald"}
          isLoading={isLoading}
        />
        <StatCard
          index={3}
          label="Kam qolgan"
          value={low}
          hint={low > 0 ? "Yaroqli qoldiq minimaldan kam" : "Hammasi yetarli"}
          icon={Package}
          tone={low > 0 ? "rose" : "emerald"}
          isLoading={isLoading}
        />
      </div>

      <StockAlertsBanner alerts={alerts} onOpen={openStock} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as InventoryTab)}>
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="items" data-testid="tab-inventory-items">
            Mahsulotlar
          </TabsTrigger>
          <TabsTrigger value="stock" data-testid="tab-inventory-stock">
            Qoldiq va muddat
          </TabsTrigger>
          <TabsTrigger value="receipts" data-testid="tab-inventory-receipts">
            Kirim
          </TabsTrigger>
          <TabsTrigger value="issues" data-testid="tab-inventory-issues">
            Chiqim
          </TabsTrigger>
          <TabsTrigger value="counts" className="gap-1.5" data-testid="tab-inventory-counts">
            Inventarizatsiya
            {openCount && (
              <span className="rounded-full bg-sky-500/15 px-1.5 text-[10px] font-semibold tabular text-sky-700 dark:text-sky-300" title="Sanoq davom etmoqda" data-testid="badge-open-count">
                {openCount.countedCount}/{openCount.lineCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="consumption" data-testid="tab-inventory-consumption">
            Reagent sarfi
          </TabsTrigger>
        </TabsList>
        <TabsContent value="consumption" className="mt-4">
          <Consumption items={items} />
        </TabsContent>
        <TabsContent value="counts" className="mt-4">
          <Counts />
        </TabsContent>
        <TabsContent value="stock" className="mt-4">
          <StockView key={stockWindow} items={items} initialWindow={stockWindow} />
        </TabsContent>
        <TabsContent value="issues" className="mt-4">
          <Issues items={items} />
        </TabsContent>
        <TabsContent value="receipts" className="mt-4">
          <Receipts items={items} />
        </TabsContent>
        <TabsContent value="items" className="mt-4 space-y-4">
          <div className="card-premium flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
            <SearchInput value={search} onChange={setSearch} placeholder="Nomi, artikul yoki ishlab chiqaruvchi…" className="lg:w-96" data-testid="input-search-inventory" />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={showInactive} onCheckedChange={setShowInactive} data-testid="switch-show-inactive" />
              Faolsizlarni ham ko'rsatish
            </label>
          </div>

          {/* TZ §7.2: the eight types as filter chips. */}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Mahsulot turi">
            {(["all", ...INVENTORY_KINDS] as const).map((k) => {
              const count = k === "all" ? visible.length : (counts[k] ?? 0);
              if (k !== "all" && count === 0 && kind !== k) return null;
              const Icon = k === "all" ? Boxes : KIND_ICONS[k];
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={kind === k}
                  onClick={() => setKind(k)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    kind === k ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40",
                  )}
                  data-testid={`filter-kind-${k}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {k === "all" ? "Hammasi" : INVENTORY_KIND_LABELS[k]} <span className="tabular opacity-70">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="card-premium overflow-hidden">
            {isLoading ? (
              <TableSkeleton />
            ) : rows.length === 0 ? (
              <EmptyState
                icon={Warehouse}
                title={items.length === 0 ? "Katalog bo'sh" : "Mos mahsulot topilmadi"}
                description={
                  items.length === 0
                    ? "Ombordagi har bir mahsulotni turi, o'lchov birligi va minimal qoldig'i bilan kiriting. Kirim va qoldiq shu katalogga tayanadi."
                    : "Qidiruv so'zini yoki turini o'zgartiring."
                }
                action={
                  items.length === 0 && canManage ? (
                    <Button onClick={() => setDialog({ open: true, item: null })}>
                      <Plus className="mr-2 h-4 w-4" />
                      Birinchi mahsulot
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <Table className="table-premium">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mahsulot</TableHead>
                      <TableHead className="hidden md:table-cell">Turi</TableHead>
                      <TableHead className="text-right">Qoldiq</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">Minimal</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">Narx</TableHead>
                      <TableHead className="hidden w-20 lg:table-cell">Faol</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((i) => {
                      const Icon = KIND_ICONS[i.kind];
                      return (
                        <TableRow key={i.id} className={cn(!i.isActive && "opacity-55")} data-testid={`row-item-${i.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className={cn("icon-tile h-9 w-9 shrink-0", KIND_TONES[i.kind])}>
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-medium">{i.name}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {[i.code ? `Art. ${i.code}` : null, i.manufacturer].filter(Boolean).join(" · ") || (
                                    <span className="md:hidden">{INVENTORY_KIND_SHORT[i.kind]}</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden text-sm md:table-cell">{INVENTORY_KIND_LABELS[i.kind]}</TableCell>
                          <TableCell className="text-right" data-testid={`cell-onhand-${i.id}`}>
                            <span
                              className={cn(
                                "font-semibold tabular",
                                i.isActive && i.onHand <= 0 && "text-rose-600 dark:text-rose-400",
                                i.isActive && i.onHand > 0 && lowIds.has(i.id) && "text-amber-700 dark:text-amber-300",
                              )}
                            >
                              {qty(i.onHand)}
                            </span>{" "}
                            <span className="text-xs text-muted-foreground">{i.unit}</span>
                            {i.nearestExpiry && <span className="block text-[11px] text-muted-foreground">muddat {formatDate(i.nearestExpiry)}</span>}
                          </TableCell>
                          <TableCell className="hidden text-right tabular text-muted-foreground sm:table-cell">{qty(i.minStock)}</TableCell>
                          <TableCell className="hidden text-right sm:table-cell">
                            {i.salePrice === null ? <span className="text-xs text-muted-foreground">belgilanmagan</span> : <Money value={i.salePrice} />}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <Switch
                              checked={i.isActive}
                              disabled={!canManage || toggle.isPending}
                              onCheckedChange={() => toggle.mutate(i)}
                              aria-label={i.isActive ? "Faolsizlantirish" : "Faollashtirish"}
                              data-testid={`switch-item-${i.id}`}
                            />
                          </TableCell>
                          <TableCell>
                            {canManage && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Amallar" data-testid={`menu-item-${i.id}`}>
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setDialog({ open: true, item: i })}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Tahrirlash
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="lg:hidden" onClick={() => toggle.mutate(i)}>
                                    <Package className="mr-2 h-4 w-4" />
                                    {i.isActive ? "Faolsizlantirish" : "Faollashtirish"}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleting(i)}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    O'chirish
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

        </TabsContent>
      </Tabs>

      <ItemDialog state={dialog} onClose={() => setDialog({ open: false, item: null })} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`"${deleting?.name}" o'chirilsinmi?`}
        description="Faqat xato bilan qo'shilgan mahsulotni o'chiring. Ishlatilmay qolgan mahsulotni faolsizlantirish to'g'riroq: tarixi saqlanadi."
        isPending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}

function ItemDialog({ state, onClose }: { state: { open: boolean; item: InventoryItem | null }; onClose: () => void }) {
  const { toast } = useToast();
  const it = state.item;
  const [form, setForm] = useState({
    name: "",
    kind: "reagent" as InventoryKind,
    unit: DEFAULT_UNIT.reagent,
    code: "",
    manufacturer: "",
    minStock: "0",
    salePrice: 0,
    notes: "",
  });
  const [unitTouched, setUnitTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!state.open) return;
    setForm({
      name: it?.name ?? "",
      kind: it?.kind ?? "reagent",
      unit: it?.unit ?? DEFAULT_UNIT.reagent,
      code: it?.code ?? "",
      manufacturer: it?.manufacturer ?? "",
      minStock: it ? String(it.minStock) : "0",
      salePrice: it?.salePrice ?? 0,
      notes: it?.notes ?? "",
    });
    setUnitTouched(Boolean(it));
    setError(null);
  }, [state.open, it]);

  const save = useMutation({
    mutationFn: async () => {
      const minStock = form.minStock.trim() === "" ? 0 : Number(form.minStock.replace(",", "."));
      const parsed = insertInventoryItemSchema.safeParse({
        ...form,
        minStock,
        salePrice: form.salePrice > 0 ? form.salePrice : null,
        isActive: it?.isActive ?? true,
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
      if (it) await apiRequest("PATCH", `/api/inventory/items/${it.id}`, parsed.data);
      else await apiRequest("POST", "/api/inventory/items", parsed.data);
    },
    onSuccess: () => {
      invalidateApi("/api/inventory");
      toast({ title: it ? "Mahsulot yangilandi" : "Mahsulot katalogga qo'shildi" });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{it ? "Mahsulotni tahrirlash" : "Yangi mahsulot"}</DialogTitle>
          <DialogDescription>Qoldiq shu o'lchov birligida yuritiladi. Minimal qoldiqdan kamaysa, ombor ogohlantiradi.</DialogDescription>
        </DialogHeader>
        <form
          id="inventory-item-form"
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="inv-name">Nomi</Label>
            <Input id="inv-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Masalan: Probirka EDTA K3, 4 ml" data-testid="input-item-name" />
          </div>
          <div className="space-y-1.5">
            <Label>Turi</Label>
            <Select
              value={form.kind}
              onValueChange={(v) => {
                const k = v as InventoryKind;
                setForm((f) => ({ ...f, kind: k, unit: unitTouched ? f.unit : DEFAULT_UNIT[k] }));
              }}
            >
              <SelectTrigger data-testid="select-item-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVENTORY_KINDS.map((k) => {
                  const Icon = KIND_ICONS[k];
                  return (
                    <SelectItem key={k} value={k}>
                      <span className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        {INVENTORY_KIND_LABELS[k]}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-unit">O'lchov birligi</Label>
            <Input
              id="inv-unit"
              list="inventory-units"
              value={form.unit}
              onChange={(e) => {
                setUnitTouched(true);
                set("unit", e.target.value);
              }}
              data-testid="input-item-unit"
            />
            <datalist id="inventory-units">
              {UNIT_SUGGESTIONS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-code">Artikul</Label>
            <Input id="inv-code" value={form.code} onChange={(e) => set("code", e.target.value)} className="font-mono" placeholder="Ixtiyoriy" data-testid="input-item-code" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-man">Ishlab chiqaruvchi</Label>
            <Input id="inv-man" value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} placeholder="Ixtiyoriy" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-min">Minimal qoldiq{form.unit ? `, ${form.unit}` : ""}</Label>
            <Input id="inv-min" inputMode="decimal" value={form.minStock} onChange={(e) => set("minStock", e.target.value)} className="tabular" data-testid="input-item-min" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-price">Narx (1 {form.unit || "birlik"})</Label>
            <MoneyInput id="inv-price" value={form.salePrice} onChange={(v) => set("salePrice", v)} placeholder="Belgilanmagan" data-testid="input-item-price" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="inv-notes">Izoh</Label>
            <Textarea id="inv-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Ixtiyoriy: saqlash sharoiti, qadoq tarkibi" />
          </div>
          {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" form="inventory-item-form" disabled={save.isPending} data-testid="button-save-item">
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
