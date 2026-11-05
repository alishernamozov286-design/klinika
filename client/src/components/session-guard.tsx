import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LogOut, TimerReset } from "lucide-react";
import type { SecuritySettings } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

/**
 * Client half of TZ §12 "faol bo'lmagan seanslarni yopish".
 *
 * The server is the authority (enforceSessionPolicy); this component makes the
 * limit humane. It warns a minute before the end, keeps the server informed
 * while the user is genuinely working, and signs out on time instead of
 * leaving a screen of patient data open until the next click fails.
 *
 * Activity is shared between tabs through localStorage: someone working in
 * one tab must not be signed out by another tab they left in the background.
 */

const ACTIVITY_KEY = "medlab.lastActivity";
const WARN_BEFORE_MS = 60_000;
/** Activity is written at most this often; the limit is counted in minutes. */
const WRITE_EVERY_MS = 5_000;
const EVENTS = ["mousedown", "mousemove", "keydown", "wheel", "touchstart", "scroll"] as const;

function readShared(): number {
  try {
    return Number(localStorage.getItem(ACTIVITY_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeShared(at: number) {
  try {
    localStorage.setItem(ACTIVITY_KEY, String(at));
  } catch {
    /* private mode: this tab still tracks itself */
  }
}

const mmss = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

export function SessionGuard() {
  const { logout } = useAuth();
  // The auth context hands out a fresh function each render; the timer below
  // must not restart for that.
  const logoutRef = useRef(logout);
  logoutRef.current = logout;
  const { data: policy } = useQuery<SecuritySettings>({ queryKey: ["/api/session/policy"] });

  const lastActivity = useRef(Date.now());
  const lastWrite = useRef(0);
  const lastPing = useRef(Date.now());
  const warningOpen = useRef(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  const markActive = useCallback((force = false) => {
    // While the warning is up only its button counts: a mouse drifting over
    // the dialog is not someone deciding to stay.
    if (warningOpen.current && !force) return;
    const now = Date.now();
    lastActivity.current = now;
    if (force || now - lastWrite.current > WRITE_EVERY_MS) {
      lastWrite.current = now;
      writeShared(now);
    }
  }, []);

  const ping = useCallback(async () => {
    lastPing.current = Date.now();
    // A 401 here is handled globally (session-expired event → sign-out).
    await apiRequest("POST", "/api/session/ping").catch(() => undefined);
  }, []);

  useEffect(() => {
    markActive(true);
    const onActivity = () => markActive();
    for (const e of EVENTS) window.addEventListener(e, onActivity, { passive: true, capture: true });
    return () => {
      for (const e of EVENTS) window.removeEventListener(e, onActivity, { capture: true });
    };
  }, [markActive]);

  useEffect(() => {
    if (!policy) return;
    const idleMs = policy.sessionIdleMinutes * 60_000;
    // Often enough that the server never sees an active user as idle.
    const pingEvery = Math.min(4 * 60_000, idleMs / 3);

    const tick = () => {
      const now = Date.now();
      const last = Math.max(lastActivity.current, readShared());
      const left = idleMs - (now - last);

      if (left <= 0) {
        clearInterval(timer);
        void logoutRef.current("Uzoq vaqt faollik bo'lmagani uchun seans yopildi. Qaytadan kiring.");
        return;
      }
      if (left <= WARN_BEFORE_MS) {
        warningOpen.current = true;
        setRemaining(left);
      } else if (warningOpen.current) {
        // Activity in another tab: stand down here too.
        warningOpen.current = false;
        setRemaining(null);
      }
      if (last > lastPing.current && now - lastPing.current > pingEvery) void ping();
    };

    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [policy, ping]);

  const stay = () => {
    warningOpen.current = false;
    setRemaining(null);
    markActive(true);
    void ping();
  };

  return (
    <AlertDialog open={remaining !== null}>
      <AlertDialogContent className="sm:max-w-md" data-testid="dialog-session-warning">
        <AlertDialogHeader>
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10">
            <TimerReset className="h-7 w-7 text-amber-600 dark:text-amber-400" />
          </div>
          <AlertDialogTitle className="text-center">Seans tez orada yopiladi</AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Bir muddat faollik bo'lmadi. Bemor ma'lumotlarini himoya qilish uchun seans avtomatik yopiladi.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <p
          className="text-center font-mono text-4xl font-bold tabular text-amber-600 dark:text-amber-400"
          data-testid="text-session-countdown"
        >
          {mmss(remaining ?? 0)}
        </p>
        <AlertDialogFooter className="gap-2 sm:justify-center">
          <Button variant="outline" onClick={() => void logout()}>
            <LogOut className="mr-2 h-4 w-4" />
            Chiqish
          </Button>
          <Button onClick={stay} autoFocus data-testid="button-session-stay">
            Ishni davom ettirish
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
