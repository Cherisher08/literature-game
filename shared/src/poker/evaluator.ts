import type { Card, Rank } from "../types/cards.js";
import { HAND_RANK_ORDER, type EvaluatedHand, type HandRank } from "../types/poker.js";

const RANK_VALUE: Record<Rank, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
  JOKER: 0,
};

const VALUE_TO_NAME: Record<number, string> = {
  2: "Two",
  3: "Three",
  4: "Four",
  5: "Five",
  6: "Six",
  7: "Seven",
  8: "Eight",
  9: "Nine",
  10: "Ten",
  11: "Jack",
  12: "Queen",
  13: "King",
  14: "Ace",
};

const VALUE_TO_PLURAL: Record<number, string> = {
  2: "Twos",
  3: "Threes",
  4: "Fours",
  5: "Fives",
  6: "Sixes",
  7: "Sevens",
  8: "Eights",
  9: "Nines",
  10: "Tens",
  11: "Jacks",
  12: "Queens",
  13: "Kings",
  14: "Aces",
};

/** Get all 5-card combinations from an array of cards (up to 7 cards: 21 combinations). */
function getCombinations5(cards: Card[]): Card[][] {
  const result: Card[][] = [];
  const n = cards.length;
  if (n < 5) return [];

  function helper(start: number, current: Card[]) {
    if (current.length === 5) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < n; i++) {
      current.push(cards[i]!);
      helper(i + 1, current);
      current.pop();
    }
  }

  helper(0, []);
  return result;
}

/** Evaluate exactly 5 cards */
function evaluate5Cards(hand: Card[]): EvaluatedHand {
  // Sort descending by rank value
  const sorted = [...hand].sort((a, b) => RANK_VALUE[b.rank] - RANK_VALUE[a.rank]);
  const values = sorted.map((c) => RANK_VALUE[c.rank]);
  const suits = sorted.map((c) => c.suit);

  const isFlush = suits.every((s) => s === suits[0] && s !== "NONE");

  // Check straight
  let isStraight = false;
  let straightHigh = 0;

  // Normal straight: 5 consecutive numbers
  if (
    values[0]! - values[1]! === 1 &&
    values[1]! - values[2]! === 1 &&
    values[2]! - values[3]! === 1 &&
    values[3]! - values[4]! === 1
  ) {
    isStraight = true;
    straightHigh = values[0]!;
  }
  // Wheel straight: Ace-2-3-4-5 (A=14, 5, 4, 3, 2)
  else if (
    values[0] === 14 &&
    values[1] === 5 &&
    values[2] === 4 &&
    values[3] === 3 &&
    values[4] === 2
  ) {
    isStraight = true;
    straightHigh = 5; // 5-high straight
  }

  // Count rank frequencies
  const counts = new Map<number, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }

  // Group by count descending, then value descending
  const groups = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  const encode = (rankVal: number, tiebreakers: number[]) => {
    let score = rankVal * Math.pow(15, 5);
    for (let i = 0; i < 5; i++) {
      score += (tiebreakers[i] ?? 0) * Math.pow(15, 4 - i);
    }
    return score;
  };

  // 1. Royal Flush & Straight Flush
  if (isFlush && isStraight) {
    if (straightHigh === 14) {
      return {
        rank: "ROYAL_FLUSH",
        score: encode(HAND_RANK_ORDER.ROYAL_FLUSH, [14, 0, 0, 0, 0]),
        name: "Royal Flush",
        best5: sorted,
      };
    }
    return {
      rank: "STRAIGHT_FLUSH",
      score: encode(HAND_RANK_ORDER.STRAIGHT_FLUSH, [straightHigh, 0, 0, 0, 0]),
      name: `Straight Flush, ${VALUE_TO_NAME[straightHigh]} high`,
      best5: sorted,
    };
  }

  // 2. Four of a Kind
  if (groups[0]![1] === 4) {
    const quadVal = groups[0]![0];
    const kicker = groups[1]![0];
    return {
      rank: "FOUR_OF_A_KIND",
      score: encode(HAND_RANK_ORDER.FOUR_OF_A_KIND, [quadVal, kicker, 0, 0, 0]),
      name: `Four of a Kind, ${VALUE_TO_PLURAL[quadVal]}`,
      best5: sorted,
    };
  }

  // 3. Full House
  if (groups[0]![1] === 3 && groups[1]![1] === 2) {
    const tripVal = groups[0]![0];
    const pairVal = groups[1]![0];
    return {
      rank: "FULL_HOUSE",
      score: encode(HAND_RANK_ORDER.FULL_HOUSE, [tripVal, pairVal, 0, 0, 0]),
      name: `Full House, ${VALUE_TO_PLURAL[tripVal]} full of ${VALUE_TO_PLURAL[pairVal]}`,
      best5: sorted,
    };
  }

  // 4. Flush
  if (isFlush) {
    return {
      rank: "FLUSH",
      score: encode(HAND_RANK_ORDER.FLUSH, values),
      name: `Flush, ${VALUE_TO_NAME[values[0]!]} high`,
      best5: sorted,
    };
  }

  // 5. Straight
  if (isStraight) {
    return {
      rank: "STRAIGHT",
      score: encode(HAND_RANK_ORDER.STRAIGHT, [straightHigh, 0, 0, 0, 0]),
      name: `Straight, ${VALUE_TO_NAME[straightHigh]} high`,
      best5: sorted,
    };
  }

  // 6. Three of a Kind
  if (groups[0]![1] === 3) {
    const tripVal = groups[0]![0];
    const kickers = [groups[1]![0], groups[2]![0]];
    return {
      rank: "THREE_OF_A_KIND",
      score: encode(HAND_RANK_ORDER.THREE_OF_A_KIND, [tripVal, ...kickers, 0, 0]),
      name: `Three of a Kind, ${VALUE_TO_PLURAL[tripVal]}`,
      best5: sorted,
    };
  }

  // 7. Two Pair
  if (groups[0]![1] === 2 && groups[1]![1] === 2) {
    const highPair = Math.max(groups[0]![0], groups[1]![0]);
    const lowPair = Math.min(groups[0]![0], groups[1]![0]);
    const kicker = groups[2]![0];
    return {
      rank: "TWO_PAIR",
      score: encode(HAND_RANK_ORDER.TWO_PAIR, [highPair, lowPair, kicker, 0, 0]),
      name: `Two Pair, ${VALUE_TO_PLURAL[highPair]} and ${VALUE_TO_PLURAL[lowPair]}`,
      best5: sorted,
    };
  }

  // 8. One Pair
  if (groups[0]![1] === 2) {
    const pairVal = groups[0]![0];
    const kickers = [groups[1]![0], groups[2]![0], groups[3]![0]];
    return {
      rank: "ONE_PAIR",
      score: encode(HAND_RANK_ORDER.ONE_PAIR, [pairVal, ...kickers, 0]),
      name: `Pair of ${VALUE_TO_PLURAL[pairVal]}`,
      best5: sorted,
    };
  }

  // 9. High Card
  return {
    rank: "HIGH_CARD",
    score: encode(HAND_RANK_ORDER.HIGH_CARD, values),
    name: `High Card, ${VALUE_TO_NAME[values[0]!]}`,
    best5: sorted,
  };
}

/**
 * Evaluate any 5 to 7 cards (hole cards + community cards)
 * and return the best 5-card poker hand.
 */
export function evaluatePokerHand(cards: Card[]): EvaluatedHand {
  if (cards.length < 5) {
    // Fewer than 5 cards: evaluate partial hand as high card / pair
    const sorted = [...cards].sort((a, b) => RANK_VALUE[b.rank] - RANK_VALUE[a.rank]);
    if (cards.length === 2 && sorted[0]!.rank === sorted[1]!.rank) {
      const val = RANK_VALUE[sorted[0]!.rank];
      return {
        rank: "ONE_PAIR",
        score: val * 100,
        name: `Pocket ${VALUE_TO_PLURAL[val]}`,
        best5: sorted,
      };
    }
    const highVal = sorted.length > 0 ? RANK_VALUE[sorted[0]!.rank] : 0;
    return {
      rank: "HIGH_CARD",
      score: highVal,
      name: sorted.length > 0 ? `${VALUE_TO_NAME[highVal]} High` : "No Cards",
      best5: sorted,
    };
  }

  const combinations = getCombinations5(cards);
  let best: EvaluatedHand | null = null;

  for (const combo of combinations) {
    const evalResult = evaluate5Cards(combo);
    if (!best || evalResult.score > best.score) {
      best = evalResult;
    }
  }

  return best!;
}
