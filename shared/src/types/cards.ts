/**
 * Card model and the exact 54-card deck. Spec §47.
 *
 * 9 sets x 6 cards. Each suit splits into a low half-suit (2-7) and a high
 * half-suit (9-A); the four 8s and the two jokers form set 9.
 */

export type Suit = "S" | "H" | "D" | "C" | "NONE";

export type Rank =
  | "2" | "3" | "4" | "5" | "6" | "7"
  | "8"
  | "9" | "10" | "J" | "Q" | "K" | "A"
  | "JOKER";

/** 1-9. Sets 1-8 are half-suits; set 9 is Eights & Jokers. */
export type SetId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface Card {
  /** Stable wire identity, e.g. "H-5", "JOKER-BLACK". Never object identity. */
  id: string;
  setId: SetId;
  rank: Rank;
  suit: Suit;
  /** Text contexts only (activity log, chat), e.g. "5♥". Faces render SVG (§67.1). */
  label: string;
}

/** Red suits vs black suits. Never the only channel for meaning (§64.8). */
export const SUIT_COLOR: Record<Suit, "red" | "black"> = {
  S: "black",
  C: "black",
  H: "red",
  D: "red",
  NONE: "black",
};

export interface CardSetDefinition {
  setId: SetId;
  /** Display name, e.g. "Low Spades". */
  name: string;
  suit: Suit;
  /** Canonical order. The declaration reveal renders in this order (§61.2). */
  cardIds: readonly string[];
}

/**
 * Text-context only: activity log, chat, aria fallbacks, debugging.
 *
 * Card faces MUST NOT render these. Unicode suit characters vary by font and
 * can take emoji presentation on some platforms, so text glyphs make the same
 * card look different per device. Faces use SVG pip paths instead (§67.1).
 */
export const SUIT_SYMBOL: Record<Suit, string> = {
  S: "♠",
  H: "♥",
  D: "♦",
  C: "♣",
  NONE: "",
};

export const SUIT_NAME: Record<Suit, string> = {
  S: "Spades",
  H: "Hearts",
  D: "Diamonds",
  C: "Clubs",
  NONE: "",
};

const LOW_RANKS: readonly Rank[] = ["2", "3", "4", "5", "6", "7"];
const HIGH_RANKS: readonly Rank[] = ["9", "10", "J", "Q", "K", "A"];

const RANK_NAME: Record<Rank, string> = {
  "2": "Two", "3": "Three", "4": "Four", "5": "Five", "6": "Six", "7": "Seven",
  "8": "Eight",
  "9": "Nine", "10": "Ten", J: "Jack", Q: "Queen", K: "King", A: "Ace",
  JOKER: "Joker",
};

export const cardId = (suit: Suit, rank: Rank): string => `${suit}-${rank}`;

export const BLACK_JOKER_ID = "JOKER-BLACK";
export const COLORED_JOKER_ID = "JOKER-COLOR";

/** Suit order used for sets 1-8: spades, hearts, diamonds, clubs. */
const SUIT_ORDER: readonly Exclude<Suit, "NONE">[] = ["S", "H", "D", "C"];

function buildDeck(): { cards: Card[]; sets: CardSetDefinition[] } {
  const cards: Card[] = [];
  const sets: CardSetDefinition[] = [];

  SUIT_ORDER.forEach((suit, suitIndex) => {
    for (const half of ["low", "high"] as const) {
      const setId = (suitIndex * 2 + (half === "low" ? 1 : 2)) as SetId;
      const ranks = half === "low" ? LOW_RANKS : HIGH_RANKS;
      const ids: string[] = [];

      for (const rank of ranks) {
        const id = cardId(suit, rank);
        ids.push(id);
        cards.push({
          id,
          setId,
          rank,
          suit,
          label: `${rank}${SUIT_SYMBOL[suit]}`,
        });
      }

      sets.push({
        setId,
        name: `${half === "low" ? "Low" : "High"} ${SUIT_NAME[suit]}`,
        suit,
        cardIds: ids,
      });
    }
  });

  // Set 9: the four 8s plus both jokers.
  const eightIds = SUIT_ORDER.map((suit) => {
    const id = cardId(suit, "8");
    cards.push({ id, setId: 9, rank: "8", suit, label: `8${SUIT_SYMBOL[suit]}` });
    return id;
  });

  cards.push(
    { id: BLACK_JOKER_ID, setId: 9, rank: "JOKER", suit: "NONE", label: "Black Joker" },
    { id: COLORED_JOKER_ID, setId: 9, rank: "JOKER", suit: "NONE", label: "Colored Joker" },
  );

  sets.push({
    setId: 9,
    name: "Eights & Jokers",
    suit: "NONE",
    cardIds: [...eightIds, BLACK_JOKER_ID, COLORED_JOKER_ID],
  });

  return { cards, sets };
}

const built = buildDeck();

/** All 54 cards, in canonical set order. */
export const DECK: readonly Card[] = Object.freeze(built.cards);

/** The 9 set definitions, indexed 0-8 for sets 1-9. */
export const CARD_SETS: readonly CardSetDefinition[] = Object.freeze(built.sets);

const CARD_BY_ID = new Map(DECK.map((c) => [c.id, c]));
const SET_BY_ID = new Map(CARD_SETS.map((s) => [s.setId, s]));

export const getCard = (id: string): Card | undefined => CARD_BY_ID.get(id);
export const getSet = (setId: SetId): CardSetDefinition | undefined => SET_BY_ID.get(setId);

export const isValidCardId = (id: string): boolean => CARD_BY_ID.has(id);

/** Accessible name for screen readers (§64.8, §67.4), e.g. "Five of Hearts". */
export function cardAccessibleName(card: Card): string {
  if (card.rank === "JOKER") {
    return card.id === BLACK_JOKER_ID ? "Black Joker" : "Colored Joker";
  }
  return `${RANK_NAME[card.rank]} of ${SUIT_NAME[card.suit]}`;
}

export const ALL_SET_IDS: readonly SetId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** The eight suited half-suits. Set 9 (Eights & Jokers) is six-player only (§72). */
export const SUITED_SET_IDS: readonly SetId[] = [1, 2, 3, 4, 5, 6, 7, 8];

/** Sets in play. All nine, at every table size (§72.1). */
export function setIdsFor(_playerCount: number): SetId[] {
  return [...ALL_SET_IDS];
}

/** The deck: always the full 54 cards, Eights & Jokers included (§72.1). */
export function deckFor(_playerCount: number): Card[] {
  return [...DECK];
}
