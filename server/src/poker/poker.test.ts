import { describe, expect, it } from "vitest";
import {
  calculateSidePots,
  createPokerDeck,
  evaluatePokerHand,
  getCard,
  POKER_DECK,
  type Card,
} from "@memory-game/shared";

// Helper to look up cards by id
const c = (id: string): Card => {
  const card = getCard(id);
  if (!card) throw new Error(`Missing card: ${id}`);
  return card;
};

describe("Poker Deck & Evaluation", () => {
  it("has exactly 52 cards without jokers", () => {
    expect(POKER_DECK).toHaveLength(52);
    expect(POKER_DECK.every((card) => card.rank !== "JOKER")).toBe(true);
    expect(createPokerDeck()).toHaveLength(52);
  });

  describe("Hand Evaluator", () => {
    it("identifies a Royal Flush", () => {
      const hand = [c("S-A"), c("S-K"), c("S-Q"), c("S-J"), c("S-10"), c("H-2"), c("D-3")];
      const res = evaluatePokerHand(hand);
      expect(res.rank).toBe("ROYAL_FLUSH");
      expect(res.name).toBe("Royal Flush");
    });

    it("identifies a Straight Flush", () => {
      const hand = [c("H-9"), c("H-8"), c("H-7"), c("H-6"), c("H-5"), c("S-K"), c("C-2")];
      const res = evaluatePokerHand(hand);
      expect(res.rank).toBe("STRAIGHT_FLUSH");
      expect(res.name).toContain("Nine high");
    });

    it("identifies Four of a Kind", () => {
      const hand = [c("S-K"), c("H-K"), c("D-K"), c("C-K"), c("S-A"), c("H-2"), c("D-3")];
      const res = evaluatePokerHand(hand);
      expect(res.rank).toBe("FOUR_OF_A_KIND");
      expect(res.name).toContain("Kings");
    });

    it("identifies a Full House", () => {
      const hand = [c("S-A"), c("H-A"), c("D-A"), c("C-K"), c("S-K"), c("H-2"), c("D-3")];
      const res = evaluatePokerHand(hand);
      expect(res.rank).toBe("FULL_HOUSE");
      expect(res.name).toBe("Full House, Aces full of Kings");
    });

    it("identifies a Flush", () => {
      const hand = [c("D-A"), c("D-J"), c("D-8"), c("D-6"), c("D-2"), c("S-K"), c("C-4")];
      const res = evaluatePokerHand(hand);
      expect(res.rank).toBe("FLUSH");
      expect(res.name).toContain("Ace high");
    });

    it("identifies a Wheel Straight (A-2-3-4-5)", () => {
      const hand = [c("S-A"), c("H-2"), c("D-3"), c("C-4"), c("S-5"), c("H-9"), c("D-K")];
      const res = evaluatePokerHand(hand);
      expect(res.rank).toBe("STRAIGHT");
      expect(res.name).toContain("Five high");
    });

    it("identifies Three of a Kind", () => {
      const hand = [c("S-Q"), c("H-Q"), c("D-Q"), c("C-A"), c("S-9"), c("H-2"), c("D-3")];
      const res = evaluatePokerHand(hand);
      expect(res.rank).toBe("THREE_OF_A_KIND");
      expect(res.name).toContain("Queens");
    });

    it("identifies Two Pair", () => {
      const hand = [c("S-J"), c("H-J"), c("D-10"), c("C-10"), c("S-A"), c("H-4"), c("D-2")];
      const res = evaluatePokerHand(hand);
      expect(res.rank).toBe("TWO_PAIR");
      expect(res.name).toBe("Two Pair, Jacks and Tens");
    });

    it("identifies One Pair and respects kicker", () => {
      const hand1 = [c("S-A"), c("H-A"), c("D-K"), c("C-J"), c("S-9"), c("H-2"), c("D-3")];
      const hand2 = [c("D-A"), c("C-A"), c("S-Q"), c("H-J"), c("D-9"), c("H-4"), c("S-5")];
      const res1 = evaluatePokerHand(hand1);
      const res2 = evaluatePokerHand(hand2);

      expect(res1.rank).toBe("ONE_PAIR");
      expect(res2.rank).toBe("ONE_PAIR");
      // King kicker beats Queen kicker
      expect(res1.score).toBeGreaterThan(res2.score);
    });

    it("correctly ranks Flush above Straight", () => {
      const flush = evaluatePokerHand([c("D-2"), c("D-5"), c("D-7"), c("D-9"), c("D-J")]);
      const straight = evaluatePokerHand([c("S-10"), c("H-J"), c("D-Q"), c("C-K"), c("S-A")]);
      expect(flush.score).toBeGreaterThan(straight.score);
    });
  });

  describe("Side Pot Calculations", () => {
    it("calculates single main pot when bets are equal", () => {
      const pots = calculateSidePots([
        { playerId: "p1", totalBet: 100, folded: false },
        { playerId: "p2", totalBet: 100, folded: false },
        { playerId: "p3", totalBet: 100, folded: false },
      ]);
      expect(pots).toHaveLength(1);
      expect(pots[0]!.amount).toBe(300);
      expect(pots[0]!.eligiblePlayerIds).toEqual(["p1", "p2", "p3"]);
    });

    it("creates main pot and side pot for short-stack all-in", () => {
      // p1 is all-in for 50, p2 and p3 bet 200 each
      const pots = calculateSidePots([
        { playerId: "p1", totalBet: 50, folded: false },
        { playerId: "p2", totalBet: 200, folded: false },
        { playerId: "p3", totalBet: 200, folded: false },
      ]);

      expect(pots).toHaveLength(2);
      // Main pot: 50 * 3 = 150
      expect(pots[0]!.amount).toBe(150);
      expect(pots[0]!.eligiblePlayerIds).toEqual(["p1", "p2", "p3"]);

      // Side pot: 150 from p2 + 150 from p3 = 300
      expect(pots[1]!.amount).toBe(300);
      expect(pots[1]!.eligiblePlayerIds).toEqual(["p2", "p3"]);
    });

    it("excludes folded players from winning eligibility", () => {
      // p1 put in 50 and folded, p2 put in 100, p3 put in 100
      const pots = calculateSidePots([
        { playerId: "p1", totalBet: 50, folded: true },
        { playerId: "p2", totalBet: 100, folded: false },
        { playerId: "p3", totalBet: 100, folded: false },
      ]);

      expect(pots).toHaveLength(1);
      expect(pots[0]!.amount).toBe(250);
      expect(pots[0]!.eligiblePlayerIds).toEqual(["p2", "p3"]);
    });
  });
});
