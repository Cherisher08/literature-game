import { describe, expect, it } from "vitest";
import {
  ALL_SET_IDS,
  CARDS_PER_PLAYER,
  CARD_SETS,
  DECK,
  TOTAL_CARDS,
  cardAccessibleName,
  cardsPerPlayerFor,
  deckFor,
  minCardsPerPlayerFor,
  getCard,
  getSet,
  setIdsFor,
  winScoreFor,
} from "@memory-game/shared";
import { deal, seededRng, shuffle } from "./shuffle.js";

describe("deck composition (§47)", () => {
  it("has exactly 54 cards", () => {
    expect(DECK).toHaveLength(TOTAL_CARDS);
  });

  it("has 9 sets of exactly 6 cards", () => {
    expect(CARD_SETS).toHaveLength(9);
    for (const set of CARD_SETS) {
      expect(set.cardIds).toHaveLength(6);
    }
  });

  it("gives every card a unique id", () => {
    expect(new Set(DECK.map((c) => c.id)).size).toBe(TOTAL_CARDS);
  });

  it("assigns every card to exactly one set", () => {
    const fromSets = CARD_SETS.flatMap((s) => s.cardIds);
    expect(fromSets).toHaveLength(TOTAL_CARDS);
    expect(new Set(fromSets).size).toBe(TOTAL_CARDS);
  });

  it("keeps 8s out of the suited half-suits and in set 9", () => {
    for (const card of DECK) {
      if (card.rank === "8") expect(card.setId).toBe(9);
    }
  });

  it("builds set 9 as the four 8s plus both jokers", () => {
    const set9 = getSet(9)!;
    expect(set9.name).toBe("Eights & Jokers");
    expect(set9.cardIds).toEqual([
      "S-8", "H-8", "D-8", "C-8", "JOKER-BLACK", "JOKER-COLOR",
    ]);
  });

  it("splits each suit into low 2-7 and high 9-A", () => {
    const lowSpades = getSet(1)!;
    const highSpades = getSet(2)!;
    expect(lowSpades.name).toBe("Low Spades");
    expect(lowSpades.cardIds).toEqual(["S-2", "S-3", "S-4", "S-5", "S-6", "S-7"]);
    expect(highSpades.name).toBe("High Spades");
    expect(highSpades.cardIds).toEqual(["S-9", "S-10", "S-J", "S-Q", "S-K", "S-A"]);
  });

  it("covers all 9 set ids", () => {
    expect(CARD_SETS.map((s) => s.setId)).toEqual([...ALL_SET_IDS]);
  });

  it("names cards for screen readers (§64.8)", () => {
    expect(cardAccessibleName(getCard("H-5")!)).toBe("Five of Hearts");
    expect(cardAccessibleName(getCard("S-A")!)).toBe("Ace of Spades");
    expect(cardAccessibleName(getCard("JOKER-BLACK")!)).toBe("Black Joker");
  });
});

describe("shuffle and deal (§56)", () => {
  it("preserves every card", () => {
    const shuffled = shuffle(DECK, seededRng(1));
    expect(shuffled).toHaveLength(TOTAL_CARDS);
    expect(new Set(shuffled.map((c) => c.id)).size).toBe(TOTAL_CARDS);
  });

  it("does not mutate the source deck", () => {
    const before = DECK.map((c) => c.id);
    shuffle(DECK, seededRng(7));
    expect(DECK.map((c) => c.id)).toEqual(before);
  });

  it("reproduces an exact deal from a seed", () => {
    const a = deal(6, seededRng(42));
    const b = deal(6, seededRng(42));
    expect(a.map((h) => h.map((c) => c.id))).toEqual(b.map((h) => h.map((c) => c.id)));
  });

  it("produces different deals from different seeds", () => {
    const a = deal(6, seededRng(1)).map((h) => h.map((c) => c.id));
    const b = deal(6, seededRng(2)).map((h) => h.map((c) => c.id));
    expect(a).not.toEqual(b);
  });

  it("deals 9 cards to each of 6 players with no remainder (§55)", () => {
    const hands = deal(6, seededRng(3));
    expect(hands).toHaveLength(6);
    for (const hand of hands) expect(hand).toHaveLength(CARDS_PER_PLAYER);

    const allIds = hands.flat().map((c) => c.id);
    expect(new Set(allIds).size).toBe(TOTAL_CARDS);
  });

  it.each([
    [4, 13, 14],
    [6, 9, 9],
    [8, 6, 7],
  ] as const)(
    "deals all 54 cards to %i players: %i-%i each (§72.1)",
    (players, min, max) => {
      expect(setIdsFor(players)).toHaveLength(9);
      expect(deckFor(players)).toHaveLength(54);
      expect(minCardsPerPlayerFor(players)).toBe(min);
      expect(cardsPerPlayerFor(players)).toBe(max);

      const hands = deal(players, seededRng(11));
      expect(hands).toHaveLength(players);
      for (const hand of hands) {
        expect(hand.length).toBeGreaterThanOrEqual(min);
        expect(hand.length).toBeLessThanOrEqual(max);
      }
      // Every card dealt exactly once.
      expect(new Set(hands.flat().map((c) => c.id)).size).toBe(54);
      expect(hands.flat()).toHaveLength(54);
    },
  );

  it("includes Eights & Jokers at every table size (§72.1)", () => {
    for (const players of [4, 6, 8] as const) {
      const deck = deckFor(players);
      expect(deck.some((c) => c.id === "JOKER-BLACK")).toBe(true);
      expect(deck.some((c) => c.id === "JOKER-COLOR")).toBe(true);
      expect(deck.filter((c) => c.rank === "8")).toHaveLength(4);
      expect(setIdsFor(players)).toContain(9);
    }
  });

  it("keeps hands within one card of each other on an uneven deal (§72.1)", () => {
    for (const players of [4, 8] as const) {
      const sizes = deal(players, seededRng(5)).map((h) => h.length);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    }
  });

  it("gives a majority win score for every table size (§72.3)", () => {
    expect(winScoreFor(4)).toBe(5);
    expect(winScoreFor(6)).toBe(5);
    expect(winScoreFor(8)).toBe(5);
  });

  it("actually shuffles", () => {
    const dealt = shuffle(DECK, seededRng(99)).map((c) => c.id);
    expect(dealt).not.toEqual(DECK.map((c) => c.id));
  });
});
