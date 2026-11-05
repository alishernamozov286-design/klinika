import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Loader2,
  Lock,
  LockOpen,
  LogOut,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { formatLockRemaining, lockRemainingMs } from "@shared/lockout";
import { insertUserSchema, type PublicUser, type RoleWithUsage } from "@shared/schema";
import { SUPER_ADMIN, resolvePermissions } from "@shared/permissions";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, RoleBadge, TableSkeleton } from "@/components/ui-kit";
import { SearchInput } from "@/components/inputs";
import { ExportButtons } from "@/components/export-buttons";
import type { ExportColumn } from "@/lib/export-types";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { roleIcon } from "@/components/roles-panel";
import { apiRequest, invalidateApi } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

// ---------------------------------------------------------------------- users

const userFormSchema = insertUserSchema.extend({
  // Editing an existing user may leave the password blank to keep the old one.
  password: z.string().min(5, "Parol kamida 5 ta belgi").or(z.literal("")),
});
type UserFormValues = z.input<typeof userFormSchema>;

/** Staff list — see lib/export.ts. Passwords are, of course, not in it. */
const userExportColumns = (roleName: (key: string) => string): ExportColumn<PublicUser>[] => [
  { header: "F.I.Sh", value: (u) => u.fullName, width: 30 },
  { header: "Login", value: (u) => u.username, width: 20 },
  { header: "Rol", value: (u) => roleName(u.role), width: 22 },
  { header: "Holat", value: (u) => (u.isActive ? "Faol" : "Bloklangan"), width: 14 },
];

export function UsersPanel() {
  const { toast } = useToast();
  const { user: currentUser, isSuperAdmin } = useAuth();
  const [editing, setEditing] = useState<PublicUser | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<PublicUser | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const { data: users = [], isLoading } = useQuery<PublicUser[]>({ queryKey: ["/api/users"] });
  const { data: roles = [] } = useQuery<RoleWithUsage[]>({ queryKey: ["/api/roles"] });

  const roleByKey = useMemo(() => new Map(roles.map((r) => [r.key, r])), [roles]);
  const roleName = (key: string) => roleByKey.get(key)?.name ?? key;

  /**
   * A role can be handed out only if every permission in it is one the
   * current user holds — the server's rule, shown here so the option is
   * greyed out instead of failing on save.
   */
  const mine = useMemo(() => new Set(currentUser?.permissions ?? []), [currentUser]);
  const assignable = (role: RoleWithUsage) => {
    if (role.key === SUPER_ADMIN) return isSuperAdmin;
    if (isSuperAdmin) return true;
    return resolvePermissions(role.key, role.permissions).every((p) => mine.has(p));
  };

  const isSelf = Boolean(editing && editing.id === currentUser?.id);

  const visibleUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(
      (u) =>
        (roleFilter === "all" || u.role === roleFilter) &&
        (!q || u.fullName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)),
    );
  }, [users, search, roleFilter]);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { username: "", password: "", fullName: "", role: "registrator", isActive: true },
  });

  useEffect(() => {
    if (!dialogOpen) return;
    form.reset({
      username: editing?.username ?? "",
      password: "",
      fullName: editing?.fullName ?? "",
      role: editing?.role ?? "registrator",
      isActive: editing?.isActive ?? true,
    });
  }, [dialogOpen, editing, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: UserFormValues) => {
      if (editing) {
        const payload: Record<string, unknown> = {
          username: values.username,
          fullName: values.fullName,
          role: values.role,
          isActive: values.isActive,
        };
        if (values.password) payload.password = values.password;
        const res = await apiRequest("PATCH", `/api/users/${editing.id}`, payload);
        return (await res.json()) as PublicUser;
      }
      if (!values.password) throw new Error("Yangi foydalanuvchi uchun parol majburiy");
      const res = await apiRequest("POST", "/api/users", values);
      return (await res.json()) as PublicUser;
    },
    onSuccess: () => {
      invalidateApi("/api/users");
      toast({ title: editing ? "Foydalanuvchi yangilandi" : "Foydalanuvchi qo'shildi" });
      setDialogOpen(false);
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Saqlanmadi", description: err.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      invalidateApi("/api/users");
      toast({ title: "Foydalanuvchi o'chirildi" });
      setDeleting(null);
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "O'chirilmadi", description: err.message }),
  });

  /** Signs a member of staff out on every device — a lost phone, a dismissal. */
  const revokeMutation = useMutation({
    mutationFn: async (user: PublicUser) => {
      const res = await apiRequest("POST", `/api/users/${user.id}/sessions/revoke`);
      return { user, ...((await res.json()) as { ended: number }) };
    },
    onSuccess: ({ user, ended }) =>
      toast({
        title: ended ? `${ended} ta seans yopildi` : "Ochiq seans yo'q",
        description: user.fullName,
      }),
    onError: (err: Error) => toast({ variant: "destructive", title: "Yopilmadi", description: err.message }),
  });

  /** The escape hatch from the escalating login lockout — see shared/lockout.ts. */
  const unlockMutation = useMutation({
    mutationFn: async (user: PublicUser) => {
      await apiRequest("POST", `/api/users/${user.id}/unlock`);
      return user;
    },
    onSuccess: (user) => {
      invalidateApi("/api/users");
      toast({
        title: "Qulf ochildi",
        description: `${user.fullName} endi tizimga kira oladi`,
      });
    },
    onError: (err: Error) =>
      toast({ variant: "destructive", title: "Ochilmadi", description: err.message }),
  });

  return (
    <div className="space-y-4">
      <div className="card-premium flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Ism yoki login bo'yicha qidirish"
            className="sm:max-w-xs"
            data-testid="input-search-users"
          />
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="sm:w-56" data-testid="select-filter-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha rollar ({users.length})</SelectItem>
              {roles
                .filter((r) => r.userCount > 0)
                .map((r) => (
                  <SelectItem key={r.key} value={r.key}>
                    {r.name} ({r.userCount})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <ExportButtons
            testIdPrefix="export-users"
            disabled={isLoading}
            build={() => ({
              filename: "xodimlar",
              title: "Xodimlar ro'yxati",
              subtitle: `${visibleUsers.length} ta xodim`,
              sheetName: "Xodimlar",
              columns: userExportColumns(roleName),
              rows: visibleUsers,
            })}
          />
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            data-testid="button-add-user"
          >
            <Plus className="mr-2 h-4 w-4" />
            Yangi xodim
          </Button>
        </div>
      </div>

      <div className="card-premium overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={3} />
        ) : (
          <Table className="table-premium">
            <TableHeader>
              <TableRow>
                <TableHead>Xodim</TableHead>
                <TableHead>Login</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="text-center">Holat</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    Hech kim topilmadi
                  </TableCell>
                </TableRow>
              )}
              {visibleUsers.map((u) => (
                <TableRow key={u.id} data-testid={`row-user-${u.username}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={u.fullName} size="sm" />
                      <span className="font-medium">{u.fullName}</span>
                      {u.id === currentUser?.id && (
                        <Badge variant="secondary" className="text-[10px]">Siz</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">@{u.username}</TableCell>
                  <TableCell>
                    <RoleBadge role={u.role} name={roleName(u.role)} />
                  </TableCell>
                  <TableCell className="text-center">
                    {/* A lock outranks the active flag: an enabled account
                        nobody can sign in to is the thing an admin needs to
                        notice first. */}
                    {lockRemainingMs(u.lockedUntil) > 0 ? (
                      <Badge
                        variant="outline"
                        className="gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        data-testid={`badge-locked-${u.username}`}
                      >
                        <Lock className="h-3 w-3" />
                        {formatLockRemaining(lockRemainingMs(u.lockedUntil))}
                      </Badge>
                    ) : u.isActive ? (
                      <Badge
                        variant="outline"
                        className="gap-1.5 border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Faol
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="gap-1.5 border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                        Bloklangan
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {lockRemainingMs(u.lockedUntil) > 0 && (
                          <DropdownMenuItem
                            onClick={() => unlockMutation.mutate(u)}
                            disabled={unlockMutation.isPending}
                            data-testid={`button-unlock-${u.username}`}
                          >
                            <LockOpen className="mr-2 h-4 w-4" />
                            Qulfni ochish
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => {
                            setEditing(u);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Tahrirlash
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => revokeMutation.mutate(u)}
                          disabled={revokeMutation.isPending}
                          data-testid={`button-revoke-sessions-${u.username}`}
                        >
                          <LogOut className="mr-2 h-4 w-4" />
                          {u.id === currentUser?.id ? "Boshqa seanslarimni yopish" : "Seanslarini yopish"}
                        </DropdownMenuItem>
                        {u.id !== currentUser?.id && (
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(u)}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            O'chirish
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Xodimni tahrirlash" : "Yangi xodim"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Parol maydonini bo'sh qoldirsangiz, eski parol saqlanadi."
                : "Xodim shu login va parol bilan tizimga kiradi."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form id="user-form" onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>F.I.Sh</FormLabel>
                    <FormControl>
                      <Input data-testid="input-user-fullname" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Login</FormLabel>
                      <FormControl>
                        <Input autoComplete="off" data-testid="input-user-username" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parol</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="new-password"
                          placeholder={editing ? "O'zgarishsiz" : ""}
                          data-testid="input-user-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => {
                  const chosen = roleByKey.get(field.value);
                  return (
                    <FormItem>
                      <FormLabel>Rol</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isSelf}>
                        <FormControl>
                          <SelectTrigger data-testid="select-user-role">
                            <SelectValue placeholder="Rolni tanlang" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-80">
                          {roles.map((r) => {
                            const Icon = roleIcon(r.key);
                            const ok = assignable(r) || r.key === editing?.role;
                            return (
                              <SelectItem key={r.key} value={r.key} disabled={!ok}>
                                <span className="flex items-center gap-2">
                                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                  {r.name}
                                  {!ok && <span className="text-[10px] text-muted-foreground">· vakolat yetmaydi</span>}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {isSelf
                          ? "O'z rolingizni o'zgartira olmaysiz."
                          : chosen
                            ? `${chosen.description ?? ""} · ${
                                chosen.key === SUPER_ADMIN ? "barcha" : chosen.permissions.length
                              } ta ruxsat`
                            : null}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <Label>Faol hisob</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        O'chirilsa, xodim tizimga kira olmaydi
                      </p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSelf} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </form>
          </Form>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" form="user-form" disabled={saveMutation.isPending} data-testid="button-save-user">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Xodimni o'chirish"
        description={
          <>
            <strong>{deleting?.fullName}</strong> tizimdan o'chiriladi va boshqa kira olmaydi.
          </>
        }
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
