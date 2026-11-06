/**
 * The two security panels on the settings screen: the audit trail, and the
 * self-service password change.
 *
 * They live outside settings.tsx because that file is already long, and these
 * two share nothing with the lab/tests/users panels beyond the page they sit on.
 */
import { useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import {
  Download,
  History,
  KeyRound,
  Loader2,
  LogOut,
  Monitor,
  MonitorSmartphone,
  ShieldCheck,
  Smartphone,
  TimerReset,
} from "lucide-react";
import {
  changePasswordSchema,
  type ActiveSession,
  type AuditEntry,
  type SecuritySettings,
} from "@shared/schema";
import { describeUserAgent } from "@shared/user-agent";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Pagination, SectionCard, TableSkeleton } from "@/components/ui-kit";
import { ExportButtons } from "@/components/export-buttons";
import type { ExportColumn } from "@/lib/export-types";
import { apiRequest, invalidateApi } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime } from "@/lib/format";

const PAGE_SIZE = 25;

/** Colour by consequence, not by verb: deletions and refunds read as red. */
const ACTION_STYLES: Record<string, string> = {
  create: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-300",
  update: "bg-sky-500/10 text-sky-700 border-sky-500/25 dark:text-sky-300",
  delete: "bg-rose-500/10 text-rose-700 border-rose-500/25 dark:text-rose-300",
  refund: "bg-rose-500/10 text-rose-700 border-rose-500/25 dark:text-rose-300",
  void: "bg-rose-500/10 text-rose-700 border-rose-500/25 dark:text-rose-300",
  payment: "bg-violet-500/10 text-violet-700 border-violet-500/25 dark:text-violet-300",
  results: "bg-amber-500/10 text-amber-700 border-amber-500/25 dark:text-amber-300",
  login: "text-muted-foreground",
  export: "text-muted-foreground",
};

const ACTION_LABELS: Record<string, string> = {
  create: "qo'shildi",
  update: "o'zgardi",
  delete: "o'chirildi",
  payment: "to'lov",
  refund: "qaytarish",
  void: "bekor qilindi",
  results: "natija",
  login: "kirish",
  export: "eksport",
};

const ENTITIES = [
  { value: "all", label: "Hammasi" },
  { value: "order", label: "Buyurtmalar" },
  { value: "patient", label: "Bemorlar" },
  { value: "test", label: "Tahlillar" },
  { value: "user", label: "Xodimlar" },
  { value: "role", label: "Rollar" },
  { value: "department", label: "Bo'limlar" },
  { value: "doctor", label: "Shifokorlar" },
  { value: "appointment", label: "Qabullar" },
  { value: "record", label: "Ko'rik yozuvlari" },
  { value: "service", label: "Xizmatlar" },
  { value: "session", label: "Seanslar" },
  { value: "settings", label: "Sozlamalar" },
  { value: "expense", label: "Xarajatlar" },
  { value: "auth", label: "Kirishlar" },
];

/** The audit trail as a document — see lib/export.ts. */
const AUDIT_EXPORT_COLUMNS: ExportColumn<AuditEntry>[] = [
  { header: "Vaqt", value: (e) => formatDateTime(e.createdAt), width: 20 },
  { header: "Amal", value: (e) => ACTION_LABELS[e.action] ?? e.action, width: 14 },
  { header: "Tafsilot", value: (e) => e.summary, width: 52 },
  { header: "Kim", value: (e) => e.userName, width: 24 },
];

export function AuditPanel() {
  const [entity, setEntity] = useState("all");
  const [page, setPage] = useState(0);

  const filter = entity === "all" ? "" : `entity=${entity}&`;
  const { data, isLoading, isFetching } = useQuery<{ items: AuditEntry[]; total: number }>({
    queryKey: [`/api/audit?${filter}limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`],
    placeholderData: keepPreviousData,
  });

  const items = data?.items ?? [];

  return (
    <SectionCard
      icon={History}
      title="Amallar jurnali"
      description="Kim nima o'zgartirdi — narx, to'lov, o'chirish"
      action={
        <div className="flex items-center gap-2">
          <Select
            value={entity}
            onValueChange={(v) => {
              setEntity(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-44" data-testid="select-audit-entity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENTITIES.map((e) => (
                <SelectItem key={e.value} value={e.value}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ExportButtons
            testIdPrefix="export-audit"
            disabled={isLoading}
            build={() => ({
              filename: "amallar-jurnali",
              title: "Amallar jurnali",
              subtitle: `${ENTITIES.find((e) => e.value === entity)?.label ?? "Hammasi"} · ${items.length} ta yozuv (${page + 1}-sahifa, jami ${data?.total ?? 0} ta)`,
              sheetName: "Jurnal",
              orientation: "landscape",
              columns: AUDIT_EXPORT_COLUMNS,
              rows: items,
            })}
          />
        </div>
      }
    >
      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={History}
          title="Yozuv yo'q"
          description="Bu bo'lim bo'yicha hali amal bajarilmagan."
        />
      ) : (
        <div className="overflow-x-auto">
          <Table className="table-premium">
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">Vaqt</TableHead>
                <TableHead className="w-32">Amal</TableHead>
                <TableHead>Tafsilot</TableHead>
                <TableHead className="hidden w-44 sm:table-cell">Kim</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((e) => (
                <TableRow key={e.id} data-testid={`row-audit-${e.id}`}>
                  <TableCell className="tabular text-xs text-muted-foreground">
                    {formatDateTime(e.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`font-medium ${ACTION_STYLES[e.action] ?? "text-muted-foreground"}`}
                    >
                      {ACTION_LABELS[e.action] ?? e.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{e.summary}</TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                    {e.userName}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={data?.total ?? 0}
        onPageChange={setPage}
        isFetching={isFetching}
      />
    </SectionCard>
  );
}

/** Available to every signed-in user, unlike the admin's staff editor. */
export function PasswordPanel() {
  const { toast } = useToast();
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      // Same schema the server enforces, so the two can never disagree.
      const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword, confirmPassword });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Ma'lumot noto'g'ri");
      const res = await apiRequest("POST", "/api/user/password", parsed.data);
      return (await res.json().catch(() => ({}))) as { endedSessions?: number };
    },
    onSuccess: ({ endedSessions }) => {
      invalidateApi("/api/sessions");
      toast({
        title: "Parol o'zgartirildi",
        description: endedSessions ? `Boshqa qurilmalardagi ${endedSessions} ta seans yopildi` : undefined,
      });
      setCurrent("");
      setNew("");
      setConfirm("");
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <SectionCard
      icon={KeyRound}
      title="Parolni o'zgartirish"
      description="Faqat o'z hisobingiz uchun — joriy parolni bilish shart"
    >
      <div className="max-w-md space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="currentPassword">Joriy parol</Label>
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
            data-testid="input-current-password"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="newPassword">Yangi parol</Label>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
            data-testid="input-new-password"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Yangi parolni takrorlang</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirm(e.target.value)}
            data-testid="input-confirm-password"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !currentPassword || !newPassword}
          data-testid="button-change-password"
        >
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Parolni saqlash
        </Button>
      </div>
    </SectionCard>
  );
}

/** Download-only. Restoring runs from the CLI — see scripts/restore-backup.mjs. */
export function BackupPanel() {
  const { can } = useAuth();
  if (!can("backup.download")) return null;

  return (
    <SectionCard
      icon={ShieldCheck}
      title="Zaxira nusxa"
      description="Bemorlar, buyurtmalar, natijalar va xarajatlar — bitta JSON faylda"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" asChild data-testid="link-backup">
          <a href="/api/backup">
            <Download className="mr-2 h-4 w-4" />
            Zaxirani yuklab olish
          </a>
        </Button>
        <p className="text-xs text-muted-foreground">
          Tiklash brauzerdan emas, terminaldan bajariladi:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">npm run db:restore -- fayl.json --yes</code>
          {" — "}butun bazani almashtiradigan tugma tasodifiy bosishga juda yaqin turadi.
        </p>
      </div>
    </SectionCard>
  );
}

// ----------------------------------------------------------------- sessions

/** "Chrome · Windows" with a phone or desktop glyph. */
function DeviceIcon({ ua }: { ua: string | null }) {
  const { mobile } = describeUserAgent(ua);
  const Icon = mobile ? Smartphone : Monitor;
  return (
    <div className="icon-tile h-10 w-10 shrink-0 bg-primary/10 text-primary">
      <Icon className="h-[18px] w-[18px]" />
    </div>
  );
}

/**
 * Every device this user is signed in on (TZ §12). Lets someone who left a
 * session open at the reception desk end it from wherever they are now.
 */
export function SessionsPanel() {
  const { toast } = useToast();
  const { data: sessions = [], isLoading } = useQuery<ActiveSession[]>({
    queryKey: ["/api/sessions"],
    staleTime: 0,
    refetchOnMount: "always",
  });
  const others = sessions.filter((s) => !s.current).length;

  const endOne = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/sessions/${id}`);
    },
    onSuccess: () => {
      invalidateApi("/api/sessions");
      toast({ title: "Seans yopildi" });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Yopilmadi", description: err.message }),
  });

  const endOthers = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/sessions/revoke-others");
      return (await res.json()) as { ended: number };
    },
    onSuccess: ({ ended }) => {
      invalidateApi("/api/sessions");
      toast({ title: ended ? `${ended} ta seans yopildi` : "Boshqa seans yo'q" });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Yopilmadi", description: err.message }),
  });

  return (
    <SectionCard
      icon={MonitorSmartphone}
      title="Faol seanslar"
      description="Hisobingiz ochiq turgan qurilmalar"
      flush
      action={
        others > 0 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => endOthers.mutate()}
            disabled={endOthers.isPending}
            data-testid="button-revoke-other-sessions"
          >
            {endOthers.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <LogOut className="mr-2 h-3.5 w-3.5" />}
            Boshqalarini yopish
          </Button>
        ) : undefined
      }
    >
      {isLoading ? (
        <TableSkeleton rows={2} />
      ) : (
        <div className="divide-y">
          {sessions.map((s) => {
            const d = describeUserAgent(s.userAgent);
            return (
              <div key={s.id} className="flex items-center gap-3 px-5 py-3.5" data-testid={`row-session-${s.id}`}>
                <DeviceIcon ua={s.userAgent} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">
                      {d.browser} · {d.os}
                    </p>
                    {s.current && (
                      <Badge
                        variant="outline"
                        className="h-5 gap-1 border-emerald-500/25 bg-emerald-500/10 px-1.5 text-[10px] text-emerald-700 dark:text-emerald-300"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Shu qurilma
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {s.ip ?? "IP noma'lum"}
                    {s.createdAt && ` · kirgan: ${formatDateTime(s.createdAt)}`}
                    {s.lastSeen && !s.current && ` · oxirgi faollik: ${formatDateTime(s.lastSeen)}`}
                  </p>
                </div>
                {!s.current && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => endOne.mutate(s.id)}
                    disabled={endOne.isPending}
                  >
                    Yopish
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

const IDLE_OPTIONS = [5, 10, 15, 30, 60, 120, 240, 480];
const MAX_OPTIONS = [4, 8, 12, 24, 72, 168];
const hoursLabel = (h: number) => (h % 24 === 0 && h >= 24 ? `${h / 24} kun` : `${h} soat`);
const minutesLabel = (m: number) => (m >= 60 ? `${m / 60} soat` : `${m} daqiqa`);

/** The clinic-wide limits behind SessionGuard and enforceSessionPolicy. */
export function SessionPolicyPanel() {
  const { can } = useAuth();
  const { toast } = useToast();
  const allowed = can("settings.manage");
  const { data } = useQuery<SecuritySettings>({ queryKey: ["/api/settings/security"], enabled: allowed });
  const [idle, setIdle] = useState<number | null>(null);
  const [max, setMax] = useState<number | null>(null);

  const current = { idle: idle ?? data?.sessionIdleMinutes ?? 30, max: max ?? data?.sessionMaxHours ?? 12 };
  const dirty = Boolean(data) && (current.idle !== data!.sessionIdleMinutes || current.max !== data!.sessionMaxHours);

  const save = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", "/api/settings/security", {
        sessionIdleMinutes: current.idle,
        sessionMaxHours: current.max,
      });
    },
    onSuccess: () => {
      invalidateApi("/api/settings/security", "/api/session/policy");
      setIdle(null);
      setMax(null);
      toast({ title: "Seans siyosati saqlandi", description: "Bir daqiqa ichida barcha xodimlarga qo'llanadi" });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Saqlanmadi", description: err.message }),
  });

  if (!allowed) return null;

  return (
    <SectionCard
      icon={TimerReset}
      title="Seans siyosati"
      description="Faol bo'lmagan seanslar avtomatik yopiladi (TZ §12)"
    >
      <div className="grid max-w-2xl gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Faolsizlikdan keyin yopish</Label>
          <Select value={String(current.idle)} onValueChange={(v) => setIdle(Number(v))}>
            <SelectTrigger data-testid="select-session-idle">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IDLE_OPTIONS.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {minutesLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Yopilishdan 1 daqiqa oldin ogohlantirish chiqadi.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Seansning eng uzoq muddati</Label>
          <Select value={String(current.max)} onValueChange={(v) => setMax(Number(v))}>
            <SelectTrigger data-testid="select-session-max">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MAX_OPTIONS.map((h) => (
                <SelectItem key={h} value={String(h)}>
                  {hoursLabel(h)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Faol ishlansa ham shundan keyin qayta kirish so'raladi.</p>
        </div>
      </div>
      <Button className="mt-5" onClick={() => save.mutate()} disabled={!dirty || save.isPending} data-testid="button-save-session-policy">
        {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Saqlash
      </Button>
    </SectionCard>
  );
}
