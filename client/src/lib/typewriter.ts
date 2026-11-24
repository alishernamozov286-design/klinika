/**
 * The "printing" effect for streamed answers: what has arrived is kept here
 * and revealed a few characters per animation frame, so text types out
 * instead of landing in blocks. Honours prefers-reduced-motion (shows at once).
 */
import { typewriterStep } from "@shared/assistant";

export type Typewriter = {
  /** The whole text received so far. */
  push: (full: string) => void;
  /** Resolves once everything pushed is on screen (or stop() was called). */
  finish: () => Promise<void>;
  /** Stops typing where it is; returns what is on screen. */
  stop: () => string;
};

export function typewriter(onFrame: (shown: string) => void): Typewriter {
  const instant = typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  let target = "";
  let shown = 0;
  let raf = 0;
  let stopped = false;
  let streamDone = false;
  let resolveFinish: (() => void) | null = null;

  const settle = () => {
    if (resolveFinish && (stopped || (streamDone && shown >= target.length))) {
      resolveFinish();
      resolveFinish = null;
    }
  };
  const tick = () => {
    raf = 0;
    if (stopped) return settle();
    const step = instant ? target.length - shown : typewriterStep(target.length - shown);
    if (step > 0) {
      shown = Math.min(target.length, shown + step);
      onFrame(target.slice(0, shown));
    }
    if (shown < target.length) raf = requestAnimationFrame(tick);
    settle();
  };
  const kick = () => {
    if (!raf && !stopped) raf = requestAnimationFrame(tick);
  };

  return {
    push(full) {
      target = full;
      kick();
    },
    finish() {
      streamDone = true;
      return new Promise<void>((resolve) => {
        resolveFinish = resolve;
        if (shown < target.length) kick();
        settle();
      });
    },
    stop() {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      settle();
      return target.slice(0, shown);
    },
  };
}
