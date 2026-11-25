/**
 * AI Hospital — the floating assistant (rules: shared/assistant.ts, server:
 * server/assistant.ts). A round "bilim" button sits bottom-right on every
 * page; it opens a chat that answers how to do things in the system for the
 * person's role and page. Answers stream in as they are written.
 *
 * Chats are kept in this browser for this user only (cleared on sign-out),
 * up to 20 of them. Nothing is stored on the server.
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, BrainCircuit, Check, Clock, Copy, Plus, RotateCcw, SendHorizontal, ShieldCheck, Sparkles, Square, Trash2, X } from "lucide-react";
import { ASSISTANT_NAME, MAX_MESSAGE_CHARS, isKnownPage, suggestionsFor, type AssistantStatus } from "@shared/assistant";
import { useAuth } from "@/hooks/use-auth";
import { typewriter } from "@/lib/typewriter";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "model"; text: string; at: number; error?: boolean };
type Chat = { id: string; title: string; updatedAt: number; messages: Msg[] };

const MAX_CHATS = 20;
const MAX_KEPT_MESSAGES = 60;
const storeKey = (userId: string) => `medlab.ai.${userId}`;

function loadChats(userId: string): Chat[] {
  try {
    const raw = JSON.parse(localStorage.getItem(storeKey(userId)) ?? "[]");
    return Array.isArray(raw) ? raw.filter((c) => c && Array.isArray(c.messages)) : [];
  } catch {
    return [];
  }
}
function saveChats(userId: string, chats: Chat[]) {
  try {
    localStorage.setItem(storeKey(userId), JSON.stringify(chats.slice(0, MAX_CHATS)));
  } catch {
    /* full or unavailable: the chat still works, it just is not kept */
  }
}
const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const hhmm = (at: number) => new Date(at).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", hour12: false });
const dayLabel = (at: number) => {
  const d = new Date(at);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return `Bugun, ${hhmm(at)}`;
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}, ${hhmm(at)}`;
};

// ------------------------------------------------------------ a small, safe markdown

/** **bold**, *italic*, `code` and [links](/path) — built as React nodes, never as HTML. */
const CARET = "\u2063";

function inline(text: string, onLink: (href: string) => void): ReactNode[] {
  const out: ReactNode[] = [];
  /** Plain text, with the typing caret where the sentinel sits. */
  const pushText = (t: string) => {
    const parts = t.split(CARET);
    parts.forEach((p, i) => {
      if (p) out.push(p);
      if (i < parts.length - 1) out.push(<span key={`caret-${out.length}`} aria-hidden className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[3px] animate-pulse rounded-full bg-violet-500" data-testid="ai-caret" />);
    });
  };
  const re = /(\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) pushText(text.slice(last, m.index));
    if (m[2]) out.push(<strong key={k++} className="font-semibold">{m[2]}</strong>);
    else if (m[3]) {
      const href = m[4];
      const internal = href.startsWith("/");
      // A path the app does not have (the model guessed) stays plain text.
      out.push(
        internal && !isKnownPage(href) ? (
          <span key={k++} className="font-medium">{m[3]}</span>
        ) : internal ? (
          <button key={k++} type="button" onClick={() => onLink(href)} className="font-medium text-violet-700 underline decoration-violet-300 underline-offset-2 hover:decoration-violet-600 dark:text-violet-300">
            {m[3]}
          </button>
        ) : (
          <a key={k++} href={href} target="_blank" rel="noreferrer noopener" className="font-medium text-violet-700 underline underline-offset-2 dark:text-violet-300">
            {m[3]}
          </a>
        ),
      );
    } else if (m[5]) out.push(<code key={k++} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{m[5]}</code>);
    else if (m[6] || m[7]) out.push(<em key={k++}>{m[6] ?? m[7]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) pushText(text.slice(last));
  return out;
}

export function Markdown({ text, onLink, caret = false }: { text: string; onLink: (href: string) => void; caret?: boolean }) {
  const blocks: ReactNode[] = [];
  const lines = (caret ? `${text.replace(/\s+$/, "")}${CARET}` : text).replace(/\r/g, "").split("\n");
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push(<p key={k++} className="mt-1 font-semibold">{inline(heading[1], onLink)}</p>);
      i++;
      continue;
    }
    if (/^\s*([-*•])\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*•])\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*•])\s+/, ""));
      blocks.push(
        <ul key={k++} className="ml-4 list-disc space-y-1 marker:text-violet-500">
          {items.map((t, j) => <li key={j}>{inline(t, onLink)}</li>)}
        </ul>,
      );
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ""));
      blocks.push(
        <ol key={k++} className="ml-4 list-decimal space-y-1 marker:font-semibold marker:text-violet-600">
          {items.map((t, j) => <li key={j} className="pl-0.5">{inline(t, onLink)}</li>)}
        </ol>,
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^\s*([-*•]|\d+[.)]|#{1,4})\s+/.test(lines[i])) para.push(lines[i++]);
    blocks.push(
      <p key={k++}>
        {para.map((p, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {inline(p, onLink)}
          </Fragment>
        ))}
      </p>,
    );
  }
  return <div className="space-y-2 break-words">{blocks}</div>;
}

// ------------------------------------------------------------ the panel

function Avatar({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span className={cn("relative flex shrink-0 items-center justify-center rounded-full bg-white shadow-sm", size === "lg" ? "h-14 w-14" : "h-10 w-10")}>
      <BrainCircuit className={cn("text-violet-600", size === "lg" ? "h-7 w-7" : "h-5 w-5")} />
      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
    </span>
  );
}

export function AiAssistant() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const { data: status } = useQuery<AssistantStatus>({ queryKey: ["/api/assistant/status"], staleTime: 5 * 60_000 });
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"chat" | "history">("chat");
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (user) setChats(loadChats(user.id));
  }, [user?.id]);
  useEffect(() => {
    if (user) saveChats(user.id, chats);
  }, [chats, user?.id]);

  const current = useMemo(() => chats.find((c) => c.id === currentId) ?? null, [chats, currentId]);
  const messages = current?.messages ?? [];
  const suggestions = useMemo(() => suggestionsFor(location), [location]);
  const firstName = (user?.fullName ?? "").split(/\s+/)[1] ?? (user?.fullName ?? "").split(/\s+/)[0] ?? "";

  // Follow the answer as it streams.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy, open, view]);
  useEffect(() => {
    if (open && view === "chat") setTimeout(() => inputRef.current?.focus(), 60);
  }, [open, view, currentId]);
  // Escape closes; Ctrl+/ opens.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) setOpen(false);
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const patchChat = useCallback((id: string, fn: (c: Chat) => Chat) => {
    setChats((cs) => {
      const i = cs.findIndex((c) => c.id === id);
      if (i < 0) return cs;
      const next = fn(cs[i]);
      return [next, ...cs.slice(0, i), ...cs.slice(i + 1)];
    });
  }, []);

  const ask = useCallback(
    async (question: string, base?: Msg[]) => {
      const q = question.trim().slice(0, MAX_MESSAGE_CHARS);
      if (!q || busy) return;
      let id = currentId;
      const history = base ?? messages.filter((m) => !m.error);
      const userMsg: Msg = { role: "user", text: q, at: Date.now() };
      if (!id || !chats.some((c) => c.id === id)) {
        id = newId();
        const chat: Chat = { id, title: q.slice(0, 60), updatedAt: Date.now(), messages: [userMsg] };
        setChats((cs) => [chat, ...cs].slice(0, MAX_CHATS));
        setCurrentId(id);
      } else {
        patchChat(id, (c) => ({ ...c, updatedAt: Date.now(), messages: [...history, userMsg].slice(-MAX_KEPT_MESSAGES) }));
      }
      setInput("");
      setBusy(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const chatId = id;
      const send = [...history, userMsg].map((m) => ({ role: m.role, text: m.text }));
      let answer = "";
      const show = (text: string, error = false) =>
        patchChat(chatId, (c) => {
          const msgs = c.messages.filter((m, i) => !(i === c.messages.length - 1 && m.role === "model" && m.at === -1));
          return { ...c, updatedAt: Date.now(), messages: [...msgs, { role: "model", text, at: -1, error }] };
        });
      // The answer "prints" out a few characters a frame instead of landing in blocks.
      const typer = typewriter((t) => show(t));
      ctrl.signal.addEventListener("abort", () => typer.stop());
      try {
        const res = await fetch("/api/assistant/chat", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: send, page: location }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const body = (await res.json().catch(() => null)) as { message?: string } | null;
          throw new Error(body?.message ?? (res.status === 401 ? "Seans tugagan — qaytadan kiring." : "Javob olib bo'lmadi."));
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          answer += dec.decode(value, { stream: true });
          typer.push(answer);
        }
        answer += dec.decode();
        if (!answer.trim()) throw new Error("Bo'sh javob keldi — qayta so'rab ko'ring.");
        typer.push(answer);
        await typer.finish();
        if (ctrl.signal.aborted) throw new DOMException("stopped", "AbortError");
        show(answer);
      } catch (e) {
        const onScreen = typer.stop();
        if ((e as Error).name === "AbortError") show(onScreen ? `${onScreen}\n\n_(To'xtatildi)_` : "_(To'xtatildi)_");
        else show(answer ? `${answer}\n\n_(${(e as Error).message})_` : (e as Error).message, !answer);
      } finally {
        // Stamp the finished answer with its time.
        patchChat(chatId, (c) => ({ ...c, messages: c.messages.map((m) => (m.at === -1 ? { ...m, at: Date.now() } : m)) }));
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, chats, currentId, location, messages, patchChat],
  );

  const retry = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    const idx = messages.lastIndexOf(lastUser);
    ask(lastUser.text, messages.slice(0, idx));
  };
  const newChat = () => {
    abortRef.current?.abort();
    setCurrentId(null);
    setView("chat");
  };
  const deleteChat = (id: string) => {
    setChats((cs) => cs.filter((c) => c.id !== id));
    if (id === currentId) setCurrentId(null);
  };
  const onLink = (href: string) => {
    setLocation(href);
    if (window.innerWidth < 640) setOpen(false);
  };
  const copy = async (text: string, i: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  if (!user) return null;
  const enabled = status?.enabled !== false;

  return (
    <div className="no-print">
      {/* The launcher: a round "bilim" sticker, bottom-right. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group fixed bottom-5 right-5 z-40 flex items-center gap-3 sm:bottom-6 sm:right-6"
          aria-label={`${ASSISTANT_NAME} yordamchisini ochish`}
          data-testid="button-ai-open"
        >
          <span className="pointer-events-none hidden translate-x-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 sm:block">
            {ASSISTANT_NAME} · savol bering
          </span>
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-600 shadow-[0_10px_30px_-6px_rgba(109,40,217,0.6)] ring-4 ring-white transition-transform duration-200 group-hover:scale-105 group-active:scale-95 dark:ring-slate-900">
            <BrainCircuit className="h-8 w-8 text-white drop-shadow" />
            <Sparkles className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-violet-100/90" />
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4">
              {enabled && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />}
              <span className={cn("relative inline-flex h-4 w-4 rounded-full border-2 border-white dark:border-slate-900", enabled ? "bg-emerald-500" : "bg-slate-400")} />
            </span>
          </span>
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label={ASSISTANT_NAME}
          data-testid="ai-panel"
          className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background shadow-2xl sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(680px,calc(100vh-3rem))] sm:w-[400px] sm:rounded-3xl sm:border animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          {/* Header */}
          <div className="flex items-center gap-3 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 px-4 py-3.5 text-white">
            {view === "history" ? (
              <button type="button" onClick={() => setView("chat")} className="rounded-full p-1.5 hover:bg-white/15" aria-label="Ortga">
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : (
              <Avatar />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold leading-tight">{view === "history" ? "Suhbatlar tarixi" : ASSISTANT_NAME}</p>
              <p className="text-xs text-white/85">{view === "history" ? `${chats.length} ta suhbat` : busy ? "Yozmoqda…" : enabled ? "Online • AI yordamchi" : "Sozlanmagan"}</p>
            </div>
            {view === "chat" && (
              <>
                <button type="button" onClick={() => setView("history")} className="rounded-full p-2 hover:bg-white/15" aria-label="Suhbatlar tarixi" title="Tarix" data-testid="button-ai-history">
                  <Clock className="h-[18px] w-[18px]" />
                </button>
                <button type="button" onClick={newChat} className="rounded-full p-2 hover:bg-white/15" aria-label="Yangi suhbat" title="Yangi suhbat" data-testid="button-ai-new">
                  <Plus className="h-5 w-5" />
                </button>
                <button type="button" onClick={() => current && deleteChat(current.id)} disabled={!current} className="rounded-full p-2 hover:bg-white/15 disabled:opacity-40" aria-label="Suhbatni o'chirish" title="O'chirish" data-testid="button-ai-delete">
                  <Trash2 className="h-[18px] w-[18px]" />
                </button>
              </>
            )}
            <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-white/15" aria-label="Yopish" data-testid="button-ai-close">
              <X className="h-5 w-5" />
            </button>
          </div>

          {view === "history" ? (
            <div className="flex-1 overflow-y-auto p-3" data-testid="ai-history">
              {chats.length === 0 ? (
                <p className="mt-16 text-center text-sm text-muted-foreground">Hali suhbat yo'q</p>
              ) : (
                <ul className="space-y-2">
                  {chats.map((c) => (
                    <li key={c.id} className={cn("group flex items-center gap-2 rounded-2xl border bg-card p-3 transition-colors hover:border-violet-300", c.id === currentId && "border-violet-400 bg-violet-50/60 dark:bg-violet-500/10")}>
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => {
                          setCurrentId(c.id);
                          setView("chat");
                        }}
                      >
                        <p className="truncate text-sm font-medium">{c.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {dayLabel(c.updatedAt)} · {c.messages.length} xabar
                        </p>
                      </button>
                      <button type="button" onClick={() => deleteChat(c.id)} className="rounded-full p-2 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10" aria-label="O'chirish">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-gradient-to-b from-violet-50/60 to-background px-4 py-4 dark:from-violet-500/5" data-testid="ai-messages">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center pt-6 text-center">
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg">
                      <BrainCircuit className="h-8 w-8 text-white" />
                    </span>
                    <p className="mt-4 text-lg font-bold">Salom{firstName ? `, ${firstName}` : ""}!</p>
                    <p className="mt-1 max-w-[280px] text-sm text-muted-foreground">
                      Men {ASSISTANT_NAME} — tizimdan foydalanish bo'yicha yordamchingizman. Qanday qilishni so'rang: bemor qo'shish, to'lov, natija…
                    </p>
                    {!enabled && <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">Yordamchi hali sozlanmagan — administrator GEMINI_API_KEY ni o'rnatishi kerak.</p>}
                    <div className="mt-5 flex w-full flex-col gap-2">
                      {suggestions.map((s) => (
                        <button key={s} type="button" onClick={() => ask(s)} disabled={!enabled} className="rounded-2xl border border-violet-200 bg-card px-4 py-2.5 text-left text-sm transition-colors hover:border-violet-400 hover:bg-violet-50 disabled:opacity-50 dark:border-violet-500/30 dark:hover:bg-violet-500/10" data-testid="button-ai-suggestion">
                          <Sparkles className="mr-2 inline h-3.5 w-3.5 text-violet-500" />
                          {s}
                        </button>
                      ))}
                    </div>
                    <p className="mt-6 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <ShieldCheck className="h-3.5 w-3.5" /> Bemor ismi, telefoni va hujjatini yozmang.
                    </p>
                  </div>
                ) : (
                  messages.map((m, i) =>
                    m.role === "user" ? (
                      <div key={i} className="flex justify-end">
                        <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-gradient-to-br from-violet-500 to-indigo-600 px-4 py-2.5 text-sm text-white shadow-md">
                          <p className="whitespace-pre-wrap break-words">{m.text}</p>
                          <p className="mt-1 text-right text-[10px] text-white/75">{hhmm(m.at)}</p>
                        </div>
                      </div>
                    ) : (
                      <div key={i} className="flex justify-start" data-testid="ai-answer">
                        <div className={cn("group max-w-[90%] rounded-3xl rounded-bl-lg border bg-card px-4 py-3 text-sm leading-relaxed shadow-sm", m.error && "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200")}>
                          <Markdown text={m.text} onLink={onLink} caret={busy && m.at === -1 && i === messages.length - 1} />
                          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span>{m.at === -1 ? "…" : hhmm(m.at)}</span>
                            {m.at !== -1 && !m.error && (
                              <button type="button" onClick={() => copy(m.text, i)} className="ml-auto inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 opacity-60 hover:bg-muted hover:opacity-100" aria-label="Nusxa olish">
                                {copied === i ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                              </button>
                            )}
                            {m.error && i === messages.length - 1 && (
                              <button type="button" onClick={retry} className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-rose-700 hover:bg-rose-100 dark:text-rose-200" data-testid="button-ai-retry">
                                <RotateCcw className="h-3 w-3" /> Qayta
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ),
                  )
                )}
                {busy && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex justify-start" data-testid="ai-typing">
                    <div className="flex items-center gap-1 rounded-3xl rounded-bl-lg border bg-card px-4 py-3.5 shadow-sm">
                      {[0, 1, 2].map((d) => (
                        <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-violet-400" style={{ animationDelay: `${d * 150}ms` }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Composer */}
              <form
                className="flex items-end gap-2 border-t bg-background px-3 py-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  ask(input);
                }}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      ask(input);
                    }
                  }}
                  rows={1}
                  maxLength={MAX_MESSAGE_CHARS}
                  placeholder={enabled ? "Xabar yozing…" : "Yordamchi sozlanmagan"}
                  disabled={!enabled}
                  className="max-h-32 min-h-[46px] flex-1 resize-none rounded-3xl border-2 border-violet-200 bg-background px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-violet-500 disabled:opacity-60 dark:border-violet-500/30"
                  style={{ height: `${Math.min(128, 46 + Math.max(0, input.split("\n").length - 1) * 20)}px` }}
                  data-testid="input-ai"
                />
                {busy ? (
                  <button type="button" onClick={() => abortRef.current?.abort()} className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-slate-700 text-white shadow-md hover:bg-slate-800" aria-label="To'xtatish" data-testid="button-ai-stop">
                    <Square className="h-4 w-4 fill-current" />
                  </button>
                ) : (
                  <button type="submit" disabled={!input.trim() || !enabled} className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md transition-opacity hover:opacity-90 disabled:opacity-40" aria-label="Yuborish" data-testid="button-ai-send">
                    <SendHorizontal className="h-5 w-5" />
                  </button>
                )}
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
