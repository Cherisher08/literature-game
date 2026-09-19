import { evaluatePokerHand, HAND_RANK_ORDER, type PokerAction } from "@memory-game/shared";
import type { InternalPokerPlayer, InternalPokerState } from "./engine.js";

export function decidePokerBotAction(
  state: InternalPokerState,
  botPlayer: InternalPokerPlayer,
): PokerAction {
  const toCall = state.highestBet - botPlayer.currentBet;
  const cards = [...botPlayer.holeCards, ...state.communityCards];
  const hand = evaluatePokerHand(cards);
  const rankScore = HAND_RANK_ORDER[hand.rank];

  // If check is available (no bet to call)
  if (toCall <= 0) {
    // If we have a very strong hand (Two Pair or better), bet for value occasionally
    if (rankScore >= 3 && Math.random() < 0.6) {
      const betSize = state.highestBet + state.config.bigBlind * 2;
      return { type: "BET", amount: Math.min(botPlayer.chips + botPlayer.currentBet, betSize) };
    }
    return { type: "CHECK" };
  }

  // There is a bet to call
  const potOdds = toCall / (state.mainPot + toCall + 1);

  // Pre-flop logic
  if (state.round === "PRE_FLOP") {
    // If it's a small bet (like Big Blind)
    if (toCall <= state.config.bigBlind) {
      return { type: "CALL" };
    }

    // Has a pocket pair or Ace high
    const isPair = botPlayer.holeCards[0]?.rank === botPlayer.holeCards[1]?.rank;
    const hasHighCard = botPlayer.holeCards.some((c) => ["A", "K", "Q", "J"].includes(c.rank));

    if (isPair || hasHighCard) {
      // Call or re-raise
      if (isPair && Math.random() < 0.4) {
        return {
          type: "RAISE",
          amount: Math.min(botPlayer.chips + botPlayer.currentBet, state.highestBet * 2),
        };
      }
      return { type: "CALL" };
    }

    // Otherwise fold to large pre-flop raises
    return toCall <= state.config.bigBlind * 2 ? { type: "CALL" } : { type: "FOLD" };
  }

  // Post-flop logic
  // High hands: Trips, Straight, Flush, Full House, Quads
  if (rankScore >= 4) {
    // Raise or Call
    if (Math.random() < 0.5) {
      const raiseTo = Math.min(botPlayer.chips + botPlayer.currentBet, state.highestBet * 2);
      return { type: "RAISE", amount: raiseTo };
    }
    return { type: "CALL" };
  }

  // Moderate hands: One Pair or Two Pair
  if (rankScore >= 2) {
    if (toCall <= state.config.bigBlind * 4 || potOdds < 0.35) {
      return { type: "CALL" };
    }
    return { type: "FOLD" };
  }

  // Weak hand / High Card
  if (toCall <= state.config.bigBlind) {
    return { type: "CALL" };
  }

  return { type: "FOLD" };
}
