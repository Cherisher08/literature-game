import {
  calculateSidePots,
  createPokerDeck,
  evaluatePokerHand,
  shufflePokerDeck,
  type Card,
  type ClientPokerState,
  type EvaluatedHand,
  type PokerAction,
  type PokerActionType,
  type PokerConfig,
  type PokerHandWinner,
  type PokerRound,
  type PotInfo,
  type PublicPokerPlayer,
} from "@memory-game/shared";

export interface InternalPokerPlayer {
  id: string;
  name: string;
  seatPosition: number;
  chips: number;
  currentBet: number;
  totalBetInHand: number;
  folded: boolean;
  isAllIn: boolean;
  isBot: boolean;
  connected: boolean;
  hasActedThisStreet: boolean;
  holeCards: Card[];
  lastAction?: {
    type: PokerActionType;
    amount?: number;
    description: string;
  };
}

export interface InternalPokerState {
  status: "LOBBY" | "PLAYING" | "FINISHED";
  round: PokerRound;
  config: PokerConfig;
  handNumber: number;
  deck: Card[];
  communityCards: Card[];
  players: InternalPokerPlayer[];
  dealerSeat: number;
  sbSeat: number;
  bbSeat: number;
  activeSeat: number | null;
  highestBet: number;
  minRaise: number;
  mainPot: number;
  sidePots: PotInfo[];
  winners?: PokerHandWinner[];
  turnExpiresAt?: number;
}

export function createInitialPokerState(
  players: { id: string; name: string; isBot: boolean }[],
  config: PokerConfig,
): InternalPokerState {
  const internalPlayers: InternalPokerPlayer[] = players.map((p, idx) => ({
    id: p.id,
    name: p.name,
    seatPosition: idx,
    chips: config.startingChips,
    currentBet: 0,
    totalBetInHand: 0,
    folded: false,
    isAllIn: false,
    isBot: p.isBot,
    connected: true,
    hasActedThisStreet: false,
    holeCards: [],
  }));

  return {
    status: "LOBBY",
    round: "WAITING",
    config,
    handNumber: 0,
    deck: [],
    communityCards: [],
    players: internalPlayers,
    dealerSeat: 0,
    sbSeat: 0,
    bbSeat: 0,
    activeSeat: null,
    highestBet: 0,
    minRaise: config.bigBlind,
    mainPot: 0,
    sidePots: [],
  };
}

function getActivePlayersWithChips(state: InternalPokerState): InternalPokerPlayer[] {
  return state.players.filter((p) => p.chips > 0 || !p.folded);
}

function findNextSeat(
  state: InternalPokerState,
  fromSeat: number,
  condition: (p: InternalPokerPlayer) => boolean,
): number | null {
  const total = state.players.length;
  for (let i = 1; i <= total; i++) {
    const seat = (fromSeat + i) % total;
    const player = state.players[seat];
    if (player && condition(player)) {
      return seat;
    }
  }
  return null;
}

export function startNewPokerHand(state: InternalPokerState): void {
  state.handNumber += 1;
  state.round = "PRE_FLOP";
  state.status = "PLAYING";
  state.communityCards = [];
  state.winners = undefined;
  state.deck = shufflePokerDeck(createPokerDeck());

  // Reset all players for new hand
  for (const p of state.players) {
    p.currentBet = 0;
    p.totalBetInHand = 0;
    p.hasActedThisStreet = false;
    p.lastAction = undefined;
    p.holeCards = [];
    if (p.chips <= 0) {
      p.folded = true;
      p.isAllIn = false;
    } else {
      p.folded = false;
      p.isAllIn = false;
    }
  }

  const eligible = state.players.filter((p) => p.chips > 0);
  if (eligible.length < 2) {
    state.status = "FINISHED";
    state.round = "HAND_OVER";
    return;
  }

  // Advance dealer button to next eligible player
  const nextDealer = findNextSeat(state, state.dealerSeat, (p) => p.chips > 0);
  state.dealerSeat = nextDealer ?? 0;

  // Assign Small Blind and Big Blind seats
  if (eligible.length === 2) {
    // Heads up: Dealer is SB, other player is BB
    state.sbSeat = state.dealerSeat;
    state.bbSeat = findNextSeat(state, state.sbSeat, (p) => p.chips > 0)!;
  } else {
    state.sbSeat = findNextSeat(state, state.dealerSeat, (p) => p.chips > 0)!;
    state.bbSeat = findNextSeat(state, state.sbSeat, (p) => p.chips > 0)!;
  }

  // Post Blinds
  const sbPlayer = state.players[state.sbSeat]!;
  const sbAmount = Math.min(sbPlayer.chips, state.config.smallBlind);
  sbPlayer.chips -= sbAmount;
  sbPlayer.currentBet = sbAmount;
  sbPlayer.totalBetInHand = sbAmount;
  if (sbPlayer.chips === 0) sbPlayer.isAllIn = true;
  sbPlayer.lastAction = { type: "BET", amount: sbAmount, description: `Small Blind $${sbAmount}` };

  const bbPlayer = state.players[state.bbSeat]!;
  const bbAmount = Math.min(bbPlayer.chips, state.config.bigBlind);
  bbPlayer.chips -= bbAmount;
  bbPlayer.currentBet = bbAmount;
  bbPlayer.totalBetInHand = bbAmount;
  if (bbPlayer.chips === 0) bbPlayer.isAllIn = true;
  bbPlayer.lastAction = { type: "BET", amount: bbAmount, description: `Big Blind $${bbAmount}` };

  state.highestBet = Math.max(sbAmount, bbAmount);
  state.minRaise = state.config.bigBlind * 2;

  // Deal 2 hole cards to each un-folded player
  for (const p of state.players) {
    if (!p.folded) {
      p.holeCards = [state.deck.pop()!, state.deck.pop()!];
    }
  }

  // Action starts after BB in pre-flop
  state.activeSeat = findNextSeat(state, state.bbSeat, (p) => !p.folded && !p.isAllIn);
  if (state.activeSeat === null) {
    // Everyone is all-in from blinds
    runOutBoardAndShowdown(state);
  } else {
    state.turnExpiresAt = Date.now() + state.config.turnTimeoutSec * 1000;
  }

  updatePots(state);
}

function updatePots(state: InternalPokerState): void {
  const pots = calculateSidePots(
    state.players.map((p) => ({
      playerId: p.id,
      totalBet: p.totalBetInHand,
      folded: p.folded,
    })),
  );

  state.sidePots = pots;
  state.mainPot = pots.reduce((sum, p) => sum + p.amount, 0);
}

export function handlePokerAction(
  state: InternalPokerState,
  playerId: string,
  action: PokerAction,
): { ok: boolean; error?: string } {
  if (state.status !== "PLAYING" || state.activeSeat === null) {
    return { ok: false, error: "Game is not waiting for an action." };
  }

  const activePlayer = state.players[state.activeSeat]!;
  if (activePlayer.id !== playerId) {
    return { ok: false, error: "It is not your turn." };
  }

  const toCall = state.highestBet - activePlayer.currentBet;

  switch (action.type) {
    case "FOLD": {
      activePlayer.folded = true;
      activePlayer.lastAction = { type: "FOLD", description: "Folded" };
      break;
    }

    case "CHECK": {
      if (toCall > 0) {
        return { ok: false, error: `Cannot check; $${toCall} to call.` };
      }
      activePlayer.hasActedThisStreet = true;
      activePlayer.lastAction = { type: "CHECK", description: "Checked" };
      break;
    }

    case "CALL": {
      if (toCall <= 0) {
        activePlayer.hasActedThisStreet = true;
        activePlayer.lastAction = { type: "CHECK", description: "Checked" };
        break;
      }
      const callAmount = Math.min(activePlayer.chips, toCall);
      activePlayer.chips -= callAmount;
      activePlayer.currentBet += callAmount;
      activePlayer.totalBetInHand += callAmount;
      if (activePlayer.chips === 0) activePlayer.isAllIn = true;
      activePlayer.hasActedThisStreet = true;
      activePlayer.lastAction = {
        type: "CALL",
        amount: callAmount,
        description: activePlayer.isAllIn ? `All-in $${callAmount}` : `Called $${callAmount}`,
      };
      break;
    }

    case "BET":
    case "RAISE": {
      const targetBet = action.amount ?? state.highestBet + state.config.bigBlind;
      const additionalChips = targetBet - activePlayer.currentBet;

      if (additionalChips <= 0) {
        return { ok: false, error: "Raise amount must be greater than current bet." };
      }

      if (additionalChips > activePlayer.chips) {
        // Player doesn't have enough; turn into all-in
        const allInBet = activePlayer.currentBet + activePlayer.chips;
        const added = activePlayer.chips;
        activePlayer.chips = 0;
        activePlayer.currentBet = allInBet;
        activePlayer.totalBetInHand += added;
        activePlayer.isAllIn = true;
        activePlayer.hasActedThisStreet = true;

        if (allInBet > state.highestBet) {
          state.highestBet = allInBet;
          // Re-open betting for other un-all-in players
          for (const p of state.players) {
            if (p.id !== activePlayer.id && !p.folded && !p.isAllIn) {
              p.hasActedThisStreet = false;
            }
          }
        }

        activePlayer.lastAction = {
          type: "ALL_IN",
          amount: allInBet,
          description: `All-in $${allInBet}`,
        };
      } else {
        // Normal valid raise or all-in
        activePlayer.chips -= additionalChips;
        activePlayer.currentBet = targetBet;
        activePlayer.totalBetInHand += additionalChips;
        if (activePlayer.chips === 0) activePlayer.isAllIn = true;
        activePlayer.hasActedThisStreet = true;

        const raiseDelta = targetBet - state.highestBet;
        state.highestBet = targetBet;
        state.minRaise = targetBet + Math.max(raiseDelta, state.config.bigBlind);

        // Re-open betting for everyone else
        for (const p of state.players) {
          if (p.id !== activePlayer.id && !p.folded && !p.isAllIn) {
            p.hasActedThisStreet = false;
          }
        }

        activePlayer.lastAction = {
          type: "RAISE",
          amount: targetBet,
          description: activePlayer.isAllIn ? `All-in $${targetBet}` : `Raised to $${targetBet}`,
        };
      }
      break;
    }

    case "ALL_IN": {
      const allInTotal = activePlayer.currentBet + activePlayer.chips;
      const added = activePlayer.chips;
      activePlayer.chips = 0;
      activePlayer.currentBet = allInTotal;
      activePlayer.totalBetInHand += added;
      activePlayer.isAllIn = true;
      activePlayer.hasActedThisStreet = true;

      if (allInTotal > state.highestBet) {
        state.highestBet = allInTotal;
        for (const p of state.players) {
          if (p.id !== activePlayer.id && !p.folded && !p.isAllIn) {
            p.hasActedThisStreet = false;
          }
        }
      }

      activePlayer.lastAction = {
        type: "ALL_IN",
        amount: allInTotal,
        description: `All-in $${allInTotal}`,
      };
      break;
    }
  }

  updatePots(state);
  advanceStreetOrTurn(state);
  return { ok: true };
}

function advanceStreetOrTurn(state: InternalPokerState): void {
  const activeUnfolded = state.players.filter((p) => !p.folded);

  // Check if only 1 player remains
  if (activeUnfolded.length <= 1) {
    const winner = activeUnfolded[0];
    if (winner) {
      const totalPot = state.sidePots.reduce((sum, p) => sum + p.amount, 0);
      winner.chips += totalPot;
      state.winners = [
        {
          playerId: winner.id,
          playerName: winner.name,
          amount: totalPot,
          potId: 1,
          handName: "Last Player Standing",
          bestCards: winner.holeCards,
        },
      ];
    }
    state.round = "HAND_OVER";
    state.activeSeat = null;
    return;
  }

  // Check if street betting is complete:
  // All active un-folded non-all-in players have matched highestBet and acted
  const playersAbleToAct = activeUnfolded.filter((p) => !p.isAllIn);
  const allActedAndMatched = playersAbleToAct.every(
    (p) => p.hasActedThisStreet && p.currentBet === state.highestBet,
  );

  if (playersAbleToAct.length === 0 || allActedAndMatched) {
    advanceToNextStreet(state);
  } else {
    // Move to next player able to act
    const nextSeat = findNextSeat(
      state,
      state.activeSeat!,
      (p) => !p.folded && !p.isAllIn && (!p.hasActedThisStreet || p.currentBet < state.highestBet),
    );
    state.activeSeat = nextSeat;
    state.turnExpiresAt = Date.now() + state.config.turnTimeoutSec * 1000;
  }
}

function advanceToNextStreet(state: InternalPokerState): void {
  // Reset street bets
  for (const p of state.players) {
    p.currentBet = 0;
    p.hasActedThisStreet = false;
  }
  state.highestBet = 0;
  state.minRaise = state.config.bigBlind;

  const canAnyPlayerAct = state.players.filter((p) => !p.folded && !p.isAllIn).length >= 2;

  switch (state.round) {
    case "PRE_FLOP": {
      // Deal Flop (3 cards)
      state.deck.pop(); // Burn 1 card
      state.communityCards.push(state.deck.pop()!, state.deck.pop()!, state.deck.pop()!);
      state.round = "FLOP";
      break;
    }
    case "FLOP": {
      // Deal Turn (1 card)
      state.deck.pop(); // Burn 1 card
      state.communityCards.push(state.deck.pop()!);
      state.round = "TURN";
      break;
    }
    case "TURN": {
      // Deal River (1 card)
      state.deck.pop(); // Burn 1 card
      state.communityCards.push(state.deck.pop()!);
      state.round = "RIVER";
      break;
    }
    case "RIVER": {
      // Showdown!
      resolveShowdown(state);
      return;
    }
  }

  // If players cannot act (e.g. all-in), run out to river and showdown
  if (!canAnyPlayerAct) {
    runOutBoardAndShowdown(state);
  } else {
    // Action starts from first player after dealer
    state.activeSeat = findNextSeat(state, state.dealerSeat, (p) => !p.folded && !p.isAllIn);
    state.turnExpiresAt = Date.now() + state.config.turnTimeoutSec * 1000;
  }
}

function runOutBoardAndShowdown(state: InternalPokerState): void {
  while (state.communityCards.length < 5) {
    state.deck.pop(); // Burn
    state.communityCards.push(state.deck.pop()!);
  }
  resolveShowdown(state);
}

function resolveShowdown(state: InternalPokerState): void {
  state.round = "SHOWDOWN";
  state.activeSeat = null;
  updatePots(state);

  const activePlayers = state.players.filter((p) => !p.folded);
  const evaluatedMap = new Map<string, EvaluatedHand>();

  for (const p of activePlayers) {
    const fullHand = [...p.holeCards, ...state.communityCards];
    const evalRes = evaluatePokerHand(fullHand);
    evaluatedMap.set(p.id, evalRes);
  }

  const winners: PokerHandWinner[] = [];

  // Award each pot (main pot + side pots)
  for (const pot of state.sidePots) {
    const eligibleContenders = pot.eligiblePlayerIds
      .map((id) => state.players.find((p) => p.id === id)!)
      .filter((p) => Boolean(p) && !p.folded);

    if (eligibleContenders.length === 0) continue;

    // Find highest score among eligible contenders
    let topScore = -1;
    let topPlayers: InternalPokerPlayer[] = [];

    for (const p of eligibleContenders) {
      const hand = evaluatedMap.get(p.id)!;
      if (hand.score > topScore) {
        topScore = hand.score;
        topPlayers = [p];
      } else if (hand.score === topScore) {
        topPlayers.push(p);
      }
    }

    // Split pot equally among tied players
    const splitAmount = Math.floor(pot.amount / topPlayers.length);
    for (const winner of topPlayers) {
      winner.chips += splitAmount;
      const hand = evaluatedMap.get(winner.id)!;
      winners.push({
        playerId: winner.id,
        playerName: winner.name,
        amount: splitAmount,
        potId: pot.id,
        handName: hand.name,
        bestCards: hand.best5,
      });
    }
  }

  state.winners = winners;
  state.round = "HAND_OVER";
}

/**
 * Projects the internal poker state to a secure, anti-cheat client state.
 */
export function projectPokerState(
  state: InternalPokerState,
  recipientPlayerId: string,
): ClientPokerState {
  const isShowdown = state.round === "SHOWDOWN" || state.round === "HAND_OVER";

  const publicPlayers: PublicPokerPlayer[] = state.players.map((p) => {
    const isMe = p.id === recipientPlayerId;
    const canSeeHoleCards = (isMe || (isShowdown && !p.folded)) && p.holeCards.length > 0;

    return {
      id: p.id,
      name: p.name,
      seatPosition: p.seatPosition,
      chips: p.chips,
      currentBet: p.currentBet,
      folded: p.folded,
      isAllIn: p.isAllIn,
      isBot: p.isBot,
      connected: p.connected,
      lastAction: p.lastAction,
      hasCards: p.holeCards.length > 0,
      ...(canSeeHoleCards ? { holeCards: p.holeCards } : {}),
    };
  });

  const me = state.players.find((p) => p.id === recipientPlayerId);
  const myHoleCards = me?.holeCards ?? [];
  let currentHandRank: string | undefined;

  if (myHoleCards.length > 0) {
    const cards = [...myHoleCards, ...state.communityCards];
    currentHandRank = evaluatePokerHand(cards).name;
  }

  const activePlayer =
    state.activeSeat !== null ? state.players[state.activeSeat] ?? null : null;

  return {
    status: state.status,
    round: state.round,
    smallBlind: state.config.smallBlind,
    bigBlind: state.config.bigBlind,
    dealerSeat: state.dealerSeat,
    sbSeat: state.sbSeat,
    bbSeat: state.bbSeat,
    activeSeat: state.activeSeat,
    activePlayerId: activePlayer?.id ?? null,
    turnExpiresAt: state.turnExpiresAt,
    mainPot: state.mainPot,
    sidePots: state.sidePots,
    communityCards: state.communityCards,
    highestBet: state.highestBet,
    minRaise: state.minRaise,
    players: publicPlayers,
    myPlayerId: recipientPlayerId,
    myHoleCards,
    currentHandRank,
    handNumber: state.handNumber,
    winners: state.winners,
  };
}
