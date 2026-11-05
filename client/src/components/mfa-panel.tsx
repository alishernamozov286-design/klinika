/**
 * Two-factor sign-in screens (B1.8, TZ §12): the user's own switch on the
 * settings page, the clinic's "mandatory for these roles" policy, and the
 * full-screen gate shown to staff whose role requires 2FA before they have
 * set it up.
 */
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Copy, Download, Loader2, LogOut, RefreshCw, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import type { MfaSetup, MfaStatus, RoleWithUsage, SecuritySettings } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SectionCard } from "@/components/ui-kit";
import { apiRequest, invalidateApi } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime } from "@/lib/format";

/** Recovery codes, shown exactly once. */
function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const text = codes.join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the codes are on screen and downloadable */
    }
  };

  const download = () => {
    const blob = new Blob([`NEOGEN CLINIC — zaxira kodlar\nHar biri bir marta ishlaydi.\n\n${text}\n`], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "zaxira-kodlar.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4" data-testid="mfa-recovery-codes">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-sm text-amber-800 dark:text-amber-200">
        <p className="font-semibold">Zaxira kodlarni hozir saqlang</p>
        <p className="mt-1 text-[13px] leading-relaxed">
          Telefon yo'qolsa yoki almashsa, shu kodlar bilan kirasiz. Har bir kod bir marta ishlaydi. Bu ro'yxat
          boshqa ko'rsatilmaydi.
        </p>
      </div>
      <div className="grid max-w-sm grid-cols-2 gap-2 rounded-xl border bg-muted/40 p-4 font-mono text-sm tracking-wider">
        {codes.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? "Nusxalandi" : "Nusxalash"}
        </Button>
        <Button variant="outline" size="sm" onClick={download}>
          <Download className="mr-2 h-4 w-4" />
          Faylga saqlash
        </Button>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={saved} onCheckedChange={(v) => setSaved(v === true)} data-testid="check-codes-saved" />
        Kodlarni xavfsiz joyga saqladim
      </label>
      <Button onClick={onDone} disabled={!saved} data-testid="button-codes-done">
        Tayyor
      </Button>
    </div>
  );
}

type Step = "idle" | "password" | "scan" | "codes" | "disable" | "regenerate";

/** The user's own 2FA switch. Also the body of the forced-enrolment screen. */
export function MfaPanel({ onEnabled }: { onEnabled?: () => void }) {
  const { toast } = useToast();
  const { data: status, isLoading } = useQuery<MfaStatus>({ queryKey: ["/api/user/mfa"] });
  const [step, setStep] = useState<Step>("idle");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep("idle");
    setPassword("");
    setCode("");
    setSetup(null);
    setError(null);
  };
  const fail = (err: Error) => setError(err.message);

  const startSetup = useMutation({
    mutationFn: async () => (await (await apiRequest("POST", "/api/user/mfa/setup", { password })).json()) as MfaSetup,
    onSuccess: (data) => {
      setSetup(data);
      setPassword("");
      setError(null);
      setStep("scan");
    },
    onError: fail,
  });

  const enable = useMutation({
    mutationFn: async () =>
      (await (await apiRequest("POST", "/api/user/mfa/enable", { code })).json()) as { recoveryCodes: string[] },
    onSuccess: (data) => {
      setCodes(data.recoveryCodes);
      setSetup(null);
      setCode("");
      setError(null);
      setStep("codes");
      invalidateApi("/api/user/mfa", "/api/sessions", "/api/users/mfa");
    },
    onError: fail,
  });

  const disable = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/user/mfa/disable", { password, code });
    },
    onSuccess: () => {
      invalidateApi("/api/user/mfa", "/api/users/mfa");
      toast({ title: "Ikki bosqichli kirish o'chirildi" });
      reset();
    },
    onError: fail,
  });

  const regenerate = useMutation({
    mutationFn: async () =>
      (await (await apiRequest("POST", "/api/user/mfa/recovery-codes", { code })).json()) as { recoveryCodes: string[] },
    onSuccess: (data) => {
      setCodes(data.recoveryCodes);
      setCode("");
      setError(null);
      setStep("codes");
      invalidateApi("/api/user/mfa");
    },
    onError: fail,
  });

  const submitOnEnter = (action: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter") action();
  };

  return (
    <SectionCard
      icon={Smartphone}
      title="Ikki bosqichli kirish"
      description="Parolga qo'shimcha: telefondagi autentifikator ilovasidan 6 xonali kod (TZ §12)"
      action={
        status?.enabled ? (
          <Badge
            variant="outline"
            className="gap-1.5 border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            data-testid="badge-mfa-enabled"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Yoqilgan
          </Badge>
        ) : undefined
      }
    >
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : !status?.available ? (
        <p className="text-sm text-muted-foreground">
          Ma'lumotlar bazasi hali yangilanmagan. Administrator <code className="rounded bg-muted px-1.5 py-0.5">npm run db:mfa</code>{" "}
          buyrug'ini bajarishi kerak.
        </p>
      ) : step === "codes" ? (
        <RecoveryCodes
          codes={codes}
          onDone={() => {
            const wasEnrolment = !status.enabled || codes.length > 0;
            reset();
            setCodes([]);
            if (wasEnrolment) onEnabled?.();
          }}
        />
      ) : step === "password" ? (
        <div className="max-w-md space-y-4">
          <p className="text-sm text-muted-foreground">Davom etish uchun joriy parolingizni kiriting.</p>
          <div className="space-y-1.5">
            <Label htmlFor="mfa-password">Joriy parol</Label>
            <Input
              id="mfa-password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={submitOnEnter(() => password && startSetup.mutate())}
              data-testid="input-mfa-password"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={() => startSetup.mutate()} disabled={!password || startSetup.isPending} data-testid="button-mfa-continue">
              {startSetup.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Davom etish
            </Button>
            <Button variant="ghost" onClick={reset}>
              Bekor qilish
            </Button>
          </div>
        </div>
      ) : step === "scan" && setup ? (
        <div className="space-y-5">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Telefoningizda Google Authenticator, Microsoft Authenticator yoki shunga o'xshash ilovani oching.</li>
            <li>QR-kodni skanerlang (yoki kalitni qo'lda kiriting).</li>
            <li>Ilova ko'rsatgan 6 xonali kodni pastga yozing.</li>
          </ol>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <img
              src={setup.qrDataUrl}
              alt="Autentifikator uchun QR-kod"
              className="h-[200px] w-[200px] shrink-0 rounded-xl border bg-white p-2"
              data-testid="img-mfa-qr"
            />
            <div className="min-w-0 max-w-sm space-y-4">
              <div className="space-y-1.5">
                <Label>Qo'lda kiritish uchun kalit</Label>
                <p className="break-all rounded-lg border bg-muted/40 px-3 py-2 font-mono text-sm tracking-wider" data-testid="text-mfa-secret">
                  {setup.secret.match(/.{1,4}/g)?.join(" ")}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mfa-enable-code">Ilovadagi kod</Label>
                <Input
                  id="mfa-enable-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={submitOnEnter(() => code && enable.mutate())}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={7}
                  placeholder="123 456"
                  className="font-mono text-lg tracking-widest"
                  data-testid="input-mfa-enable-code"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button onClick={() => enable.mutate()} disabled={!code.trim() || enable.isPending} data-testid="button-mfa-enable">
                  {enable.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Yoqish
                </Button>
                <Button variant="ghost" onClick={reset}>
                  Bekor qilish
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : step === "disable" || step === "regenerate" ? (
        <div className="max-w-md space-y-4">
          <p className="text-sm text-muted-foreground">
            {step === "disable"
              ? "O'chirish uchun parol va ilovadagi (yoki zaxira) kodni kiriting."
              : "Yangi zaxira kodlar yaratiladi, eskilari ishlamay qoladi. Ilovadagi (yoki zaxira) kodni kiriting."}
          </p>
          {step === "disable" && (
            <div className="space-y-1.5">
              <Label htmlFor="mfa-disable-password">Joriy parol</Label>
              <Input
                id="mfa-disable-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="input-mfa-disable-password"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="mfa-step-code">Kod</Label>
            <Input
              id="mfa-step-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
              maxLength={16}
              className="font-mono tracking-widest"
              data-testid="input-mfa-step-code"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            {step === "disable" ? (
              <Button
                variant="destructive"
                onClick={() => disable.mutate()}
                disabled={!password || !code.trim() || disable.isPending}
                data-testid="button-mfa-disable-confirm"
              >
                {disable.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                O'chirish
              </Button>
            ) : (
              <Button onClick={() => regenerate.mutate()} disabled={!code.trim() || regenerate.isPending} data-testid="button-mfa-regenerate-confirm">
                {regenerate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Yangi kodlar yaratish
              </Button>
            )}
            <Button variant="ghost" onClick={reset}>
              Bekor qilish
            </Button>
          </div>
        </div>
      ) : status.enabled ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {status.enabledAt && <>Yoqilgan: {formatDateTime(status.enabledAt)}. </>}
            Zaxira kodlar qoldi: <strong className="text-foreground">{status.recoveryCodesLeft}</strong>
            {status.recoveryCodesLeft <= 2 && <span className="text-amber-600 dark:text-amber-400"> — yangilab qo'ying</span>}.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setStep("regenerate")} data-testid="button-mfa-regenerate">
              <RefreshCw className="mr-2 h-4 w-4" />
              Zaxira kodlarni yangilash
            </Button>
            {status.required ? (
              <p className="self-center text-xs text-muted-foreground">
                Rolingiz uchun majburiy — o'zingiz o'chira olmaysiz.
              </p>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setStep("disable")}
                data-testid="button-mfa-disable"
              >
                <ShieldOff className="mr-2 h-4 w-4" />
                O'chirish
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Yoqilgach, tizimga kirishda paroldan keyin ilovadagi kod so'raladi. Parol o'g'irlansa ham hisobingizga
            begona kira olmaydi.
          </p>
          <Button onClick={() => setStep("password")} data-testid="button-mfa-start">
            <ShieldCheck className="mr-2 h-4 w-4" />
            Yoqish
          </Button>
        </div>
      )}
    </SectionCard>
  );
}

/** The clinic-wide rule: which roles must use 2FA. */
export function MfaPolicyPanel() {
  const { can } = useAuth();
  const { toast } = useToast();
  const allowed = can("settings.manage");
  const { data } = useQuery<SecuritySettings>({ queryKey: ["/api/settings/security"], enabled: allowed });
  const { data: roles = [] } = useQuery<RoleWithUsage[]>({ queryKey: ["/api/roles"], enabled: allowed });
  const { data: status } = useQuery<MfaStatus>({ queryKey: ["/api/user/mfa"], enabled: allowed });
  const [picked, setPicked] = useState<string[] | null>(null);

  const current = picked ?? data?.mfaRequiredRoles ?? [];
  const dirty = Boolean(data) && picked !== null && [...picked].sort().join() !== [...data!.mfaRequiredRoles].sort().join();

  const save = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", "/api/settings/security", { mfaRequiredRoles: current });
    },
    onSuccess: () => {
      invalidateApi("/api/settings/security", "/api/session/policy", "/api/user/mfa");
      setPicked(null);
      toast({
        title: "2FA siyosati saqlandi",
        description: "Ro'yxatdagi rollar keyingi kirishda 2FA ni sozlashga majbur bo'ladi",
      });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Saqlanmadi", description: err.message }),
  });

  if (!allowed) return null;

  const toggle = (key: string, on: boolean) =>
    setPicked(on ? [...new Set([...current, key])] : current.filter((k) => k !== key));

  return (
    <SectionCard
      icon={ShieldCheck}
      title="2FA ni majburiy qilish"
      description="Tanlangan rollardagi xodimlar 2FA ni sozlamaguncha tizimdan foydalana olmaydi"
    >
      {status && !status.available ? (
        <p className="text-sm text-muted-foreground">
          Avval <code className="rounded bg-muted px-1.5 py-0.5">npm run db:mfa</code> bajarilishi kerak.
        </p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((r) => (
              <label
                key={r.key}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-muted/50"
              >
                <Checkbox
                  checked={current.includes(r.key)}
                  onCheckedChange={(v) => toggle(r.key, v === true)}
                  data-testid={`check-mfa-role-${r.key}`}
                />
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                <span className="text-xs text-muted-foreground">{r.userCount}</span>
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Telefon almashgan xodimning 2FA sini Xodimlar sahifasidan qayta o'rnatish mumkin.
          </p>
          <Button className="mt-4" onClick={() => save.mutate()} disabled={!dirty || save.isPending} data-testid="button-save-mfa-policy">
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Saqlash
          </Button>
        </>
      )}
    </SectionCard>
  );
}

/**
 * Shown instead of the app to staff whose role requires 2FA and who have not
 * set it up. The server refuses every other call meanwhile (requireMfaEnrollment).
 */
export function MfaEnrollmentGate() {
  const { user, logout } = useAuth();
  return (
    <div className="aurora flex min-h-screen items-center justify-center p-5">
      <div className="w-full max-w-2xl space-y-4">
        <div className="card-premium p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Xavfsizlik talabi</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Ikki bosqichli kirishni sozlang</h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            {user?.fullName}, rolingiz ({user?.roleName}) uchun ikki bosqichli autentifikatsiya majburiy. Sozlab
            bo'lgach tizimdan foydalanishni davom ettirasiz.
          </p>
        </div>
        <MfaPanel
          onEnabled={() => {
            invalidateApi("/api/user");
          }}
        />
        <Button variant="ghost" size="sm" onClick={() => logout()} data-testid="button-mfa-gate-logout">
          <LogOut className="mr-2 h-4 w-4" />
          Chiqish
        </Button>
      </div>
    </div>
  );
}
