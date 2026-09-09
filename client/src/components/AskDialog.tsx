/**
 * Ask flow. Spec §48, §49, §13, §64.4.
 *
 * Three steps, each revealed as the previous one is answered, so the dialog is
 * never a wall of choices. Only legal options are offered: you may only ask in
 * a half-suit you already hold a card of (§48), so illegal sets are simply
 * absent rather than shown and rejected.
 *
 * Cards you already hold stay SELECTABLE. §13 makes asking for a card you own
 * a legal, deliberately tactical move; an earlier version disabled them, which
 * silently removed a real play from the game.
 */

import { useMemo, useState } from "react";
import {
  CARD_SETS,
  cardAccessibleName,
  getCard,
  type ClientGameState,
  type SetId,
  type TeamId,
} from "@memory-game/shared";
import { Check, X } from "lucide-react";
import { Avatar } from "./Avatar.js";
import { PlayingCard } from "./PlayingCard.js";

export interface AskDialogProps {
  game: ClientGameState;
  myTeam: TeamId | null;
  onClose: () => void;
  onAsk: (targetId: string, cardId: string) => Promise<void>;
}

export function AskDialog({ game, myTeam, onClose, onAsk }: AskDialogProps) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const [setId, setSetId] = useState<SetId | null>(null);
  const [cardId, setCardId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rule = myTeam ? game.askingRule[myTeam] : "OPPONENT_ONLY";

  // §49: only legal targets — never yourself, never an empty hand, and the
  // right team for the active rule.
  const targets = game.players.filter(
    (p) =>
      p.id !== game.myPlayerId &&
      p.cardCount > 0 &&
      (rule === "TEAMMATE_ALLOWED" || p.teamId !== myTeam),
  );

  // §48: only half-suits we hold a card of, and not already resolved.
  const mySets = useMemo(() => {
    const held = new Map<SetId, number>();
    for (const c of game.myHand) held.set(c.setId, (held.get(c.setId) ?? 0) + 1);
    const resolved = new Set(game.resolvedSets.map((r) => r.setId));
    return CARD_SETS.filter((s) => held.has(s.setId) && !resolved.has(s.setId)).map((s) => ({
      ...s,
      held: held.get(s.setId)!,
    }));
  }, [game.myHand, game.resolvedSets]);

  const myCardIds = new Set(game.myHand.map((c) => c.id));
  const chosenSet = setId ? CARD_SETS.find((s) => s.setId === setId) : null;
  const target = targets.find((p) => p.id === targetId);
  const card = cardId ? getCard(cardId) : null;

  const blocker = !targetId
    ? "Choose who to ask"
    : !setId
      ? "Choose a half-suit"
      : !cardId
        ? "Choose a card"
        : null;

  return (
    <Modal title="Ask for a card" onClose={onClose}>
      <Step n={1} label="Who are you asking?" done={Boolean(targetId)} />
      <div className="mb-5 flex flex-wrap gap-2">
        {targets.map((p) => {
          const active = targetId === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setTargetId(p.id)}
              aria-pressed={active}
              className="flex min-w-[84px] flex-col items-center gap-1 rounded-xl border-2 p-2.5"
              style={{
                borderColor: active ? "var(--accent)" : "var(--border)",
                background: active ? "rgba(251,191,36,.08)" : "var(--surface)",
              }}
            >
              <Avatar
                seatPosition={p.seatPosition}
                teamId={p.teamId}
                isAlly={p.teamId === myTeam}
                size={40}
              />
              <span className="max-w-[76px] truncate text-xs font-medium">{p.name}</span>
              <span className="text-[10px] text-[var(--text-muted)]">{p.cardCount} cards</span>
            </button>
          );
        })}
      </div>

      {targetId && (
        <>
          <Step
            n={2}
            label="Which half-suit?"
            hint="Only sets you already hold a card of can be asked for"
            done={Boolean(setId)}
          />
          <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {mySets.map((s) => {
              const active = setId === s.setId;
              return (
                <button
                  key={s.setId}
                  onClick={() => {
                    setSetId(s.setId);
                    setCardId(null);
                  }}
                  aria-pressed={active}
                  className="rounded-xl border-2 px-2.5 py-2 text-left"
                  style={{
                    borderColor: active ? "var(--accent)" : "var(--border)",
                    background: active ? "rgba(251,191,36,.08)" : "var(--surface)",
                  }}
                >
                  <div className="text-[11px] font-semibold">{s.name}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">you hold {s.held}</div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {chosenSet && (
        <>
          <Step
            n={3}
            label="Which card?"
            hint="You may ask for a card you already hold — it can be a useful bluff"
            done={Boolean(cardId)}
          />
          <div className="mb-5 flex flex-wrap gap-2">
            {chosenSet.cardIds.map((id) => {
              const c = getCard(id)!;
              const owned = myCardIds.has(id);
              const active = cardId === id;
              return (
                <div key={id} className="relative">
                  <PlayingCard
                    card={c}
                    size="md"
                    selected={active}
                    onClick={() => setCardId(id)}
                  />
                  {owned && (
                    <span
                      className="pointer-events-none absolute -top-1.5 -right-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                      style={{ background: "var(--accent)", color: "#2a1e02" }}
                    >
                      YOURS
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* A plain-language summary, so nobody confirms the wrong card. */}
      <div className="mb-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-center text-sm">
        {target && card ? (
          <>
            Ask <span className="font-bold">{target.name}</span> for the{" "}
            <span className="font-bold text-[var(--accent)]">{cardAccessibleName(card)}</span>
          </>
        ) : (
          <span className="text-[var(--text-muted)]">{blocker}</span>
        )}
      </div>

      <button
        disabled={Boolean(blocker) || busy}
        onClick={async () => {
          if (!targetId || !cardId) return;
          setBusy(true);
          await onAsk(targetId, cardId);
          setBusy(false);
        }}
        className="w-full rounded-xl bg-[var(--team-us)] py-3.5 font-bold text-[#07281a] disabled:opacity-35"
      >
        {busy ? "Asking…" : "Ask"}
      </button>
    </Modal>
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 hover:bg-white/5">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Step({
  n,
  label,
  hint,
  done,
}: {
  n: number;
  label: string;
  hint?: string;
  done?: boolean;
}) {
  return (
    <div className="mb-2">
      <div className="flex items-center gap-2">
        <span
          className="grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold"
          style={{
            background: done ? "var(--team-us)" : "var(--border)",
            color: done ? "#07281a" : "var(--text)",
          }}
        >
          {done ? <Check size={12} /> : n}
        </span>
        <span className="text-sm font-semibold">{label}</span>
      </div>
      {hint && <p className="mt-0.5 ml-7 text-[11px] text-[var(--text-muted)]">{hint}</p>}
    </div>
  );
}
