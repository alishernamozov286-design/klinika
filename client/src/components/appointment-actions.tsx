/**
 * Status moves on an appointment, shared by the queue (desk) and the
 * doctor's cabinet. The server decides who may make which move
 * (shared/appointment.ts); the screens only offer the moves that apply.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus, type AppointmentWithDetails } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, invalidateApi } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDay } from "@/lib/format";

const SUCCESS_TITLES: Partial<Record<AppointmentStatus, string>> = {
  arrived: "Bemor keldi deb belgilandi",
  in_progress: "Bemor qabulga chaqirildi",
  completed: "Qabul yakunlandi",
  no_show: "Kelmadi deb belgilandi",
  cancelled: "Qabul bekor qilindi",
  scheduled: "Belgi bekor qilindi",
};

export function useAppointmentStatus() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (v: { appointment: AppointmentWithDetails; status: AppointmentStatus; reason?: string | null }) => {
      const res = await apiRequest("POST", `/api/appointments/${v.appointment.id}/status`, {
        status: v.status,
        reason: v.reason ?? null,
      });
      return (await res.json()) as AppointmentWithDetails;
    },
    onSuccess: (a, v) => {
      invalidateApi("/api/appointments", "/api/cabinet", "/api/doctors", "/api/reception");
      toast({
        title: SUCCESS_TITLES[v.status] ?? APPOINTMENT_STATUS_LABELS[v.status],
        description: `№${a.queueNumber} · ${a.patientName}`,
      });
    },
    onError: (err: Error) => {
      // Someone else may have moved it: show what is true now.
      invalidateApi("/api/appointments", "/api/cabinet", "/api/reception");
      toast({ variant: "destructive", title: "Bajarilmadi", description: err.message });
    },
  });
}

/** Cancelling needs a reason in writing (TZ §10: nothing is deleted, it is cancelled with a reason). */
export function CancelAppointmentDialog({
  appointment,
  onOpenChange,
}: {
  appointment: AppointmentWithDetails | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [reason, setReason] = useState("");
  const status = useAppointmentStatus();
  const close = () => {
    setReason("");
    onOpenChange(false);
  };

  return (
    <Dialog open={Boolean(appointment)} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Qabulni bekor qilish</DialogTitle>
          <DialogDescription>
            {appointment &&
              `№${appointment.queueNumber} ${appointment.patientName} — ${appointment.doctorName}, ${formatDay(appointment.date)} ${appointment.startTime}. Yozuv o'chirilmaydi, tarixda "bekor qilindi" bo'lib qoladi.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="cancel-reason">Sabab</Label>
          <Textarea
            id="cancel-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Masalan: bemor qo'ng'iroq qilib, boshqa kunga o'tkazishni so'radi"
            autoFocus
            maxLength={300}
            data-testid="input-cancel-reason"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Ortga
          </Button>
          <Button
            variant="destructive"
            disabled={reason.trim().length < 3 || status.isPending}
            onClick={() =>
              appointment &&
              status.mutate({ appointment, status: "cancelled", reason: reason.trim() }, { onSuccess: close })
            }
            data-testid="button-confirm-cancel-appointment"
          >
            {status.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Bekor qilish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
