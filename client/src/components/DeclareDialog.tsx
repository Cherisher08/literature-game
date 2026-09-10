/**
 * The declaration modal. Spec §61.1, §60 Phase 3.
 *
 * The hardest screen in the app: six assignments with a review step, every one
 * reversible before confirm, because a misclick costs a set (§21).
 */

import { useState } from "react";
import { CARD_SETS, getCard, type ClientGameState, type SetId } from "@memory-game/shared";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Avatar } from "./Avatar.js";
import { Modal, Step } from "./AskDialog.js";
import { PlayingCard } from "./PlayingCard.js";

export interface DeclareDialogProps {
  game: ClientGameState;
  onClose: () => void;
  onDeclare: (setId: SetId, assignments: Array<{ cardId: string; playerId: string }>) => Promise<void>;
}

export function DeclareDialog({ game, onClose, onDeclare }: DeclareDialogProps) {
  const [setId, setSetId] = useState<SetId | null>(null);
  const [assign, setAssign] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);

  const resolved = new Set(game.resolvedSets.map((r) => r.setId));
  const openSets = CARD_SETS.filter((s) => !resolved.has(s.setId));
  const chosen = setId ? CARD_SETS.find((s) => s.setId === setId) : null;
  const complete = chosen ? chosen.cardIds.every((id) => assign[id]) : false;

  // §51.1: the set is claimed for your own team, so an opponent is never a valid
  // answer — the engine allows one, which made it a trap rather than a choice (§21).
  const myTeamId =
    game.declarationWindow?.teamId ??
    game.players.find((p) => p.id === game.myPlayerId)?.teamId ??
    null;
  const targets = myTeamId ? game.players.filter((p) => p.teamId === myTeamId) : game.players;

  // Step 1 — pick the set
  if (!chosen) {
    return (
      <Modal title="Declare a half-suit" onClose={onClose}>
        <Step n={1} label="Which half-suit?" done={false} hint="All six cards must be exactly right, or the other team takes the set" />
        <div className="grid grid-cols-2 gap-2">
          {openSets.map((s) => (
            <button
              key={s.setId}
              onClick={() => setSetId(s.setId)}
              className="rounded-xl border-2 border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm font-semibold"
            >
              {s.name}
            </button>
          ))}
        </div>
      </Modal>
    );
  }

  // Step 3 — review, everything still reversible
  if (reviewing) {
    return (
      <Modal title="Review declaration" onClose={onClose}>
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 p-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[var(--accent)]" />
          <p className="text-xs">
            One wrong card gives the whole half-suit to the other team. Check every row.
          </p>
        </div>

        <div className="mb-4 space-y-2">
          {chosen.cardIds.map((cardId) => {
            const player = game.players.find((p) => p.id === assign[cardId]);
            return (
              <div
                key={cardId}
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2"
              >
                <PlayingCard card={getCard(cardId)!} size="sm" />
                <span className="text-[var(--text-muted)]">→</span>
                {player && (
                  <>
                    <Avatar
                      seatPosition={player.seatPosition}
                      teamId={player.teamId}
                      // Every row is a teammate; `false` painted them as opponents.
                      isAlly
                      size={30}
                    />
                    <span className="text-sm font-medium">{player.name}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setReviewing(false)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] py-3 text-sm font-semibold"
          >
            <ArrowLeft size={16} /> Change
          </button>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onDeclare(
                chosen.setId,
                chosen.cardIds.map((cardId) => ({ cardId, playerId: assign[cardId]! })),
              );
              setBusy(false);
            }}
            className="flex-[2] rounded-xl bg-[var(--accent)] py-3 font-bold text-[#2a1e02] disabled:opacity-40"
          >
            Confirm declaration
          </button>
        </div>
      </Modal>
    );
  }

  // Step 2 — assign each card to a player
  return (
    <Modal title={`Declare — ${chosen.name}`} onClose={onClose}>
      <Step
        n={2}
        label="Who on your team holds each card?"
        hint="A declaration only succeeds if all six cards are with your own team"
        done={complete}
      />

      <div className="mb-4 space-y-3">
        {chosen.cardIds.map((cardId) => (
          <div key={cardId} className="flex items-center gap-3">
            <PlayingCard card={getCard(cardId)!} size="sm" />
            <div className="flex flex-1 flex-wrap gap-1.5">
              {targets.map((p) => {
                const active = assign[cardId] === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setAssign((a) => ({ ...a, [cardId]: p.id }))}
                    aria-pressed={active}
                    className="rounded-lg border px-2.5 py-1.5 text-xs"
                    style={{
                      borderColor: active ? "var(--accent)" : "var(--border)",
                      background: active ? "rgba(251,191,36,.12)" : "transparent",
                      fontWeight: active ? 700 : 400,
                    }}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setSetId(null)}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
        >
          <ArrowLeft size={16} />
        </button>
        <button
          disabled={!complete}
          onClick={() => setReviewing(true)}
          className="flex-1 rounded-xl bg-[var(--accent)] py-3 font-bold text-[#2a1e02] disabled:opacity-35"
        >
          Review {Object.keys(assign).length}/6
        </button>
      </div>
    </Modal>
  );
}
