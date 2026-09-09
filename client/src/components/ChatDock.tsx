/**
 * Floating chat. Spec §28, §17.
 *
 * Chat must never compete with the game for space or attention:
 *   - a single floating button, with an unread count
 *   - incoming messages appear as toasts that fade on their own
 *   - toasts are `pointer-events: none`, so they can never swallow a tap on a
 *     card or an action button
 *   - the full history and the composer live in a modal, opened deliberately
 *
 * Room-wide only. §17 exists to stop the app providing a hidden channel for
 * card information, so there is deliberately no teammate chat.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MessageSquare, Send, X } from "lucide-react";
import { MAX_CHAT_LENGTH, type ChatMessage } from "@memory-game/shared";
import { api } from "../socket/client.js";

/** How long a toast stays before fading out. */
const TOAST_MS = 5000;
const MAX_TOASTS = 3;

export function ChatDock({ chat, myPlayerId }: { chat: ChatMessage[]; myPlayerId: string }) {
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);

  // Track what we have already reacted to, so re-renders never replay toasts.
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  useEffect(() => {
    // On first mount, treat existing history as already seen — a player who
    // opens mid-game should not be hit by a backlog of toasts.
    if (!primed.current) {
      for (const m of chat) seen.current.add(m.id);
      primed.current = true;
      return;
    }

    const fresh = chat.filter((m) => !seen.current.has(m.id));
    if (fresh.length === 0) return;
    for (const m of fresh) seen.current.add(m.id);

    // Your own messages need no toast — you just sent them.
    const fromOthers = fresh.filter((m) => m.playerId !== myPlayerId);
    if (fromOthers.length === 0) return;

    if (!open) {
      setUnread((n) => n + fromOthers.length);
      setToasts((t) => [...t, ...fromOthers].slice(-MAX_TOASTS));

      for (const m of fromOthers) {
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== m.id)), TOAST_MS);
      }
    }
  }, [chat, myPlayerId, open]);

  function openChat() {
    setOpen(true);
    setUnread(0);
    setToasts([]);
  }

  return (
    <>
      {/* Toasts — above the button, never interactive */}
      <div className="pointer-events-none fixed right-3 bottom-[7.5rem] z-30 flex flex-col items-end gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, x: 24, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, transition: { duration: 0.32 } }}
              transition={{ duration: 0.26, ease: [0.05, 0.7, 0.1, 1] }}
              className="max-w-[min(78vw,300px)] rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]/95 px-3 py-2 shadow-lg backdrop-blur-sm"
            >
              <div className="text-[11px] font-bold text-[var(--accent)]">{m.playerName}</div>
              <div className="text-xs break-words text-[var(--text)]">{m.message}</div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Floating button */}
      <button
        onClick={openChat}
        aria-label={unread > 0 ? `Chat, ${unread} unread` : "Chat"}
        className="fixed right-3 bottom-[4.75rem] z-30 grid h-11 w-11 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface-raised)]/95 shadow-lg backdrop-blur transition-transform active:scale-95"
      >
        <MessageSquare size={20} />
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold"
            style={{ background: "var(--accent)", color: "#2a1e02" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && <ChatModal chat={chat} myPlayerId={myPlayerId} onClose={() => setOpen(false)} />}
    </>
  );
}

function ChatModal({
  chat,
  myPlayerId,
  onClose,
}: {
  chat: ChatMessage[];
  myPlayerId: string;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [chat.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function send() {
    const msg = text.trim();
    if (!msg || busy) return;
    setBusy(true);
    const res = await api.sendChat(msg);
    setBusy(false);
    if ("ok" in res && res.ok) setText("");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Room chat"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, ease: [0.05, 0.7, 0.1, 1] }}
        className="flex h-[70vh] w-full max-w-lg flex-col rounded-t-2xl border border-[var(--border)] bg-[var(--surface-raised)] sm:h-[60vh] sm:rounded-2xl"
      >
        <header className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div>
            <h2 className="font-bold">Room chat</h2>
            <p className="text-[11px] text-[var(--text-muted)]">Everyone in the room can read this</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 hover:bg-white/5">
            <X size={20} />
          </button>
        </header>

        <div ref={listRef} className="no-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {chat.length === 0 && (
            <p className="pt-8 text-center text-sm text-[var(--text-muted)]">
              No messages yet. Say hello.
            </p>
          )}
          {chat.map((m) => {
            const mine = m.playerId === myPlayerId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[80%] rounded-2xl px-3 py-2"
                  style={{
                    background: mine ? "rgba(251,191,36,.14)" : "var(--surface)",
                    borderTopRightRadius: mine ? 4 : undefined,
                    borderTopLeftRadius: mine ? undefined : 4,
                  }}
                >
                  {!mine && (
                    <div className="text-[11px] font-bold text-[var(--accent)]">{m.playerName}</div>
                  )}
                  <div className="text-sm break-words">{m.message}</div>
                  <div className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                    {new Date(m.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <form
          className="flex gap-2 border-t border-[var(--border)] p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_CHAT_LENGTH}
            placeholder="Type a message…"
            aria-label="Message"
            className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            disabled={!text.trim() || busy}
            aria-label="Send"
            className="grid w-12 place-items-center rounded-xl bg-[var(--accent)] text-[#2a1e02] disabled:opacity-35"
          >
            <Send size={16} />
          </button>
        </form>
      </motion.div>
    </div>
  );
}
