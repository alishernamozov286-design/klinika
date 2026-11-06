/**
 * Settings → Klinika: the logo on the result blank and the visit summary
 * (B4.7, TZ §6.3). The picked image is scaled and re-encoded in the browser
 * (lib/logo.ts); the server checks it again before storing.
 */
import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import type { ClinicLogo } from "@shared/branding";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui-kit";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { apiRequest, invalidateApi } from "@/lib/queryClient";
import { LOGO_ACCEPT, prepareLogo } from "@/lib/logo";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/format";

export function LogoPanel() {
  const { toast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { data: logo, isLoading } = useQuery<ClinicLogo | null>({ queryKey: ["/api/settings/logo"] });

  const upload = useMutation({
    mutationFn: async (dataUrl: string) => (await apiRequest("PUT", "/api/settings/logo", { dataUrl })).json() as Promise<ClinicLogo>,
    onSuccess: () => {
      invalidateApi("/api/settings/logo");
      toast({ title: "Logotip saqlandi", description: "Natija blankasi va ko'rik xulosasida chiqadi" });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Logotip saqlanmadi", description: err.message }),
  });

  const remove = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/settings/logo");
    },
    onSuccess: () => {
      invalidateApi("/api/settings/logo");
      setRemoving(false);
      toast({ title: "Logotip olib tashlandi" });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Olib tashlanmadi", description: err.message }),
  });

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setPreparing(true);
    try {
      upload.mutate(await prepareLogo(file));
    } catch (err) {
      toast({ variant: "destructive", title: "Rasm qabul qilinmadi", description: (err as Error).message });
    } finally {
      setPreparing(false);
      if (input.current) input.current.value = "";
    }
  };

  const busy = preparing || upload.isPending;

  return (
    <SectionCard
      icon={ImageIcon}
      title="Klinika logotipi"
      description="Natija blankasi va ko'rik xulosasining shapkasida chiqadi"
      className="max-w-3xl"
      bodyClassName="p-6"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        {/* Shown on white, as it will print. */}
        <div
          className="flex h-28 w-full shrink-0 items-center justify-center rounded-xl border border-dashed bg-white p-3 sm:w-60"
          data-testid="logo-preview"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : logo ? (
            <img src={logo.dataUrl} alt="Klinika logotipi" className="max-h-full max-w-full object-contain" />
          ) : (
            <div className="text-center text-xs text-slate-500">
              <ImageIcon className="mx-auto mb-1.5 h-6 w-6 text-slate-400" />
              Logotip yuklanmagan
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-sm text-muted-foreground">
            PNG, JPEG yoki WebP. Rasm avtomatik kichraytiriladi; shaffof fonli PNG eng yaxshi chiqadi.
          </p>
          {logo && (
            <p className="text-xs text-muted-foreground" data-testid="text-logo-meta">
              {logo.mime === "image/png" ? "PNG" : "JPEG"} · {Math.max(1, Math.round(logo.bytes / 1024))} KB · {formatDateTime(logo.updatedAt)}
              {logo.updatedByName ? ` · ${logo.updatedByName}` : ""}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <input
              ref={input}
              type="file"
              accept={LOGO_ACCEPT}
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0])}
              data-testid="input-logo-file"
            />
            <Button type="button" onClick={() => input.current?.click()} disabled={busy} data-testid="button-logo-upload">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {logo ? "Almashtirish" : "Yuklash"}
            </Button>
            {logo && (
              <Button
                type="button"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setRemoving(true)}
                disabled={busy}
                data-testid="button-logo-remove"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Olib tashlash
              </Button>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title="Logotipni olib tashlaysizmi?"
        description="Blankalar va xulosalar logotipsiz, faqat klinika nomi bilan chiqadi. Keyin yangisini yuklash mumkin."
        confirmLabel="Olib tashlash"
        isPending={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </SectionCard>
  );
}
