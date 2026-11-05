import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Building2,
  FlaskConical,
  KeyRound,
  Network,
  Stethoscope,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  UserCog,
} from "lucide-react";
import {
  insertTestSchema,
  labSettingsSchema,
  type LabSettings,
  type LabSettingsInput,
  type Test,
} from "@shared/schema";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  EmptyState,
  PageHeader,
  SectionCard,
  TableSkeleton,
} from "@/components/ui-kit";
import { MoneyInput, PhoneInput, SearchInput } from "@/components/inputs";
import { ExportButtons } from "@/components/export-buttons";
import type { ExportColumn } from "@/lib/export-types";
import {
  AuditPanel,
  BackupPanel,
  PasswordPanel,
  SessionPolicyPanel,
  SessionsPanel,
} from "@/components/settings-security";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { apiRequest, invalidateApi } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

type SettingsTab = {
  value: string;
  label: string;
  icon: typeof Building2;
  /** Any one of these opens the tab; none means every signed-in user. */
  needs: Parameters<ReturnType<typeof useAuth>["can"]>;
  render: () => React.ReactNode;
};

const TABS: SettingsTab[] = [
  {
    value: "lab",
    label: "Klinika",
    icon: Building2,
    needs: ["settings.manage"],
    render: () => (
      <>
        <LabSettingsPanel />
        <TelegramPanel />
      </>
    ),
  },
  { value: "tests", label: "Tahlillar", icon: FlaskConical, needs: ["tests.manage"], render: () => <TestsPanel /> },
  {
    value: "security",
    label: "Xavfsizlik",
    icon: ShieldCheck,
    // Everyone gets this tab: changing one's own password is not a privilege.
    needs: [],
    render: () => <SecurityTab />,
  },
];

function SecurityTab() {
  const { can } = useAuth();
  return (
    <>
      <PasswordPanel />
      <SessionsPanel />
      <SessionPolicyPanel />
      <BackupPanel />
      {can("audit.read") && <AuditPanel />}
    </>
  );
}

/**
 * Each tab is gated on its own permission, so a laborant opening Sozlamalar
 * sees only "Xavfsizlik" (their password) and a lab head also sees the test
 * catalogue — rather than the whole page being admin-or-nothing.
 */
export default function Settings() {
  const { can } = useAuth();
  const tabs = TABS.filter((t) => t.needs.length === 0 || can(...t.needs));
  const onlySecurity = tabs.length === 1;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tizim"
        title="Sozlamalar"
        description={
          onlySecurity
            ? "Hisobingiz xavfsizligi va parol"
            : "Klinika ma'lumotlari, tahlillar katalogi va xavfsizlik"
        }
      />

      <Tabs defaultValue={tabs[0].value}>
        <TabsList className="h-auto flex-wrap justify-start">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value} data-testid={`tab-${t.value}`}>
              <t.icon className="mr-2 h-4 w-4" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-6 space-y-6">
            {t.render()}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// ----------------------------------------------------------------- lab info

function LabSettingsPanel() {
  const { toast } = useToast();
  const { data } = useQuery<LabSettings>({ queryKey: ["/api/settings"] });

  const form = useForm<LabSettingsInput>({
    resolver: zodResolver(labSettingsSchema),
    defaultValues: { labName: "", tagline: "", address: "", phone: "", director: "", licenseNumber: "" },
  });

  useEffect(() => {
    if (!data) return;
    form.reset({
      labName: data.labName,
      tagline: data.tagline,
      address: data.address ?? "",
      phone: data.phone ?? "",
      director: data.director ?? "",
      licenseNumber: data.licenseNumber ?? "",
    });
  }, [data, form]);

  const mutation = useMutation({
    mutationFn: async (values: LabSettingsInput) => {
      const res = await apiRequest("PUT", "/api/settings", values);
      return (await res.json()) as LabSettings;
    },
    onSuccess: () => {
      invalidateApi("/api/settings");
      toast({ title: "Sozlamalar saqlandi", description: "Blankadagi shapka yangilandi" });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Saqlanmadi", description: err.message }),
  });

  return (
    <SectionCard
      icon={Building2}
      title="Laboratoriya ma'lumotlari"
      description="Natija blankasining shapkasida shu ma'lumotlar chiqadi"
      className="max-w-3xl"
      bodyClassName="p-6"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="labName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Laboratoriya nomi</FormLabel>
                  <FormControl>
                    <Input data-testid="input-lab-name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tagline"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Qisqa tavsif</FormLabel>
                  <FormControl>
                    <Input placeholder="Tibbiy Laboratoriya" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Manzil</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefon</FormLabel>
                  <FormControl>
                    <PhoneInput
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      data-testid="input-lab-phone"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="licenseNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Litsenziya raqami</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="director"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rahbar F.I.Sh</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormDescription>Blankadagi imzo joyida ko'rsatiladi</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={mutation.isPending} data-testid="button-save-settings">
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Saqlash
          </Button>
        </form>
      </Form>
    </SectionCard>
  );
}

// -------------------------------------------------------------------- telegram

/**
 * Read-only status of the results bot. The token itself lives in the server
 * environment, so there is nothing to edit here — only to verify.
 */
function TelegramPanel() {
  const { data } = useQuery<{ enabled: boolean; username: string | null }>({
    queryKey: ["/api/telegram/status"],
  });

  const enabled = data?.enabled ?? false;
  const username = data?.username;

  return (
    <SectionCard
      icon={Send}
      title="Telegram bot"
      description="Tayyor natijalar bemorning Telegramiga avtomatik yuboriladi"
      className="max-w-3xl"
      bodyClassName="p-6 space-y-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Badge
          variant="outline"
          className={
            enabled
              ? "gap-1.5 border-emerald-500/25 bg-emerald-500/10 font-medium text-emerald-700 dark:text-emerald-300"
              : "gap-1.5 font-medium text-muted-foreground"
          }
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${enabled ? "bg-emerald-500" : "bg-muted-foreground/50"}`}
          />
          {enabled ? "Ulangan" : "Sozlanmagan"}
        </Badge>
        {username && (
          <a
            href={`https://t.me/${username}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-primary hover:underline"
          >
            @{username}
          </a>
        )}
      </div>

      <ol className="space-y-1.5 text-sm text-muted-foreground">
        <li>1. Bemor botni ochib <span className="font-medium text-foreground">/start</span> bosadi.</li>
        <li>2. Tugma orqali telefon raqamini yuboradi — raqam bazadagi bemor bilan solishtiriladi.</li>
        <li>
          3. Buyurtmaning barcha natijalari kiritilgach, xabar avtomatik yuboriladi. Bemor keyinroq
          ulansa, ulangan zahoti yetkaziladi.
        </li>
      </ol>

      {!enabled && (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          Bot o'chirilgan: server muhitida <span className="font-mono text-xs">TELEGRAM_BOT_TOKEN</span>{" "}
          o'zgaruvchisi yo'q.
        </p>
      )}
    </SectionCard>
  );
}

// -------------------------------------------------------------- test catalogue

const testFormSchema = insertTestSchema;
type TestFormValues = z.input<typeof testFormSchema>;

/** The price list, as handed to a partner clinic — see lib/export.ts. */
const TEST_EXPORT_COLUMNS: ExportColumn<Test>[] = [
  { header: "Tahlil nomi", value: (t) => t.name, width: 34 },
  { header: "Kategoriya", value: (t) => t.category, width: 22 },
  { header: "Me'yoriy oraliq", value: (t) => t.referenceRange ?? "", width: 18 },
  { header: "Birlik", value: (t) => t.unit ?? "", width: 12 },
  { header: "Holat", value: (t) => (t.isActive ? "Faol" : "O'chirilgan"), width: 14 },
  { header: "Narx", value: (t) => t.price, type: "money", width: 16, total: true },
];

function TestsPanel() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Test | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<Test | null>(null);

  const { data: tests = [], isLoading } = useQuery<Test[]>({ queryKey: ["/api/tests?all=1"] });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tests;
    return tests.filter((t) => t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
  }, [tests, search]);

  const categories = useMemo(
    () => Array.from(new Set(tests.map((t) => t.category))).sort(),
    [tests],
  );

  const form = useForm<TestFormValues>({
    resolver: zodResolver(testFormSchema),
    defaultValues: { name: "", price: 0, category: "", unit: "", referenceRange: "", isActive: true },
  });

  useEffect(() => {
    if (!dialogOpen) return;
    form.reset({
      name: editing?.name ?? "",
      price: editing?.price ?? 0,
      category: editing?.category ?? categories[0] ?? "",
      unit: editing?.unit ?? "",
      referenceRange: editing?.referenceRange ?? "",
      isActive: editing?.isActive ?? true,
    });
  }, [dialogOpen, editing, categories, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: TestFormValues) => {
      const payload = { ...values, unit: values.unit || null, referenceRange: values.referenceRange || null };
      const res = editing
        ? await apiRequest("PATCH", `/api/tests/${editing.id}`, payload)
        : await apiRequest("POST", "/api/tests", payload);
      return (await res.json()) as Test;
    },
    onSuccess: () => {
      invalidateApi("/api/tests");
      toast({ title: editing ? "Tahlil yangilandi" : "Tahlil qo'shildi" });
      setDialogOpen(false);
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Saqlanmadi", description: err.message }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await apiRequest("PATCH", `/api/tests/${id}`, { isActive });
    },
    onSuccess: () => {
      invalidateApi("/api/tests");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/tests/${id}`);
    },
    onSuccess: () => {
      invalidateApi("/api/tests");
      toast({ title: "Tahlil o'chirildi" });
      setDeleting(null);
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "O'chirilmadi", description: err.message }),
  });

  return (
    <div className="space-y-4">
      <div className="card-premium flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Tahlil yoki kategoriya..."
          className="sm:w-80"
          data-testid="input-search-tests"
        />
        <div className="flex items-center gap-3">
          <span className="text-sm tabular text-muted-foreground">{filtered.length} ta tahlil</span>
          <ExportButtons
            testIdPrefix="export-tests"
            disabled={isLoading}
            build={() => ({
              filename: "narxlar-royxati",
              title: "Tahlillar narxlar ro'yxati",
              subtitle: search
                ? `Qidiruv: "${search}" · ${filtered.length} ta tahlil`
                : `${filtered.length} ta tahlil`,
              sheetName: "Narxlar",
              columns: TEST_EXPORT_COLUMNS,
              rows: filtered,
            })}
          />
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            data-testid="button-add-test"
          >
            <Plus className="mr-2 h-4 w-4" />
            Yangi tahlil
          </Button>
        </div>
      </div>

      <div className="card-premium overflow-hidden">
        {isLoading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState icon={FlaskConical} title="Tahlil topilmadi" description="Qidiruv so'zini o'zgartiring." />
        ) : (
          <div className="overflow-x-auto">
            <Table className="table-premium">
              <TableHeader>
                <TableRow>
                  <TableHead>Nomi</TableHead>
                  <TableHead className="hidden md:table-cell">Kategoriya</TableHead>
                  <TableHead className="hidden lg:table-cell">Me'yor</TableHead>
                  <TableHead className="text-right">Narx</TableHead>
                  <TableHead className="w-20 text-center">Faol</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={t.id} data-testid={`row-test-${t.id}`}>
                    <TableCell className={cn("font-medium", !t.isActive && "text-muted-foreground line-through")}>
                      {t.name}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="secondary" className="font-normal">{t.category}</Badge>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                      {t.referenceRange ? `${t.referenceRange}${t.unit ? ` ${t.unit}` : ""}` : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right font-semibold tabular">
                      {money(t.price)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={t.isActive}
                        onCheckedChange={(isActive) => toggleMutation.mutate({ id: t.id, isActive })}
                        data-testid={`switch-test-${t.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(t);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Tahrirlash
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(t)}>
                            <Trash2 className="h-4 w-4 mr-2" />
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Tahlilni tahrirlash" : "Yangi tahlil"}</DialogTitle>
            <DialogDescription>Narx va me'yoriy oraliq blankada ko'rinadi.</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              id="test-form"
              onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tahlil nomi</FormLabel>
                    <FormControl>
                      <Input data-testid="input-test-name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kategoriya</FormLabel>
                      <FormControl>
                        <Input list="category-list" data-testid="input-test-category" {...field} />
                      </FormControl>
                      <datalist id="category-list">
                        {categories.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Narx</FormLabel>
                      <FormControl>
                        <MoneyInput
                          value={field.value as number}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          data-testid="input-test-price"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Birlik</FormLabel>
                      <FormControl>
                        <Input placeholder="mmol/l" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="referenceRange"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Me'yoriy oraliq</FormLabel>
                      <FormControl>
                        <Input placeholder="3.9-6.1" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" form="test-form" disabled={saveMutation.isPending} data-testid="button-save-test">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Tahlilni o'chirish"
        description={
          <>
            <strong>{deleting?.name}</strong> narxlar ro'yxatidan o'chiriladi. Eski buyurtmalarga
            ta'sir qilmaydi. Vaqtincha yashirish uchun "Faol" tugmasini o'chirish yetarli.
          </>
        }
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
