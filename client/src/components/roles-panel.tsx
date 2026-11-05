import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Briefcase,
  Calculator,
  Check,
  ClipboardList,
  Copy,
  Crown,
  Eye,
  FlaskConical,
  HeartPulse,
  KeyRound,
  Loader2,
  Lock,
  Microscope,
  MoreVertical,
  Package,
  Pencil,
  Plus,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  PERMISSION_GROUPS,
  SUPER_ADMIN,
  permissionsInGroup,
  type Permission,
} from "@shared/permissions";
import { insertRoleSchema, type RoleWithUsage } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState, MeterBar, SectionCard } from "@/components/ui-kit";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { apiRequest, invalidateApi, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { roleStyle } from "@/lib/format";
import { cn } from "@/lib/utils";

/** One recognisable glyph per TZ §3 role; the clinic's own roles share one. */
export const ROLE_ICONS: Record<string, LucideIcon> = {
  super_admin: Crown,
  rahbar: Briefcase,
  registrator: ClipboardList,
  shifokor: Stethoscope,
  laborant: FlaskConical,
  lab_mudiri: Microscope,
  omborchi: Package,
  hamshira: HeartPulse,
  kassir: Wallet,
  buxgalter: Calculator,
  auditor: Eye,
};

export const roleIcon = (key: string): LucideIcon => ROLE_ICONS[key] ?? UserCog;

const TOTAL = ALL_PERMISSIONS.length;

/**
 * Sozlamalar → Rollar.
 *
 * Three views of one thing: cards to find a role and see how widely it is
 * used, a matrix to compare every role against every permission at a glance,
 * and an editor to change one role. Anyone with users.manage can look (they
 * need to know what they are handing out); only roles.manage can change.
 */
export function RolesPanel() {
  const { toast } = useToast();
  const { can, isSuperAdmin, user } = useAuth();
  const canEdit = can("roles.manage");

  const { data: roles = [], isLoading } = useQuery<RoleWithUsage[]>({ queryKey: ["/api/roles"] });

  const [editing, setEditing] = useState<RoleWithUsage | null>(null);
  const [creating, setCreating] = useState<{ from?: RoleWithUsage } | null>(null);
  const [deleting, setDeleting] = useState<RoleWithUsage | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (key: string) => {
      await apiRequest("DELETE", `/api/roles/${key}`);
    },
    onSuccess: () => {
      invalidateApi("/api/roles");
      toast({ title: "Rol o'chirildi" });
      setDeleting(null);
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "O'chirilmadi", description: err.message }),
  });

  const totalStaff = roles.reduce((n, r) => n + r.userCount, 0);
  const customCount = roles.filter((r) => !r.isSystem).length;

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------- intro */}
      <div className="card-premium flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="brand-gradient icon-tile h-11 w-11 shrink-0 text-white shadow-brand">
            <KeyRound className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold">Rollar va ruxsatlar</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Har bir xodim faqat o'z rolidagi ruxsatlar doirasida ishlaydi. Ruxsat serverda tekshiriladi,
              shuning uchun yopiq bo'limni manzil orqali ham ochib bo'lmaydi.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary" className="gap-1.5 font-medium">
                <ShieldCheck className="h-3.5 w-3.5" />
                {roles.length} ta rol
              </Badge>
              <Badge variant="secondary" className="gap-1.5 font-medium">
                <Users className="h-3.5 w-3.5" />
                {totalStaff} ta xodim
              </Badge>
              <Badge variant="secondary" className="gap-1.5 font-medium">
                <KeyRound className="h-3.5 w-3.5" />
                {TOTAL} ta ruxsat
              </Badge>
              {customCount > 0 && (
                <Badge variant="secondary" className="font-medium">
                  {customCount} ta maxsus rol
                </Badge>
              )}
            </div>
          </div>
        </div>
        {canEdit && (
          <Button onClick={() => setCreating({})} className="shrink-0 shadow-brand" data-testid="button-add-role">
            <Plus className="mr-2 h-4 w-4" />
            Yangi rol
          </Button>
        )}
      </div>

      {/* ------------------------------------------------------- cards */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card-premium h-44 skeleton-shimmer" />
          ))}
        </div>
      ) : roles.length === 0 ? (
        <div className="card-premium">
          <EmptyState icon={ShieldCheck} title="Rollar topilmadi" description="Server rollarni qaytarmadi." />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {roles.map((role) => (
            <RoleCard
              key={role.key}
              role={role}
              isMine={role.key === user?.role}
              canEdit={canEdit}
              onEdit={() => setEditing(role)}
              onDuplicate={() => setCreating({ from: role })}
              onDelete={() => setDeleting(role)}
            />
          ))}
        </div>
      )}

      {/* ------------------------------------------------------ matrix */}
      {roles.length > 0 && <PermissionMatrix roles={roles} />}

      <RoleEditor
        open={Boolean(editing) || Boolean(creating)}
        onOpenChange={(o) => {
          if (!o) {
            setEditing(null);
            setCreating(null);
          }
        }}
        role={editing}
        template={creating?.from ?? null}
        heldByMe={user?.permissions ?? []}
        unrestricted={isSuperAdmin}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Rolni o'chirish"
        description={
          <>
            <b>{deleting?.name}</b> roli butunlay o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.
          </>
        }
        confirmLabel="O'chirish"
        onConfirm={() => deleting && deleteMutation.mutate(deleting.key)}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

// ------------------------------------------------------------------ card

function RoleCard({
  role,
  isMine,
  canEdit,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  role: RoleWithUsage;
  isMine: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const Icon = roleIcon(role.key);
  const isSuper = role.key === SUPER_ADMIN;
  const count = isSuper ? TOTAL : role.permissions.length;
  const deletable = !role.isSystem && role.userCount === 0;

  return (
    <article
      className="card-premium group flex flex-col p-5 transition-shadow hover:shadow-md"
      data-testid={`card-role-${role.key}`}
    >
      <div className="flex items-start gap-3">
        <div className={cn("icon-tile h-11 w-11 shrink-0 border", roleStyle(role.key))}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-[15px] font-semibold">{role.name}</h3>
            {isMine && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                Sizning rolingiz
              </Badge>
            )}
          </div>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{role.key}</p>
        </div>
        {canEdit && !isSuper && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="-mr-2 -mt-1 h-8 w-8" aria-label="Amallar">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Ruxsatlarni sozlash
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="mr-2 h-4 w-4" />
                Nusxa asosida yangi rol
              </DropdownMenuItem>
              {!role.isSystem && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    disabled={!deletable}
                    onClick={onDelete}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {deletable ? "O'chirish" : "O'chirish (xodimlari bor)"}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
        {role.description || "Tavsif kiritilmagan"}
      </p>

      <div className="mt-4 space-y-3">
        <MeterBar
          value={count}
          max={TOTAL}
          label={
            <>
              <span>Ruxsatlar</span>
              <span className="tabular font-medium text-foreground">
                {isSuper ? "Barchasi" : `${count} / ${TOTAL}`}
              </span>
            </>
          }
        />
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span className="tabular">{role.userCount}</span> ta xodim
          </span>
          {isSuper ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              Tahrirlab bo'lmaydi
            </span>
          ) : role.isSystem ? (
            <span className="text-muted-foreground">Tizim roli · TZ §3</span>
          ) : (
            <span className="text-fuchsia-600 dark:text-fuchsia-400">Maxsus rol</span>
          )}
        </div>
      </div>

      {canEdit && !isSuper && (
        <Button variant="outline" size="sm" className="mt-4 w-full" onClick={onEdit}>
          <Pencil className="mr-2 h-3.5 w-3.5" />
          Ruxsatlarni sozlash
        </Button>
      )}
    </article>
  );
}

// ---------------------------------------------------------------- matrix

/**
 * Every role against every permission. The one place that answers "who can
 * refund money?" without opening eleven roles one by one.
 */
function PermissionMatrix({ roles }: { roles: RoleWithUsage[] }) {
  const held = useMemo(
    () =>
      new Map(
        roles.map((r) => [r.key, new Set<Permission>(r.key === SUPER_ADMIN ? ALL_PERMISSIONS : r.permissions)]),
      ),
    [roles],
  );

  return (
    <SectionCard
      icon={ShieldCheck}
      title="Ruxsatlar matritsasi"
      description="Qaysi rol nima qila olishini bir qarashda solishtirish"
      flush
    >
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[220px] border-b bg-card px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ruxsat
              </th>
              {roles.map((r) => {
                const Icon = roleIcon(r.key);
                return (
                  <th key={r.key} className="border-b px-1.5 py-3 text-center align-bottom">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="mx-auto flex w-14 flex-col items-center gap-1.5">
                          <div className={cn("icon-tile h-8 w-8 border", roleStyle(r.key))}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="line-clamp-2 text-[10px] font-medium leading-tight text-muted-foreground">
                            {r.name}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {r.name} · {r.userCount} ta xodim
                      </TooltipContent>
                    </Tooltip>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map((group) => (
              <MatrixGroup key={group.key} group={group} roles={roles} held={held} />
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function MatrixGroup({
  group,
  roles,
  held,
}: {
  group: (typeof PERMISSION_GROUPS)[number];
  roles: RoleWithUsage[];
  held: Map<string, Set<Permission>>;
}) {
  const perms = permissionsInGroup(group.key);
  if (perms.length === 0) return null;
  return (
    <>
      <tr>
        <td
          colSpan={roles.length + 1}
          className="sticky left-0 border-b bg-muted/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
        >
          {group.label}
        </td>
      </tr>
      {perms.map((p) => (
        <tr key={p} className="transition-colors hover:bg-muted/30">
          <td className="sticky left-0 z-10 border-b bg-card px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="font-medium">{PERMISSIONS[p].label}</span>
              {"sensitive" in PERMISSIONS[p] && (
                <AlertTriangle className="h-3 w-3 text-amber-500" aria-label="Muhim ruxsat" />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">{PERMISSIONS[p].description}</p>
          </td>
          {roles.map((r) => (
            <td key={r.key} className="border-b px-1.5 py-2.5 text-center">
              {held.get(r.key)?.has(p) ? (
                <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              ) : (
                <span className="mx-auto block h-1.5 w-1.5 rounded-full bg-muted-foreground/25" />
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- editor

/**
 * Create or edit one role. `template` pre-fills a new role from an existing
 * one ("Nusxa asosida"), which is how a clinic usually wants to make one:
 * "like a registrar, but without discounts".
 *
 * Permissions the editor does not hold themselves are shown but locked — the
 * server would refuse them anyway, and greying them out says why up front.
 */
function RoleEditor({
  open,
  onOpenChange,
  role,
  template,
  heldByMe,
  unrestricted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleWithUsage | null;
  template: RoleWithUsage | null;
  heldByMe: Permission[];
  unrestricted: boolean;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<Permission>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const source = role ?? template;
    setName(role ? role.name : template ? `${template.name} (nusxa)` : "");
    setDescription(source?.description ?? "");
    setSelected(new Set(source?.permissions ?? []));
    setError(null);
  }, [open, role, template]);

  const original = useMemo(() => new Set(role?.permissions ?? []), [role]);
  const mine = useMemo(() => new Set(heldByMe), [heldByMe]);
  // Mirrors the server: you may keep or remove what the role already has,
  // but only add what you hold yourself.
  const locked = (p: Permission) => !unrestricted && !mine.has(p) && !original.has(p);

  const toggle = (p: Permission, on: boolean) => {
    if (locked(p)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(p);
      else next.delete(p);
      return next;
    });
  };

  const toggleGroup = (perms: Permission[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of perms) {
        if (locked(p)) continue;
        if (on) next.add(p);
        else next.delete(p);
      }
      return next;
    });
  };

  const added = [...selected].filter((p) => !original.has(p)).length;
  const removed = [...original].filter((p) => !selected.has(p)).length;
  const dirty =
    !role ||
    added > 0 ||
    removed > 0 ||
    name.trim() !== role.name ||
    (description.trim() || "") !== (role.description ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const parsed = insertRoleSchema.safeParse({
        name,
        description: description.trim() || null,
        permissions: [...selected],
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Ma'lumotlarni tekshiring");
      const res = role
        ? await apiRequest("PATCH", `/api/roles/${role.key}`, parsed.data)
        : await apiRequest("POST", "/api/roles", parsed.data);
      return (await res.json()) as RoleWithUsage;
    },
    onSuccess: (saved) => {
      invalidateApi("/api/roles");
      // The signed-in user's own role may be the one that changed.
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: role ? "Rol yangilandi" : "Rol yaratildi",
        description: role && role.userCount > 0 ? `${role.userCount} ta xodimga darhol ta'sir qiladi` : saved.name,
      });
      onOpenChange(false);
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>{role ? `${role.name} — ruxsatlar` : "Yangi rol"}</DialogTitle>
          <DialogDescription>
            {role
              ? role.isSystem
                ? "TZ'dagi tizim roli. Nomi va ruxsatlarini klinikangizga moslashingiz mumkin."
                : "Klinika yaratgan maxsus rol."
              : template
                ? `"${template.name}" ruxsatlari asosida yangi rol.`
                : "Rol nomini kiriting va unga kerakli ruxsatlarni belgilang."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_1.4fr]">
            <div className="space-y-1.5">
              <Label htmlFor="role-name">Nomi</Label>
              <Input
                id="role-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Masalan: UZI shifokori"
                data-testid="input-role-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-description">Tavsif</Label>
              <Textarea
                id="role-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={1}
                className="min-h-[40px] resize-none"
                placeholder="Bu rol nima ish qiladi"
              />
            </div>
          </div>

          {role && role.userCount > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p>
                Bu rolda <b>{role.userCount} ta xodim</b> ishlaydi. O'zgarishlar ularning hammasiga bir daqiqa ichida
                ta'sir qiladi.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {PERMISSION_GROUPS.map((group) => {
              const perms = permissionsInGroup(group.key);
              if (perms.length === 0) return null;
              const on = perms.filter((p) => selected.has(p)).length;
              const allOn = on === perms.length;
              return (
                <section key={group.key} className="overflow-hidden rounded-xl border">
                  <header className="flex items-center gap-3 border-b bg-muted/40 px-4 py-2.5">
                    <Checkbox
                      checked={allOn ? true : on > 0 ? "indeterminate" : false}
                      onCheckedChange={(v) => toggleGroup(perms, v === true)}
                      aria-label={`${group.label}: barchasi`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{group.label}</p>
                      <p className="truncate text-xs text-muted-foreground">{group.description}</p>
                    </div>
                    <span className="tabular text-xs font-medium text-muted-foreground">
                      {on}/{perms.length}
                    </span>
                  </header>
                  <div className="divide-y">
                    {perms.map((p) => {
                      const def = PERMISSIONS[p];
                      const isLocked = locked(p);
                      const isOn = selected.has(p);
                      return (
                        <label
                          key={p}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/30",
                            isLocked && "cursor-not-allowed opacity-55 hover:bg-transparent",
                          )}
                        >
                          <Checkbox
                            className="mt-0.5"
                            checked={isOn}
                            disabled={isLocked}
                            onCheckedChange={(v) => toggle(p, v === true)}
                            data-testid={`perm-${p}`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-medium">{def.label}</span>
                              {"sensitive" in def && (
                                <Badge
                                  variant="outline"
                                  className="h-5 gap-1 border-amber-500/30 bg-amber-500/10 px-1.5 text-[10px] text-amber-700 dark:text-amber-300"
                                >
                                  <AlertTriangle className="h-3 w-3" />
                                  Muhim
                                </Badge>
                              )}
                              {isLocked && (
                                <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[10px]">
                                  <Lock className="h-3 w-3" />
                                  Sizda yo'q
                                </Badge>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">{def.description}</p>
                          </div>
                          <code className="hidden shrink-0 pt-0.5 font-mono text-[10px] text-muted-foreground/70 sm:block">
                            {p}
                          </code>
                        </label>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <DialogFooter className="flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:space-x-0">
          <div className="min-w-0 text-sm">
            {error ? (
              <p className="text-destructive">{error}</p>
            ) : (
              <p className="text-muted-foreground">
                <span className="tabular font-semibold text-foreground">{selected.size}</span> / {TOTAL} ruxsat
                {role && (added > 0 || removed > 0) && (
                  <span className="ml-2">
                    {added > 0 && <span className="text-emerald-600 dark:text-emerald-400">+{added}</span>}
                    {added > 0 && removed > 0 && " "}
                    {removed > 0 && <span className="text-rose-600 dark:text-rose-400">−{removed}</span>}
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Bekor qilish
            </Button>
            <Button
              onClick={() => save.mutate()}
              disabled={!dirty || save.isPending || name.trim().length < 2}
              data-testid="button-save-role"
            >
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {role ? "Saqlash" : "Yaratish"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
