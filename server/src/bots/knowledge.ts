/**
 * Bot deduction. Spec §73.
 *
 * THE constraint: this takes a `ClientGameState` — the same projection a human
 * receives (§53) — and nothing else. It has no access to `GameState`, so a bot
 * cannot see another player's hand even by accident. Fairness is structural
 * rather than something to police.
 *
 * Knowledge is rebuilt from scratch on each turn by replaying the public
 * history. That is slightly more work than an incremental cache, and much
 * harder to get wrong: there is no stale state to drift.
 *
 * What the public record tells us (§53):
 *   - a successful ask  -> the card is now definitely with the asker
 *   - a failed ask      -> the target did NOT hold that card at that moment
 *   - any ask           -> the asker held at least one card of that set (§48)
 *   - a declaration     -> those six cards leave play entirely
 *
 * Negative facts stay valid because every transfer is public: a card can only
 * change hands through an ask we observed, and a successful ask overwrites the
 * candidate set outright.
 */

import {
  CARD_SETS,
  getCard,
  type ClientGameState,
  type SetId,
} from "@memory-game/shared";

export interface Knowledge {
  /** cardId -> player ids who could still hold it. Size 1 means certain. */
  candidates: Map<string, Set<string>>;
  /** playerId -> sets they are known to hold at least one card of (§48). */
  holdsInSet: Map<string, Set<SetId>>;
  /** Cards still in play, i.e. belonging to unresolved active sets. */
  liveCardIds: string[];
}

/** Definite holder of a card, when only one candidate remains. */
export const knownHolder = (k: Knowledge, cardId: string): string | undefined => {
  const c = k.candidates.get(cardId);
  return c && c.size === 1 ? [...c][0] : undefined;
};

export interface KnowledgeOptions {
  /**
   * Constraint propagation. HARD only — it is the difference between "I saw
   * that" and "therefore this must be true" (§73.2).
   */
  propagate?: boolean;
}

export function buildKnowledge(
  view: ClientGameState,
  options: KnowledgeOptions = {},
): Knowledge {
  const resolved = new Set(view.resolvedSets.map((r) => r.setId));
  const liveSets = view.activeSetIds.filter((id) => !resolved.has(id));
  const liveCardIds = CARD_SETS.filter((s) => liveSets.includes(s.setId)).flatMap((s) => [
    ...s.cardIds,
  ]);

  const everyone = view.players.map((p) => p.id);
  const candidates = new Map<string, Set<string>>();
  for (const id of liveCardIds) candidates.set(id, new Set(everyone));

  const holdsInSet = new Map<string, Set<SetId>>();
  const noteSet = (playerId: string, setId: SetId) => {
    const s = holdsInSet.get(playerId) ?? new Set<SetId>();
    s.add(setId);
    holdsInSet.set(playerId, s);
  };

  // Replay the public record in order.
  for (const event of view.history) {
    if (event.type === "ASK_RESOLVED") {
      const { card, askerId, targetId, result } = event.lastAsk;
      if (!candidates.has(card.id)) continue;

      // §48: asking proves the asker held something in that set.
      noteSet(askerId, card.setId);

      if (result === "SUCCESS") {
        // Definite, and it overrides every earlier inference about this card.
        candidates.set(card.id, new Set([askerId]));
      } else {
        // §13 means we cannot conclude the asker lacks it — only the target.
        candidates.get(card.id)!.delete(targetId);
      }
    }
  }

  // Our own hand is exact: those cards are ours, and no other card is.
  const mine = new Set(view.myHand.map((c) => c.id));
  for (const id of liveCardIds) {
    if (mine.has(id)) candidates.set(id, new Set([view.myPlayerId]));
    else candidates.get(id)?.delete(view.myPlayerId);
  }
  for (const c of view.myHand) noteSet(view.myPlayerId, c.setId);

  // A player holding nothing can hold nothing.
  for (const p of view.players) {
    if (p.cardCount === 0) {
      for (const id of liveCardIds) candidates.get(id)?.delete(p.id);
      holdsInSet.delete(p.id);
    }
  }

  if (options.propagate) propagate(view, candidates, liveCardIds);

  return { candidates, holdsInSet, liveCardIds };
}

/**
 * Constraint propagation — where a strong bot gets its edge.
 *
 * Two rules, applied until nothing changes:
 *   1. A player whose known cards already equal their card count cannot hold
 *      anything else, so drop them from every other card's candidates.
 *   2. If a card has exactly one candidate it is certain, which may in turn
 *      satisfy rule 1 for that player.
 */
function propagate(
  view: ClientGameState,
  candidates: Map<string, Set<string>>,
  liveCardIds: string[],
): void {
  const counts = new Map(view.players.map((p) => [p.id, p.cardCount]));

  for (let pass = 0; pass < 6; pass++) {
    let changed = false;

    const certain = new Map<string, number>();
    for (const id of liveCardIds) {
      const c = candidates.get(id);
      if (c && c.size === 1) {
        const owner = [...c][0]!;
        certain.set(owner, (certain.get(owner) ?? 0) + 1);
      }
    }

    for (const [playerId, known] of certain) {
      if (known < (counts.get(playerId) ?? 0)) continue;
      // This player's hand is fully accounted for.
      for (const id of liveCardIds) {
        const c = candidates.get(id);
        if (!c || c.size === 1) continue;
        if (c.delete(playerId)) changed = true;
      }
    }

    if (!changed) break;
  }
}

/** How likely `playerId` is to hold `cardId`, ignoring hand sizes. */
export function likelihood(k: Knowledge, cardId: string, playerId: string): number {
  const c = k.candidates.get(cardId);
  if (!c || !c.has(playerId)) return 0;
  return 1 / c.size;
}

/**
 * Hand-size weighted probability — a much better estimate than 1/candidates.
 *
 * A player holding 14 cards is far likelier to hold any given card than one
 * holding 3, and treating every candidate as equally likely throws that away.
 */
export function probability(
  k: Knowledge,
  view: ClientGameState,
  cardId: string,
  playerId: string,
): number {
  const c = k.candidates.get(cardId);
  if (!c || !c.has(playerId)) return 0;

  let total = 0;
  for (const id of c) total += view.players.find((p) => p.id === id)?.cardCount ?? 0;
  if (total === 0) return 0;

  const own = view.players.find((p) => p.id === playerId)?.cardCount ?? 0;
  return own / total;
}

/** Cards of a set whose holder is still unknown. */
export function unknownInSet(k: Knowledge, setId: SetId): number {
  const def = CARD_SETS.find((s) => s.setId === setId);
  if (!def) return 0;
  return def.cardIds.filter((id) => knownHolder(k, id) === undefined).length;
}

/** True when every card of a set has exactly one candidate. */
export function setFullyKnown(k: Knowledge, setId: SetId): boolean {
  const def = CARD_SETS.find((s) => s.setId === setId);
  if (!def) return false;
  return def.cardIds.every((id) => knownHolder(k, id) !== undefined);
}

/** The deduced assignment for a set, or undefined if any card is uncertain. */
export function deducedAssignment(
  k: Knowledge,
  setId: SetId,
): Array<{ cardId: string; playerId: string }> | undefined {
  const def = CARD_SETS.find((s) => s.setId === setId);
  if (!def) return undefined;

  const out: Array<{ cardId: string; playerId: string }> = [];
  for (const cardId of def.cardIds) {
    const holder = knownHolder(k, cardId);
    if (!holder) return undefined;
    out.push({ cardId, playerId: holder });
  }
  return out;
}

/** Best-guess assignment: the most likely candidate for each card. */
export function guessAssignment(
  k: Knowledge,
  setId: SetId,
  fallbackPlayerId: string,
): Array<{ cardId: string; playerId: string }> {
  const def = CARD_SETS.find((s) => s.setId === setId);
  if (!def) return [];

  return def.cardIds.map((cardId) => {
    const c = k.candidates.get(cardId);
    const playerId = c && c.size > 0 ? [...c][0]! : fallbackPlayerId;
    return { cardId, playerId };
  });
}

export const cardSetOf = (cardId: string): SetId | undefined => getCard(cardId)?.setId;
