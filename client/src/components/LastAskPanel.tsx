/**
 * The Last Exchange panel. Spec §65.
 *
 * A fixed region, not a toast: it holds the most recent ask until the next one
 * replaces it, so a player who looks away or reconnects still sees the current
 * state of play. `lastAsk` comes from the server projection (§65.1), never from
 * a local event listener.
 *
 * It reads as a sentence — "X asked Y for the 5 of Hearts" — with the outcome
 * as a headline and the consequence spelled out underneath. An earlier version
 * scattered avatars, an arrow and a card across a row, which had to be decoded
 * rather than read.
 */

import { AnimatePresence, motion } from "motion/react";
import { Check, X } from "lucide-react";
import { cardAccessibleName, SUIT_COLOR, type LastAsk, type PublicPlayer } from "@memory-game/shared";
import { Avatar } from "./Avatar.js";
import { PlayingCard } from "./PlayingCard.js";

export interface LastAskPanelProps {
  lastAsk: LastAsk | undefined;
  players: PublicPlayer[];
  /** The viewer's team, to colour the frame by who asked (§65.2). */
  myTeamId: "A" | "B" | null;
  /** Suppresses entrance animation right after hydration (§65.4). */
  hydrating?: boolean;
}

const LABEL = "Last exchange";

export function LastAskPanel({ lastAsk, players, myTeamId, hydrating }: LastAskPanelProps) {
  // §65.3: the region keeps its space before the first ask; layout that shifts
  // on first use is worse than a reserved band.
  if (!lastAsk) {
    return (
      <section className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2">
        <Label />
        <p className="text-xs text-[var(--text-muted)]">No asks yet.</p>
      </section>
    );
  }

  const asker = players.find((p) => p.id === lastAsk.askerId);
  const target = players.find((p) => p.id === lastAsk.targetId);
  const nextUp = players.find((p) => p.id === lastAsk.turnPassedToId);
  const success = lastAsk.result === "SUCCESS";

  // §65.2: frame by the asker's team relative to the viewer, not by outcome —
  // doubling the outcome would make an opponent's failure look like your win.
  const allyAsked = myTeamId !== null && lastAsk.askerTeamId === myTeamId;
  const frame = allyAsked ? "var(--team-us)" : "var(--team-them)";
  const tone = success ? "var(--team-us)" : "var(--team-them)";

  return (
    <section
      aria-live="polite"
      aria-atomic="true"
      className="relative overflow-hidden border-b border-[var(--border)] bg-[var(--surface)]"
      style={{ borderLeft: `4px solid ${frame}` }}
    >
      {/* Screen readers get the settled sentence, not the visual arrangement (§65.5). */}
      <span className="sr-only">
        {lastAsk.askerName} asked {lastAsk.targetName} for the{" "}
        {cardAccessibleName(lastAsk.card)}.{" "}
        {success
          ? `${lastAsk.targetName} handed it over.`
          : `${lastAsk.targetName} did not have it.`}
        {nextUp ? ` ${nextUp.name} plays next.` : ""}
      </span>

      <AnimatePresence mode="wait" initial={!hydrating}>
        <motion.div
          // §65.4: askIndex is the key, so a repeat ask of the same card re-animates.
          key={lastAsk.askIndex}
          initial={hydrating ? false : { opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.26, ease: [0.2, 0, 0, 1] }}
          className="flex items-center gap-3 px-3 py-2"
          aria-hidden="true"
        >
          <motion.div
            initial={{ rotateY: 180 }}
            animate={{ rotateY: 0 }}
            transition={{ duration: 0.26, delay: 0.05, ease: [0.2, 0, 0, 1] }}
            className="shrink-0"
          >
            <PlayingCard card={lastAsk.card} size="sm" highlighted />
          </motion.div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Label />
              <motion.span
                initial={{ scale: success ? 0.85 : 1.12, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  duration: 0.18,
                  delay: 0.2,
                  ease: success ? [0.34, 1.56, 0.64, 1] : [0.2, 0, 0, 1],
                }}
                className="ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                style={{
                  background: success ? "rgba(74,222,128,.14)" : "rgba(239,68,68,.14)",
                  color: tone,
                }}
              >
                {success ? <Check size={12} /> : <X size={12} />}
                {success ? "GOT IT" : "NO"}
              </motion.span>
            </div>

            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm">
              <Who player={asker} myTeamId={myTeamId} />
              <span className="shrink-0 text-[11px] text-[var(--text-muted)]">asked</span>
              <Who player={target} myTeamId={myTeamId} />
              <span className="shrink-0 text-[11px] text-[var(--text-muted)]">for</span>
              <span
                className="shrink-0 text-lg font-bold"
                style={{ color: SUIT_COLOR[lastAsk.card.suit] === "red" ? "#ef4444" : "var(--text)" }}
              >
                {lastAsk.card.label}
              </span>
            </div>

            {/* §65.2: naming where the turn went removes the commonest confusion. */}
            <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
              {success ? (
                <>handed it over — {lastAsk.askerName} goes again</>
              ) : (
                <>
                  didn&apos;t have it
                  {nextUp && (
                    <>
                      {" "}
                      — <span style={{ color: "var(--accent)" }}>{nextUp.name}</span> plays next
                    </>
                  )}
                </>
              )}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function Label() {
  return (
    <span className="text-[10px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
      {LABEL}
    </span>
  );
}

/** Avatar and name on one line, so the row reads left to right as words. */
function Who({
  player,
  myTeamId,
}: {
  player: PublicPlayer | undefined;
  myTeamId: "A" | "B" | null;
}) {
  if (!player) return <span className="text-sm font-semibold">?</span>;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Avatar
        seatPosition={player.seatPosition}
        teamId={player.teamId}
        isAlly={player.teamId !== null && player.teamId === myTeamId}
        size={22}
      />
      <span className="max-w-[88px] truncate text-sm font-semibold">{player.name}</span>
    </span>
  );
}
