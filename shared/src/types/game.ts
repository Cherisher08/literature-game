/**
 * Game state model. Spec §23-25, §50-52, §61-62, §65.
 *
 * Everything here is plain JSON and must stay that way (§63): no timers,
 * no socket handles, no class instances. Those live in a side table keyed
 * by room id, outside the state.
 */

import type { Card, SetId } from "./cards.js";
import type { ErrorCode } from "./errors.js";

export type TeamId = "A" | "B";

export const otherTeam = (t: TeamId): TeamId => (t === "A" ? "B" : "A");

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export interface Player {
  id: string;
  name: string;
  /** 1-6. Odd seats are team A, even seats team B (§6). */
  seatPosition: number;
  teamId: TeamId;
  connected: boolean;
  /** Server-owned. Never projected to other players (§26, §53). */
  hand: Card[];
}

// ---------------------------------------------------------------------------
// Turn model (§62.5)
// ---------------------------------------------------------------------------

export type Turn =
  | { kind: "PLAYER"; playerId: string }
  /** After a declaration: any member of the team may act; first to act takes it. */
  | { kind: "TEAM_OPEN"; teamId: TeamId };

export type TurnPassReason =
  | "ASK_FAILED"
  | "PLAYER_EMPTY"
  | "DECLARATION"
  | "TEAM_EMPTY";

// ---------------------------------------------------------------------------
// Asking rules (§52, §62.3)
// ---------------------------------------------------------------------------

export type AskingRule =
  | "OPPONENT_ONLY"
  | "TEAMMATE_ALLOWED"
  | "DECLARE_ONLY";

/** Configurable rule switches (§48.1). Both default true. */
export interface RuleConfig {
  /** §48: may only ask within a set you already hold a card of. */
  mustHoldCardInSet: boolean;
  /** §13: may ask for a card you already hold. */
  mayAskForOwnedCard: boolean;
  /** §62.2: sets needed to win. */
  winScore: number;
}

export const DEFAULT_RULES: RuleConfig = {
  mustHoldCardInSet: true,
  mayAskForOwnedCard: true,
  winScore: 5,
};

// ---------------------------------------------------------------------------
// Last ask (§65.1) — server-owned, identical for every player
// ---------------------------------------------------------------------------

export interface LastAsk {
  askerId: string;
  askerName: string;
  askerTeamId: TeamId;
  targetId: string;
  targetName: string;
  card: Card;
  result: "SUCCESS" | "FAIL";
  /** Set when result === "FAIL" (§15). */
  turnPassedToId?: string;
  /** Monotonic. The animation key (§65.4). */
  askIndex: number;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Declarations (§61, §62.4)
// ---------------------------------------------------------------------------

export interface Assignment {
  cardId: string;
  playerId: string;
}

export interface DeclarationWindow {
  teamId: TeamId;
  /** The turn holder who opened it. */
  openedBy: string;
  openedAt: number;
  /** First teammate to take control; undefined while unclaimed. */
  claimedBy?: string;
  expiresAt: number;
}

export interface CardRevealRow {
  cardId: string;
  cardLabel: string;
  claimedPlayerId: string;
  claimedPlayerName: string;
  actualPlayerId: string;
  actualPlayerName: string;
  actualTeamId: TeamId;
  correct: boolean;
}

export interface DeclarationResult {
  setId: SetId;
  setName: string;
  declaringPlayerId: string;
  declaringPlayerName: string;
  declaringTeamId: TeamId;
  /** Exactly 6 rows, in canonical set order (§61.2). */
  reveal: CardRevealRow[];
  correctCount: number;
  /** correctCount === 6. Never a majority (§61.2). */
  overallCorrect: boolean;
  awardedTeamId: TeamId;
  teamScores: Record<TeamId, number>;
  timestamp: number;
}

export interface ResolvedSet {
  setId: SetId;
  wonByTeamId: TeamId;
  /** True when won because the opponents declared wrongly (§64.6). */
  stolen: boolean;
}

// ---------------------------------------------------------------------------
// Events (§57) — emitted by the reducer, translated by the socket layer
// ---------------------------------------------------------------------------

export type GameEvent =
  | { type: "ASK_RESOLVED"; lastAsk: LastAsk }
  | { type: "CARD_TRANSFERRED"; cardId: string; fromPlayerId: string; toPlayerId: string }
  | { type: "TURN_CHANGED"; turn: Turn; reason: TurnPassReason }
  | { type: "DECLARATION_WINDOW_OPENED"; window: DeclarationWindow }
  | { type: "DECLARATION_WINDOW_CLAIMED"; window: DeclarationWindow }
  | { type: "DECLARATION_WINDOW_RELEASED"; window: DeclarationWindow }
  | { type: "DECLARATION_WINDOW_CLOSED"; teamId: TeamId; reason: "EXPIRED" | "RESOLVED" }
  | { type: "DECLARATION_RESOLVED"; result: DeclarationResult }
  | {
      type: "GAME_OVER";
      /** Undefined on a draw (§72.3). */
      winningTeamId?: TeamId;
      drawn: boolean;
      teamScores: Record<TeamId, number>;
    };

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

export type GameStatus = "PLAYING" | "FINISHED";

export interface GameState {
  status: GameStatus;
  players: Player[];
  /** §72: which sets are in play. Never assume all nine. */
  activeSetIds: SetId[];
  turn: Turn;
  teamScores: Record<TeamId, number>;
  /** Derived after every mutation, never latched (§52, §62.3). */
  askingRule: Record<TeamId, AskingRule>;
  resolvedSets: ResolvedSet[];
  declarationWindow?: DeclarationWindow;
  lastAsk?: LastAsk;
  askCounter: number;
  rules: RuleConfig;
  winningTeamId?: TeamId;
  /** §72.3: possible only in an 8-set game finishing 4-4. */
  drawn?: boolean;
  /** Appended history; the activity log reads this (§61.4). */
  history: GameEvent[];
}

// ---------------------------------------------------------------------------
// Actions (§57)
// ---------------------------------------------------------------------------

export type Action =
  | { type: "ASK"; playerId: string; targetId: string; cardId: string }
  | { type: "OPEN_DECLARATION"; playerId: string; now: number }
  | { type: "CLAIM_DECLARATION"; playerId: string }
  | { type: "RELEASE_DECLARATION"; playerId: string }
  | { type: "DECLARE"; playerId: string; setId: SetId; assignments: Assignment[] }
  | { type: "EXPIRE_DECLARATION"; now: number }
  | { type: "EXPIRE_TEAM_TURN" };

export type ReduceResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: ErrorCode };
