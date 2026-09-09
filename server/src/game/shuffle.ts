/**
 * Shuffling and dealing. Spec §56.
 *
 * Cryptographic Fisher-Yates. Never Math.random(), and never
 * sort(() => Math.random() - 0.5), which is measurably biased.
 *
 * The RNG is injectable so a seed reproduces an exact deal in tests. The seed
 * must never leave the server: it reconstructs every hand.
 */

import { randomInt } from "node:crypto";
import {
  DECK,
  cardsPerPlayerFor,
  deckFor,
  minCardsPerPlayerFor,
  type Card,
  type PlayerCount,
} from "@memory-game/shared";

/** Returns a uniformly random integer in [0, maxExclusive). */
export type Rng = (maxExclusive: number) => number;

export const cryptoRng: Rng = (maxExclusive) => randomInt(maxExclusive);

/**
 * Deterministic RNG for tests only. Mulberry32 — small, fast, well-distributed
 * enough for reproducing deals. Not for production shuffling.
 */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return (maxExclusive: number) => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const unit = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return Math.floor(unit * maxExclusive);
  };
}

export function shuffle<T>(items: readonly T[], rng: Rng = cryptoRng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    const ai = a[i]!;
    a[i] = a[j]!;
    a[j] = ai;
  }
  return a;
}

/**
 * Shuffles the deck for a table size and deals evenly. Returns hands indexed by
 * seat order (index 0 = seat 1). Spec §55, §72.1.
 */
export function deal(playerCount: PlayerCount, rng: Rng = cryptoRng): Card[][] {
  const shuffled = shuffle(deckFor(playerCount), rng);
  const hands: Card[][] = Array.from({ length: playerCount }, () => []);

  // Round-robin, so an uneven deal differs by at most one card (§72.1).
  shuffled.forEach((card, i) => {
    hands[i % playerCount]!.push(card);
  });

  const min = minCardsPerPlayerFor(playerCount);
  const max = cardsPerPlayerFor(playerCount);
  for (const hand of hands) {
    if (hand.length < min || hand.length > max) {
      throw new Error(`deal produced a hand of ${hand.length}, expected ${min}-${max}`);
    }
  }

  return hands;
}
