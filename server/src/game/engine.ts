/**
 * The game engine. Spec §57: a pure reducer.
 *
 * No Socket.IO, no timers, no I/O. It takes a state and an action and returns
 * either a new state plus events, or an error code. The socket layer translates
 * events into emissions; the engine never emits.
 *
 * State is treated as immutable: every transition builds new objects rather
 * than mutating the input.
 */

import {
  DECLARATION_WINDOW_MS,
  DEFAULT_RULES,
  setIdsFor,
  winScoreFor,
  getCard,
  getSet,
  otherTeam,
  type Action,
  type Assignment,
  type Card,
  type CardRevealRow,
  type DeclarationResult,
  type DeclarationWindow,
  type ErrorCode,
  type GameEvent,
  type GameState,
  type LastAsk,
  type PlayerCount,
  type Player,
  type ReduceResult,
  type RuleConfig,
  type SetId,
  type TeamId,
  type Turn,
  type TurnPassReason,
} from "@memory-game/shared";

import {
  canAct,
  deriveAllAskingRules,
  findPlayer,
  holdsCard,
  holdsCardInSet,
  holderOf,
  isSetActive,
  isSetResolved,
  nextTeammateWithCards,
  setName,
  teamHasCards,
} from "./selectors.js";

const fail = (error: ErrorCode): ReduceResult => ({ ok: false, error });

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export interface NewGamePlayer {
  id: string;
  name: string;
  seatPosition: number;
  hand: Card[];
}

/**
 * Builds the initial state. Seats alternate teams (§6): odd seats are team A,
 * even seats team B.
 */
export function createGameState(
  players: NewGamePlayer[],
  firstPlayerId: string,
  rules?: RuleConfig,
): GameState {
  // §72: the deck, the sets in play and the win score all follow the table size.
  const playerCount = players.length as PlayerCount;
  const resolvedRules: RuleConfig = rules ?? {
    ...DEFAULT_RULES,
    winScore: winScoreFor(playerCount),
  };
  const built: Player[] = players
    .map((p) => ({
      id: p.id,
      name: p.name,
      seatPosition: p.seatPosition,
      teamId: (p.seatPosition % 2 === 1 ? "A" : "B") as TeamId,
      connected: true,
      hand: [...p.hand],
    }))
    .sort((a, b) => a.seatPosition - b.seatPosition);

  const base: GameState = {
    status: "PLAYING",
    players: built,
    activeSetIds: setIdsFor(playerCount),
    turn: { kind: "PLAYER", playerId: firstPlayerId },
    teamScores: { A: 0, B: 0 },
    askingRule: { A: "OPPONENT_ONLY", B: "OPPONENT_ONLY" },
    resolvedSets: [],
    askCounter: 0,
    rules: resolvedRules,
    history: [],
  };

  return { ...base, askingRule: deriveAllAskingRules(base) };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Recomputes derived state after every mutation (§52, §62.3) and appends events
 * to history. Derived state cannot drift; toggled state can.
 */
function commit(state: GameState, events: GameEvent[]): ReduceResult {
  const next: GameState = {
    ...state,
    askingRule: deriveAllAskingRules(state),
    history: [...state.history, ...events],
  };
  return { ok: true, state: next, events };
}

/**
 * §50: resolves who actually gets the turn. If the intended player has no
 * cards, it moves to a teammate with cards; if the whole team is empty, to the
 * opponents. Returns the turn plus the reason it landed there.
 */
function resolveTurnForPlayer(
  state: GameState,
  playerId: string,
  reason: TurnPassReason,
): { turn: Turn; reason: TurnPassReason } {
  const player = findPlayer(state, playerId);
  if (!player) return { turn: state.turn, reason };

  if (player.hand.length > 0) {
    return { turn: { kind: "PLAYER", playerId }, reason };
  }

  const teammate = nextTeammateWithCards(state, player.teamId, player.seatPosition);
  if (teammate) {
    return { turn: { kind: "PLAYER", playerId: teammate.id }, reason: "PLAYER_EMPTY" };
  }

  // §50: the whole team is out of cards.
  const opponents = otherTeam(player.teamId);
  const opponent = nextTeammateWithCards(state, opponents, 0);
  if (opponent) {
    return { turn: { kind: "PLAYER", playerId: opponent.id }, reason: "TEAM_EMPTY" };
  }

  return { turn: state.turn, reason };
}

/** §62.2: checked after every declaration, never only when sets run out. */
function checkGameOver(state: GameState, events: GameEvent[]): GameState {
  const { A, B } = state.teamScores;
  const winner: TeamId | undefined =
    A >= state.rules.winScore ? "A" : B >= state.rules.winScore ? "B" : undefined;

  if (winner) {
    events.push({
      type: "GAME_OVER",
      winningTeamId: winner,
      drawn: false,
      teamScores: { ...state.teamScores },
    });
    return { ...state, status: "FINISHED", winningTeamId: winner };
  }

  // §72.3: with an even number of sets, every set can resolve without a
  // majority. 4-4 in an 8-set game is a legitimate draw, not a stalled game.
  const allResolved = state.resolvedSets.length >= state.activeSetIds.length;
  if (allResolved) {
    events.push({ type: "GAME_OVER", drawn: true, teamScores: { ...state.teamScores } });
    return { ...state, status: "FINISHED", drawn: true };
  }

  return state;
}

const withoutCard = (player: Player, cardId: string): Player => ({
  ...player,
  hand: player.hand.filter((c) => c.id !== cardId),
});

// ---------------------------------------------------------------------------
// ASK (§11-15, §48-50)
// ---------------------------------------------------------------------------

function reduceAsk(state: GameState, action: Extract<Action, { type: "ASK" }>): ReduceResult {
  const { playerId, targetId, cardId } = action;

  // §49, in order. Stops at the first failure so no rejection leaks a hand.
  if (state.status !== "PLAYING") return fail("GAME_OVER");

  const asker = findPlayer(state, playerId);
  if (!asker) return fail("INVALID_TARGET");

  if (state.declarationWindow) return fail("DECLARATION_IN_PROGRESS");
  if (!canAct(state, playerId)) {
    return fail(state.turn.kind === "TEAM_OPEN" ? "TURN_TAKEN" : "NOT_YOUR_TURN");
  }
  if (asker.hand.length === 0) return fail("EMPTY_HAND");

  const target = findPlayer(state, targetId);
  if (!target || target.id === asker.id) return fail("INVALID_TARGET");
  if (target.hand.length === 0) return fail("TARGET_EMPTY");

  const rule = state.askingRule[asker.teamId];
  if (rule === "DECLARE_ONLY") return fail("NO_TARGETS_AVAILABLE");
  if (rule === "OPPONENT_ONLY" && target.teamId === asker.teamId) return fail("WRONG_TEAM");

  const card = getCard(cardId);
  if (!card) return fail("UNKNOWN_CARD");
  // §72: a card from a set outside this table size is not in the game at all.
  if (!isSetActive(state, card.setId)) return fail("UNKNOWN_CARD");
  if (isSetResolved(state, card.setId)) return fail("SET_RESOLVED");

  if (state.rules.mustHoldCardInSet && !holdsCardInSet(asker, card.setId)) {
    return fail("ILLEGAL_ASK_SET");
  }
  if (!state.rules.mayAskForOwnedCard && holdsCard(asker, cardId)) {
    return fail("ALREADY_OWNED");
  }

  // Legality passed. Only now do we look inside the target's hand: the lookup
  // is the outcome, never a validation error.
  const success = holdsCard(target, cardId);
  const events: GameEvent[] = [];
  const askIndex = state.askCounter + 1;

  let players = state.players;
  let turn: Turn = state.turn;
  let turnPassedToId: string | undefined;

  if (success) {
    players = players.map((p) => {
      if (p.id === target.id) return withoutCard(p, cardId);
      if (p.id === asker.id) return { ...p, hand: [...p.hand, card] };
      return p;
    });
    // §14: the asker keeps the turn.
    turn = { kind: "PLAYER", playerId: asker.id };
  } else {
    // §15: the turn passes to the target.
    turnPassedToId = target.id;
  }

  const lastAsk: LastAsk = {
    askerId: asker.id,
    askerName: asker.name,
    askerTeamId: asker.teamId,
    targetId: target.id,
    targetName: target.name,
    card,
    result: success ? "SUCCESS" : "FAIL",
    ...(turnPassedToId ? { turnPassedToId } : {}),
    askIndex,
    timestamp: Date.now(),
  };

  let next: GameState = { ...state, players, turn, askCounter: askIndex, lastAsk };

  events.push({ type: "ASK_RESOLVED", lastAsk });
  if (success) {
    events.push({
      type: "CARD_TRANSFERRED",
      cardId,
      fromPlayerId: target.id,
      toPlayerId: asker.id,
    });
  }

  // Resolve the turn against §50 after the transfer, since a transfer can empty
  // the target's hand and a failed ask can hand the turn to an empty player.
  const intended = success ? asker.id : target.id;
  const resolved = resolveTurnForPlayer(next, intended, success ? "PLAYER_EMPTY" : "ASK_FAILED");
  next = { ...next, turn: resolved.turn };

  const turnChanged =
    state.turn.kind !== resolved.turn.kind ||
    (resolved.turn.kind === "PLAYER" &&
      state.turn.kind === "PLAYER" &&
      state.turn.playerId !== resolved.turn.playerId);

  if (turnChanged) {
    events.push({
      type: "TURN_CHANGED",
      turn: resolved.turn,
      reason: resolved.reason,
    });
  }

  return commit(next, events);
}

// ---------------------------------------------------------------------------
// Declaration window (§62.4)
// ---------------------------------------------------------------------------

function reduceOpenDeclaration(
  state: GameState,
  action: Extract<Action, { type: "OPEN_DECLARATION" }>,
): ReduceResult {
  if (state.status !== "PLAYING") return fail("GAME_OVER");

  const player = findPlayer(state, action.playerId);
  if (!player) return fail("INVALID_TARGET");
  // §62.1: a player with no cards cannot declare.
  if (player.hand.length === 0) return fail("EMPTY_HAND");
  if (state.declarationWindow) return fail("DECLARATION_IN_PROGRESS");
  if (!canAct(state, action.playerId)) {
    return fail(state.turn.kind === "TEAM_OPEN" ? "TURN_TAKEN" : "NOT_YOUR_TURN");
  }

  const window: DeclarationWindow = {
    teamId: player.teamId,
    openedBy: player.id,
    openedAt: action.now,
    expiresAt: action.now + DECLARATION_WINDOW_MS,
  };

  // Opening claims a TEAM_OPEN turn for the opener (§62.5).
  const next: GameState = {
    ...state,
    turn: { kind: "PLAYER", playerId: player.id },
    declarationWindow: window,
  };

  return commit(next, [{ type: "DECLARATION_WINDOW_OPENED", window }]);
}

function reduceClaimDeclaration(
  state: GameState,
  action: Extract<Action, { type: "CLAIM_DECLARATION" }>,
): ReduceResult {
  const window = state.declarationWindow;
  if (!window) return fail("NO_DECLARATION_WINDOW");

  const player = findPlayer(state, action.playerId);
  if (!player) return fail("INVALID_TARGET");
  if (player.teamId !== window.teamId) return fail("WRONG_TEAM");
  // §62.1: card-less players cannot declare, so they cannot claim either.
  if (player.hand.length === 0) return fail("EMPTY_HAND");
  if (window.claimedBy) return fail("DECLARATION_TAKEN");

  const claimed: DeclarationWindow = { ...window, claimedBy: player.id };
  return commit(
    { ...state, declarationWindow: claimed },
    [{ type: "DECLARATION_WINDOW_CLAIMED", window: claimed }],
  );
}

function reduceReleaseDeclaration(
  state: GameState,
  action: Extract<Action, { type: "RELEASE_DECLARATION" }>,
): ReduceResult {
  const window = state.declarationWindow;
  if (!window) return fail("NO_DECLARATION_WINDOW");
  if (window.claimedBy !== action.playerId) return fail("NOT_CLAIMANT");

  // §62.4: returns to unclaimed, not to the opener.
  const released: DeclarationWindow = { ...window };
  delete released.claimedBy;

  return commit(
    { ...state, declarationWindow: released },
    [{ type: "DECLARATION_WINDOW_RELEASED", window: released }],
  );
}

/**
 * §62.4: "Opening a window is not a commitment to declare." Without this the
 * opener is trapped — release only unclaims, so the window stayed open and
 * blocked every ask until the 90s timeout.
 */
function reduceCancelDeclaration(
  state: GameState,
  action: Extract<Action, { type: "CANCEL_DECLARATION" }>,
): ReduceResult {
  const window = state.declarationWindow;
  if (!window) return fail("NO_DECLARATION_WINDOW");

  const player = findPlayer(state, action.playerId);
  if (!player) return fail("INVALID_TARGET");
  if (player.teamId !== window.teamId) return fail("WRONG_TEAM");

  // A teammate who has taken control is mid-declaration; only they may back out.
  if (window.claimedBy && window.claimedBy !== player.id) return fail("NOT_CLAIMANT");

  const next: GameState = { ...state };
  delete next.declarationWindow;

  // The turn returns to whoever opened it, exactly as on expiry.
  const resolved = resolveTurnForPlayer(next, window.openedBy, "PLAYER_EMPTY");

  return commit({ ...next, turn: resolved.turn }, [
    { type: "DECLARATION_WINDOW_CLOSED", teamId: window.teamId, reason: "EXPIRED" },
  ]);
}

function reduceExpireDeclaration(
  state: GameState,
  action: Extract<Action, { type: "EXPIRE_DECLARATION" }>,
): ReduceResult {
  const window = state.declarationWindow;
  if (!window) return fail("NO_DECLARATION_WINDOW");
  if (action.now < window.expiresAt) return fail("NO_DECLARATION_WINDOW");

  // §62.4: closes with no penalty; the turn returns to the opener.
  const next: GameState = { ...state };
  delete next.declarationWindow;

  const resolved = resolveTurnForPlayer(next, window.openedBy, "PLAYER_EMPTY");

  return commit({ ...next, turn: resolved.turn }, [
    { type: "DECLARATION_WINDOW_CLOSED", teamId: window.teamId, reason: "EXPIRED" },
  ]);
}

// ---------------------------------------------------------------------------
// DECLARE (§61, §62.5)
// ---------------------------------------------------------------------------

function reduceDeclare(
  state: GameState,
  action: Extract<Action, { type: "DECLARE" }>,
): ReduceResult {
  if (state.status !== "PLAYING") return fail("GAME_OVER");

  const window = state.declarationWindow;
  if (!window) return fail("NO_DECLARATION_WINDOW");

  const player = findPlayer(state, action.playerId);
  if (!player) return fail("INVALID_TARGET");
  if (player.teamId !== window.teamId) return fail("WRONG_TEAM");
  if (player.hand.length === 0) return fail("EMPTY_HAND");
  if (window.claimedBy && window.claimedBy !== player.id) return fail("DECLARATION_TAKEN");

  const definition = getSet(action.setId);
  if (!definition) return fail("MALFORMED_DECLARATION");
  if (!isSetActive(state, action.setId)) return fail("MALFORMED_DECLARATION");
  if (isSetResolved(state, action.setId)) return fail("SET_RESOLVED");

  // §51.1: exactly 6 assignments, matching exactly the set's card ids, no
  // duplicates, every target a seated player. A malformed declaration is an
  // input error and does NOT cost the team the set.
  if (!validAssignments(state, definition.cardIds, action.assignments)) {
    return fail("MALFORMED_DECLARATION");
  }

  const claimBy = new Map(action.assignments.map((a) => [a.cardId, a.playerId]));

  // §61.2: read actual holders BEFORE removing the cards from hands.
  const reveal: CardRevealRow[] = definition.cardIds.map((cardId) => {
    const card = getCard(cardId)!;
    const actual = holderOf(state, cardId)!;
    const claimedId = claimBy.get(cardId)!;
    const claimed = findPlayer(state, claimedId)!;

    return {
      cardId,
      cardLabel: card.label,
      claimedPlayerId: claimed.id,
      claimedPlayerName: claimed.name,
      actualPlayerId: actual.id,
      actualPlayerName: actual.name,
      actualTeamId: actual.teamId,
      correct: claimed.id === actual.id,
    };
  });

  const correctCount = reveal.filter((r) => r.correct).length;
  // §61.2: all-or-nothing. correctCount is for display only.
  const overallCorrect = correctCount === definition.cardIds.length;
  const awardedTeamId: TeamId = overallCorrect ? player.teamId : otherTeam(player.teamId);

  // §51: remove all six cards from every hand, correct or wrong.
  const setCardIds = new Set(definition.cardIds);
  const players = state.players.map((p) => ({
    ...p,
    hand: p.hand.filter((c) => !setCardIds.has(c.id)),
  }));

  const teamScores = { ...state.teamScores, [awardedTeamId]: state.teamScores[awardedTeamId] + 1 };

  const result: DeclarationResult = {
    setId: action.setId,
    setName: setName(action.setId),
    declaringPlayerId: player.id,
    declaringPlayerName: player.name,
    declaringTeamId: player.teamId,
    reveal,
    correctCount,
    overallCorrect,
    awardedTeamId,
    teamScores,
    timestamp: Date.now(),
  };

  let next: GameState = {
    ...state,
    players,
    teamScores,
    resolvedSets: [
      ...state.resolvedSets,
      { setId: action.setId, wonByTeamId: awardedTeamId, stolen: !overallCorrect },
    ],
  };
  delete next.declarationWindow;

  const events: GameEvent[] = [
    { type: "DECLARATION_RESOLVED", result },
    { type: "DECLARATION_WINDOW_CLOSED", teamId: window.teamId, reason: "RESOLVED" },
  ];

  // §62.2: check after every declaration.
  next = checkGameOver(next, events);
  if (next.status === "FINISHED") return commit(next, events);

  // §62.5: the turn passes to the declaring team as a whole.
  if (teamHasCards(next, player.teamId)) {
    next = { ...next, turn: { kind: "TEAM_OPEN", teamId: player.teamId } };
    events.push({ type: "TURN_CHANGED", turn: next.turn, reason: "DECLARATION" });
  } else {
    const opponent = nextTeammateWithCards(next, otherTeam(player.teamId), 0);
    if (opponent) {
      next = { ...next, turn: { kind: "PLAYER", playerId: opponent.id } };
      events.push({ type: "TURN_CHANGED", turn: next.turn, reason: "TEAM_EMPTY" });
    }
  }

  return commit(next, events);
}

function validAssignments(
  state: GameState,
  cardIds: readonly string[],
  assignments: Assignment[],
): boolean {
  if (assignments.length !== cardIds.length) return false;

  const seen = new Set<string>();
  for (const a of assignments) {
    if (seen.has(a.cardId)) return false;
    seen.add(a.cardId);
    if (!cardIds.includes(a.cardId)) return false;
    if (!findPlayer(state, a.playerId)) return false;
  }
  return seen.size === cardIds.length;
}

// ---------------------------------------------------------------------------
// TEAM_OPEN expiry (§62.5)
// ---------------------------------------------------------------------------

function reduceExpireTeamTurn(state: GameState): ReduceResult {
  if (state.turn.kind !== "TEAM_OPEN") return fail("NOT_YOUR_TURN");

  const fallback = nextTeammateWithCards(state, state.turn.teamId, 0);
  if (!fallback) {
    const opponent = nextTeammateWithCards(state, otherTeam(state.turn.teamId), 0);
    if (!opponent) return fail("NOT_YOUR_TURN");
    const turn: Turn = { kind: "PLAYER", playerId: opponent.id };
    return commit({ ...state, turn }, [
      { type: "TURN_CHANGED", turn, reason: "TEAM_EMPTY" },
    ]);
  }

  const turn: Turn = { kind: "PLAYER", playerId: fallback.id };
  return commit({ ...state, turn }, [
    { type: "TURN_CHANGED", turn, reason: "PLAYER_EMPTY" },
  ]);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function reduce(state: GameState, action: Action): ReduceResult {
  switch (action.type) {
    case "ASK":
      return reduceAsk(state, action);
    case "OPEN_DECLARATION":
      return reduceOpenDeclaration(state, action);
    case "CLAIM_DECLARATION":
      return reduceClaimDeclaration(state, action);
    case "RELEASE_DECLARATION":
      return reduceReleaseDeclaration(state, action);
    case "CANCEL_DECLARATION":
      return reduceCancelDeclaration(state, action);
    case "DECLARE":
      return reduceDeclare(state, action);
    case "EXPIRE_DECLARATION":
      return reduceExpireDeclaration(state, action);
    case "EXPIRE_TEAM_TURN":
      return reduceExpireTeamTurn(state);
  }
}
