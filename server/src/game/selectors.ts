/**
 * Pure derivations over GameState. Spec §50, §52, §62.3, §62.5.
 *
 * Everything here is derived on read. Nothing is latched onto state: a stored
 * flag drifts from the truth on some path, and a stale one locks a player out
 * of a game they can still play.
 */

import {
  getSet,
  otherTeam,
  type AskingRule,
  type GameState,
  type Player,
  type SetId,
  type TeamId,
} from "@memory-game/shared";

export const findPlayer = (state: GameState, id: string): Player | undefined =>
  state.players.find((p) => p.id === id);

export const playersOfTeam = (state: GameState, teamId: TeamId): Player[] =>
  state.players.filter((p) => p.teamId === teamId);

export const teamHasCards = (state: GameState, teamId: TeamId): boolean =>
  playersOfTeam(state, teamId).some((p) => p.hand.length > 0);

/** §62.1: spectating is derived from the hand, never stored. */
export const isSpectating = (player: Player): boolean => player.hand.length === 0;

export const isSetResolved = (state: GameState, setId: SetId): boolean =>
  state.resolvedSets.some((r) => r.setId === setId);

/** §48: may only ask within a set you already hold at least one card of. */
export const holdsCardInSet = (player: Player, setId: SetId): boolean =>
  player.hand.some((c) => c.setId === setId);

export const holdsCard = (player: Player, cardId: string): boolean =>
  player.hand.some((c) => c.id === cardId);

/** Who actually holds a card right now, or undefined if it is out of play. */
export const holderOf = (state: GameState, cardId: string): Player | undefined =>
  state.players.find((p) => p.hand.some((c) => c.id === cardId));

/**
 * §62.3: DECLARE_ONLY takes precedence over everything, because it describes an
 * absence of legal targets rather than a permission.
 */
export function deriveAskingRule(state: GameState, teamId: TeamId): AskingRule {
  if (!teamHasCards(state, otherTeam(teamId))) return "DECLARE_ONLY";
  return "OPPONENT_ONLY";
}

export function deriveAllAskingRules(state: GameState): Record<TeamId, AskingRule> {
  return {
    A: deriveAskingRule(state, "A"),
    B: deriveAskingRule(state, "B"),
  };
}

/**
 * §50: the deterministic fallback — the teammate with cards at the lowest seat
 * position after `fromSeat`, wrapping around.
 */
export function nextTeammateWithCards(
  state: GameState,
  teamId: TeamId,
  fromSeat: number,
): Player | undefined {
  const candidates = playersOfTeam(state, teamId)
    .filter((p) => p.hand.length > 0)
    .sort((a, b) => a.seatPosition - b.seatPosition);

  if (candidates.length === 0) return undefined;
  return candidates.find((p) => p.seatPosition > fromSeat) ?? candidates[0];
}

/** True when a player may legally act on the current turn (§62.5). */
export function canAct(state: GameState, playerId: string): boolean {
  const player = findPlayer(state, playerId);
  if (!player) return false;
  if (state.turn.kind === "PLAYER") return state.turn.playerId === playerId;
  return state.turn.teamId === player.teamId;
}

/** Every active set not yet resolved, in canonical order (§72). */
export function openSetIds(state: GameState): SetId[] {
  const resolved = new Set(state.resolvedSets.map((r) => r.setId));
  return state.activeSetIds.filter((id) => !resolved.has(id));
}

/** §72: a set outside the active list is not in this game at all. */
export const isSetActive = (state: GameState, setId: SetId): boolean =>
  state.activeSetIds.includes(setId);

export const setName = (setId: SetId): string => getSet(setId)?.name ?? `Set ${setId}`;
