/**
 * Declaration reveal. Spec §61.3.
 *
 * The card-by-card comparison of what was claimed against what was true. A
 * declaration is the largest information event in the game — reporting only
 * "WRONG" teaches nobody anything, so every row shows claim, truth and verdict.
 */

import { motion } from "motion/react";
import { Check, X } from "lucide-react";
import { getCard, type DeclarationResult, type TeamId } from "@memory-game/shared";
import { PlayingCard } from "./PlayingCard.js";

export interface DeclarationRevealProps {
  result: DeclarationResult;
  myTeamId: TeamId | null;
  onDismiss: () => void;
}

export function DeclarationReveal({ result, myTeamId, onDismiss }: DeclarationRevealProps) {
  const wonByUs = result.awardedTeamId === myTeamId;
  const declaredByUs = result.declaringTeamId === myTeamId;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Declaration result"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.26, ease: [0.05, 0.7, 0.1, 1] }}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border-2 bg-[var(--surface-raised)] p-5"
        style={{ borderColor: result.overallCorrect ? "var(--team-us)" : "var(--team-them)" }}
      >
        <header className="mb-4 text-center">
          <p className="text-xs tracking-wider text-[var(--text-muted)] uppercase">Declaration</p>
          <h2 className="text-xl font-bold">{result.setName}</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Declared by {result.declaringPlayerName}
            {declaredByUs ? " (your team)" : ""}
          </p>
        </header>

        {/* §61.3: the truth column is shown even when every card is correct. */}
        <div className="mb-4 overflow-hidden rounded-xl border border-[var(--border)]">
          <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 bg-[var(--surface)] px-3 py-2 text-[10px] tracking-wider text-[var(--text-muted)] uppercase">
            <span>Card</span>
            <span>Declared</span>
            <span>Actually held</span>
            <span />
          </div>

          {result.reveal.map((row, i) => (
            <motion.div
              key={row.cardId}
              // §66.2: 90ms stagger — dramatic, and it gives time to read each row.
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.09, duration: 0.26 }}
              className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2 border-t border-[var(--border)] px-3 py-2"
              style={{ background: row.correct ? "transparent" : "rgba(239,68,68,.08)" }}
            >
              <PlayingCard card={getCard(row.cardId)!} size="sm" />
              <span className="truncate text-sm">{row.claimedPlayerName}</span>
              <span className="truncate text-sm font-medium">{row.actualPlayerName}</span>
              {row.correct ? (
                <Check size={18} className="text-[var(--team-us)]" />
              ) : (
                <X size={18} className="text-[var(--team-them)]" />
              )}
            </motion.div>
          ))}
        </div>

        {/* §61.3: "4 of 6 correct" sits beside the verdict so all-or-nothing is
            visible in one glance and can never read as partial credit. */}
        <div
          className="mb-4 rounded-xl p-4 text-center"
          style={{
            background: result.overallCorrect ? "rgba(74,222,128,.12)" : "rgba(239,68,68,.12)",
          }}
        >
          <p
            className="text-lg font-bold"
            style={{ color: result.overallCorrect ? "var(--team-us)" : "var(--team-them)" }}
          >
            {result.overallCorrect ? "DECLARATION CORRECT" : "DECLARATION WRONG"}
          </p>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            {result.correctCount} of {result.reveal.length} correct
          </p>
          <p className="mt-2 text-sm font-semibold">
            {result.setName} goes to {wonByUs ? "your team" : "the other team"}
          </p>
        </div>

        <div className="mb-4 flex items-center justify-center gap-8">
          <Score label="Your Team" value={myTeamId ? result.teamScores[myTeamId] : 0} tone="us" />
          <Score
            label="Opponents"
            value={myTeamId ? result.teamScores[myTeamId === "A" ? "B" : "A"] : 0}
            tone="them"
          />
        </div>

        <button
          onClick={onDismiss}
          autoFocus
          className="w-full rounded-xl bg-[var(--accent)] py-3 font-bold text-[#2a1e02]"
        >
          Continue
        </button>
      </motion.div>
    </div>
  );
}

function Score({ label, value, tone }: { label: string; value: number; tone: "us" | "them" }) {
  return (
    <div className="text-center">
      <div className="text-[11px] text-[var(--text-muted)]">{label}</div>
      <div
        className="text-3xl font-bold"
        style={{ color: tone === "us" ? "var(--team-us)" : "var(--team-them)" }}
      >
        {value}
      </div>
    </div>
  );
}

/** Shown when the game ends (§62.2, §72.3 — a draw is possible at 4 and 8). */
export function GameOverBanner({
  winningTeamId,
  drawn,
  myTeamId,
  scores,
  onDismiss,
}: {
  winningTeamId?: TeamId;
  drawn: boolean;
  myTeamId: TeamId | null;
  scores: Record<TeamId, number>;
  onDismiss: () => void;
}) {
  const won = !drawn && winningTeamId === myTeamId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.42, ease: [0.34, 1.56, 0.64, 1] }}
        className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-6 text-center"
      >
        <h2
          className="mb-4 text-4xl font-bold"
          style={{
            color: drawn ? "var(--accent)" : won ? "var(--team-us)" : "var(--team-them)",
          }}
        >
          {drawn ? "Draw" : won ? "You Win!" : "You Lose"}
        </h2>

        <div className="mb-6 flex items-center justify-center gap-8">
          <Score label="Your Team" value={myTeamId ? scores[myTeamId] : 0} tone="us" />
          <Score
            label="Opponents"
            value={myTeamId ? scores[myTeamId === "A" ? "B" : "A"] : 0}
            tone="them"
          />
        </div>

        <button
          onClick={onDismiss}
          className="w-full rounded-xl bg-[var(--team-us)] py-3 font-bold text-[#07281a]"
        >
          Back to menu
        </button>
      </motion.div>
    </div>
  );
}
