import { DECK, type Card } from "../types/cards.js";

/** The standard 52-card deck without Jokers. */
export const POKER_DECK: readonly Card[] = Object.freeze(
  DECK.filter((c) => c.rank !== "JOKER"),
);

/** Create a fresh copy of the 52-card deck. */
export function createPokerDeck(): Card[] {
  return [...POKER_DECK];
}

/** Fisher-Yates shuffle on a card array */
export function shufflePokerDeck(deck: Card[]): Card[] {
  const cards = [...deck];
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = cards[i]!;
    cards[i] = cards[j]!;
    cards[j] = temp;
  }
  return cards;
}
