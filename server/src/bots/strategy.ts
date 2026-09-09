/**
 * Bot decision-making. Spec §73.
 *
 * Difficulty is memory and inference depth, never privileged information:
 *
 *   EASY   — plays only from its own hand. Random legal ask; declares only a
 *            set it holds entirely itself.
 *   MEDIUM — uses the public record: who asked for what, who denied what.
 *            Targets players it has reason to suspect; declares when the whole
 *            set has been deduced with reasonable confidence.
 *   HARD   — full constraint propagation, negative inference and card counting.
 *            Declares as soon as the set collapses to one arrangement, and
 *            occasionally asks for a card it already holds as a bluff (§13).
 *
 * Every path returns an intent that still goes through the reducer, so a bot
 * cannot produce an illegal move even with a bug here.
 */

import {
  CARD_SETS,
  type BotDifficulty,
  type ClientGameState,
  type SetId,
  type TeamId,
} from "@memory-game/shared";
import {
  buildKnowledge,
  deducedAssignment,
  guessAssignment,
  knownHolder,
  probability,
  unknownInSet,
  type Knowledge,
} from "./knowledge.js";

export type BotMove =
  | { kind: "ASK"; targetId: string; cardId: string }
  | { kind: "DECLARE"; setId: SetId; assignments: Array<{ cardId: string; playerId: string }> }
  | { kind: "NONE" };

export interface BotContext {
  view: ClientGameState;
  difficulty: BotDifficulty;
  /** Injectable for deterministic tests. */
  random?: () => number;
}

export function chooseMove({ view, difficulty, random = Math.random }: BotContext): BotMove {
  const me = view.players.find((p) => p.id === view.myPlayerId);
  if (!me || view.status !== "PLAYING") return { kind: "NONE" };

  // §62.1: a bot with no cards can neither ask nor declare.
  if (view.myHand.length === 0) return { kind: "NONE" };

  // §73.2: only HARD reasons beyond what it directly observed.
  const knowledge = buildKnowledge(view, { propagate: difficulty === "HARD" });
  const myTeam = me.teamId;

  const declare = considerDeclaration(view, knowledge, difficulty, myTeam);
  if (declare) return declare;

  // §62.3: with no opponents holding cards there is nobody to ask.
  if (myTeam && view.askingRule[myTeam] === "DECLARE_ONLY") {
    const forced = forcedDeclaration(view, knowledge, myTeam);
    return forced ?? { kind: "NONE" };
  }

  return chooseAsk(view, knowledge, difficulty, myTeam, random);
}

// ---------------------------------------------------------------------------
// Asking
// ---------------------------------------------------------------------------

function chooseAsk(
  view: ClientGameState,
  k: Knowledge,
  difficulty: BotDifficulty,
  myTeam: TeamId | null,
  random: () => number,
): BotMove {
  const rule = myTeam ? view.askingRule[myTeam] : "OPPONENT_ONLY";

  // §49: legal targets only.
  const targets = view.players.filter(
    (p) =>
      p.id !== view.myPlayerId &&
      p.cardCount > 0 &&
      (rule === "TEAMMATE_ALLOWED" || p.teamId !== myTeam),
  );
  if (targets.length === 0) return { kind: "NONE" };

  // §48: only sets we already hold a card of, and that are unresolved.
  const resolved = new Set(view.resolvedSets.map((r) => r.setId));
  const heldSets = [...new Set(view.myHand.map((c) => c.setId))].filter(
    (id) => !resolved.has(id),
  );
  if (heldSets.length === 0) return { kind: "NONE" };

  const myCards = new Set(view.myHand.map((c) => c.id));

  // How invested we are in each set — more cards means more to gain.
  const myCountBySet = new Map<SetId, number>();
  for (const c of view.myHand) myCountBySet.set(c.setId, (myCountBySet.get(c.setId) ?? 0) + 1);

  const options: Array<{ targetId: string; cardId: string; score: number; certain: boolean }> = [];

  for (const setId of heldSets) {
    const def = CARD_SETS.find((s) => s.setId === setId);
    if (!def) continue;

    // Fewer unknowns in a set makes "they hold something here" much sharper:
    // with two cards unaccounted for it is a coin flip, with five it is noise.
    const unknowns = Math.max(1, unknownInSet(k, setId));

    for (const cardId of def.cardIds) {
      // Asking for a card we hold is a guaranteed failure: nobody else has it,
      // so it always costs the turn. Only ever considered as a rare bluff.
      if (myCards.has(cardId)) continue;

      const holder = knownHolder(k, cardId);

      for (const t of targets) {
        if (difficulty === "EASY") {
          options.push({ targetId: t.id, cardId, score: random(), certain: false });
          continue;
        }

        // Provably wasted asks. Both of these lose the turn for nothing, and
        // the old scoring let them win whenever every option looked equal.
        if (holder && holder !== t.id) continue;
        if (!k.candidates.get(cardId)?.has(t.id)) continue;

        const certain = holder === t.id;

        // A successful ask keeps the turn (§14), so certainty dominates
        // everything else — it is a free card and another go.
        const score = certain
          ? 1000 + random()
          : // Weighted by hand size: a big hand is likelier to hold any card.
            probability(k, view, cardId, t.id) * 20 +
            // §48: they asked in this set, so they hold at least one of the
            // cards still unaccounted for in it.
            (k.holdsInSet.get(t.id)?.has(setId) ? 8 / unknowns : 0) +
            (myCountBySet.get(setId) ?? 0) * 0.3 +
            random() * 0.3;

        options.push({ targetId: t.id, cardId, score, certain });
      }
    }
  }

  if (options.length === 0) return { kind: "NONE" };

  options.sort((a, b) => b.score - a.score);
  const best = options[0]!;

  // §13: a hard bot occasionally asks for a card it already holds, to mislead.
  // Never when a certain card is available — that would trade a free card and a
  // continued turn for a bluff, which is a bad deal at any odds.
  if (difficulty === "HARD" && !best.certain && random() < 0.05) {
    const bluffs: Array<{ targetId: string; cardId: string }> = [];
    for (const c of view.myHand) {
      if (resolved.has(c.setId)) continue;
      for (const t of targets) bluffs.push({ targetId: t.id, cardId: c.id });
    }
    if (bluffs.length > 0) {
      const pick = bluffs[Math.floor(random() * bluffs.length)]!;
      return { kind: "ASK", targetId: pick.targetId, cardId: pick.cardId };
    }
  }

  return { kind: "ASK", targetId: best.targetId, cardId: best.cardId };
}

// ---------------------------------------------------------------------------
// Declaring
// ---------------------------------------------------------------------------

function considerDeclaration(
  view: ClientGameState,
  k: Knowledge,
  difficulty: BotDifficulty,
  myTeam: TeamId | null,
): BotMove | null {
  const resolved = new Set(view.resolvedSets.map((r) => r.setId));
  const openSets = view.activeSetIds.filter((id) => !resolved.has(id));
  const mySetCounts = new Map<SetId, number>();
  for (const c of view.myHand) mySetCounts.set(c.setId, (mySetCounts.get(c.setId) ?? 0) + 1);

  for (const setId of openSets) {
    // §62.1: declaring requires holding at least one card of the set.
    if (!mySetCounts.has(setId)) continue;

    const def = CARD_SETS.find((s) => s.setId === setId);
    if (!def) continue;

    if (difficulty === "EASY") {
      // Only declares a set it holds outright — no deduction, no risk.
      if (mySetCounts.get(setId) === def.cardIds.length) {
        return {
          kind: "DECLARE",
          setId,
          assignments: def.cardIds.map((cardId) => ({ cardId, playerId: view.myPlayerId })),
        };
      }
      continue;
    }

    const deduced = deducedAssignment(k, setId);
    if (!deduced) continue;

    if (difficulty === "HARD") {
      // Certainty is certainty — declare regardless of who holds the cards.
      return { kind: "DECLARE", setId, assignments: deduced };
    }

    // MEDIUM only declares when the set sits entirely with its own team, which
    // is the safer half of what it can deduce.
    const teamIds = new Set(
      view.players.filter((p) => p.teamId === myTeam).map((p) => p.id),
    );
    if (deduced.every((a) => teamIds.has(a.playerId))) {
      return { kind: "DECLARE", setId, assignments: deduced };
    }
  }

  return null;
}

/**
 * §62.3: when opponents hold nothing, declaring is the only legal move, so the
 * bot must guess rather than stall the game.
 */
function forcedDeclaration(
  view: ClientGameState,
  k: Knowledge,
  _myTeam: TeamId | null,
): BotMove | null {
  const resolved = new Set(view.resolvedSets.map((r) => r.setId));
  const mySets = new Set(view.myHand.map((c) => c.setId));

  for (const setId of view.activeSetIds) {
    if (resolved.has(setId) || !mySets.has(setId)) continue;
    const assignments =
      deducedAssignment(k, setId) ?? guessAssignment(k, setId, view.myPlayerId);
    if (assignments.length === 6) return { kind: "DECLARE", setId, assignments };
  }
  return null;
}
