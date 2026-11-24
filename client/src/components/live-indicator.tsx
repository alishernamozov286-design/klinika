/**
 * B8.1: the header's "Jonli" pill. It runs the change feed for this tab and
 * says whether the screen is up to date by itself — green while changes
 * arrive within seconds, amber when the connection is lost (the page then
 * refreshes on its own timers), grey while the feed is not set up.
 */
import { useEffect, useState } from "react";
import { Radio, WifiOff } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { startLiveUpdates, useLiveState, type LiveStatus } from "@/lib/live-updates";
import { cn } from "@/lib/utils";

const LOOK: Record<LiveStatus, { label: string; hint: string; dot: string; text: string }> = {
  live: {
    label: "Jonli",
    hint: "Boshqa xodimlar kiritgan o'zgarishlar bir necha soniyada shu ekranda paydo bo'ladi.",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  paused: {
    label: "Jonli",
    hint: "Oyna yashirin — qaytib kirganingizda darhol yangilanadi.",
    dot: "bg-emerald-500/50",
    text: "text-muted-foreground",
  },
  connecting: {
    label: "Ulanmoqda",
    hint: "O'zgarishlar oqimiga ulanmoqda…",
    dot: "bg-muted-foreground/50",
    text: "text-muted-foreground",
  },
  offline: {
    label: "Aloqa yo'q",
    hint: "Server bilan aloqa uzildi. Qayta ulanishga urinilmoqda; ulanguncha ekran o'z vaqtida yangilanadi.",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
  },
  unavailable: {
    label: "Davriy",
    hint: "Jonli yangilanish hali yoqilmagan — ekran har 15–60 soniyada o'zi yangilanadi.",
    dot: "bg-muted-foreground/50",
    text: "text-muted-foreground",
  },
};

const clock = (at: number) => new Date(at).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

export function LiveIndicator() {
  useEffect(() => startLiveUpdates(), []);
  const { status, lastChangeAt } = useLiveState();
  const look = LOOK[status];
  // "Yangilandi" flashes for a moment when a change arrives.
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!lastChangeAt) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 1800);
    return () => clearTimeout(t);
  }, [lastChangeAt]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="status"
          aria-live="polite"
          data-testid="status-live"
          data-status={status}
          className={cn(
            "hidden items-center gap-1.5 rounded-full border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors sm:flex",
            look.text,
            flash && "border-emerald-500/40 bg-emerald-500/10",
          )}
        >
          {status === "offline" ? (
            <WifiOff className="h-3.5 w-3.5" />
          ) : (
            <span className="relative flex h-2 w-2">
              {status === "live" && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />}
              <span className={cn("relative inline-flex h-2 w-2 rounded-full", look.dot)} />
            </span>
          )}
          <span>{flash ? "Yangilandi" : look.label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">
        <p className="flex items-center gap-1.5 font-semibold">
          <Radio className="h-3.5 w-3.5" /> Real-time yangilanish
        </p>
        <p className="mt-1 text-muted-foreground">{look.hint}</p>
        {lastChangeAt && <p className="mt-1 tabular text-muted-foreground">Oxirgi o'zgarish: {clock(lastChangeAt)}</p>}
      </TooltipContent>
    </Tooltip>
  );
}
