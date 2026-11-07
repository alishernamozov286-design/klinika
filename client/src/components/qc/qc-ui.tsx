/** Small pieces shared by the QC screens (B4.8). */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { LabDeviceWithStats, Test } from "@shared/schema";
import { QC_STATUS_LABELS, daysUntil, type QcStatus } from "@shared/qc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusGlyph } from "@/components/qc/lj-chart";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";

const STATUS_TONE: Record<QcStatus, string> = {
  ok: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  reject: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

export function QcStatusBadge({ status, className }: { status: QcStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", STATUS_TONE[status], className)}>
      <StatusGlyph status={status} size={9} />
      {QC_STATUS_LABELS[status]}
    </Badge>
  );
}

/** "Muddati o'tgan" / "N kun qoldi" for a YYYY-MM-DD expiry; quiet when far off. */
export function ExpiryBadge({ day, today, soonDays = 30 }: { day: string | null; today: string; soonDays?: number }) {
  if (!day) return <span className="text-muted-foreground">—</span>;
  const left = daysUntil(day, today);
  if (left < 0)
    return (
      <span className="font-medium text-rose-700 dark:text-rose-300" title={formatDate(day)}>
        Muddati o'tgan · {formatDate(day)}
      </span>
    );
  if (left <= soonDays)
    return (
      <span className="font-medium text-amber-700 dark:text-amber-300" title={formatDate(day)}>
        {formatDate(day)} · {left} kun qoldi
      </span>
    );
  return <span className="tabular">{formatDate(day)}</span>;
}

/** "YYYY-MM-DDTHH:mm" in local time, for a datetime-local input. */
export const localNow = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
/** A datetime-local value as ISO, or null when empty. */
export const toIso = (local: string) => (local ? new Date(local).toISOString() : null);
/** "12,5" or "12.5" → 12.5; anything else → NaN (the server then explains). */
export const parseNumber = (s: string) => (s.trim() === "" ? Number.NaN : Number(s.replace(",", ".").trim()));
export const fmtNum = (n: number) => String(Number(n.toFixed(Math.abs(n) >= 100 ? 1 : Math.abs(n) >= 10 ? 2 : 3)));

export function useLabTests() {
  return useQuery<Test[]>({ queryKey: ["/api/tests?all=1"] }).data ?? [];
}
export function useLabDevices() {
  return useQuery<LabDeviceWithStats[]>({ queryKey: ["/api/devices"] }).data ?? [];
}

/** Asks for a sentence (a corrective action, a void reason) and sends it. */
export function TextPromptDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  placeholder,
  confirmLabel,
  destructive,
  pending,
  error,
  onConfirm,
  testId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  label: string;
  placeholder?: string;
  confirmLabel: string;
  destructive?: boolean;
  pending?: boolean;
  error?: string | null;
  onConfirm: (text: string) => void;
  testId: string;
}) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (open) setText("");
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor={`${testId}-text`}>{label}</Label>
          <Textarea
            id={`${testId}-text`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder={placeholder}
            data-testid={`input-${testId}`}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={() => onConfirm(text.trim())}
            data-testid={`button-confirm-${testId}`}
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
