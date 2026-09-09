/**
 * Bot quality, measured rather than assumed. Spec §73.2.
 *
 * Plays full games through the real reducer with the real projection, so these
 * are end-to-end behaviour checks, not unit tests of the scorer.
 *
 * The headline assertion is the success rate of asks: a successful ask keeps
 * the turn (§14), so it is the single best proxy for how well a bot plays.
 */

import { describe, expect, it } from "vitest";
import {
  type BotDifficulty,
  type GameState,
  type PlayerCount,
} from "@memory-game/shared";
import { createGameState, reduce, type NewGamePlayer } from "../game/engine.js";
import { deal, seededRng } from "../game/shuffle.js";

/**
 * Unit-interval RNG. `seededRng` returns an integer in [0, max) and needs an
 * argument; calling it bare yields NaN, which silently destroys every score.
 */
function seededUnit(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
import { projectGameFor } from "../rooms/projection.js";
import type { GameRoom } from "../rooms/types.js";
import { chooseMove } from "./strategy.js";

const PLAYERS: PlayerCount = 4;
const NAMES = ["Hulk", "Thor", "Batman", "Spiderman"];

function room(game: GameState): GameRoom {
  return {
    id: "TEST01",
    hostId: game.players[0]!.id,
    status: "PLAYING",
    playerCount: PLAYERS,
    players: game.players.map((p) => ({
      id: p.id,
      name: p.name,
      seatPosition: p.seatPosition,
      connected: true,
      sessionToken: `t-${p.id}`,
    })),
    game,
    chatMessages: [],
    createdAt: 0,
    lastActivityAt: 0,
    seq: 0,
    voiceParticipants: [],
  };
}

interface Result {
  asks: number;
  successes: number;
  declarations: number;
  correctDeclarations: number;
  resolved: number;
}

/** Plays one game where every seat is the same difficulty. */
function playout(difficulty: BotDifficulty, seed: number, maxTurns = 600): Result {
  const hands = deal(PLAYERS, seededRng(seed));
  const players: NewGamePlayer[] = NAMES.map((name, i) => ({
    id: `p${i}`,
    name,
    seatPosition: i + 1,
    hand: hands[i]!,
  }));

  let state = createGameState(players, "p0");
  const r: Result = {
    asks: 0,
    successes: 0,
    declarations: 0,
    correctDeclarations: 0,
    resolved: 0,
  };
  const rng = seededUnit(seed * 7919 + 13);

  for (let turn = 0; turn < maxTurns && state.status === "PLAYING"; turn++) {
    const current = state.turn;
    const actorId =
      current.kind === "PLAYER"
        ? current.playerId
        : state.players.find((p) => p.teamId === current.teamId && p.hand.length > 0)?.id;
    if (!actorId) break;

    const view = projectGameFor(room(state), state, actorId);
    const move = chooseMove({ view, difficulty, random: rng });
    if (move.kind === "NONE") break;

    if (move.kind === "ASK") {
      const res = reduce(state, {
        type: "ASK",
        playerId: actorId,
        targetId: move.targetId,
        cardId: move.cardId,
      });
      if (!res.ok) break;
      r.asks += 1;
      if (res.state.lastAsk?.result === "SUCCESS") r.successes += 1;
      state = res.state;
      continue;
    }

    const opened = reduce(state, { type: "OPEN_DECLARATION", playerId: actorId, now: turn });
    if (!opened.ok) break;
    const declared = reduce(opened.state, {
      type: "DECLARE",
      playerId: actorId,
      setId: move.setId,
      assignments: move.assignments,
    });
    if (!declared.ok) break;

    r.declarations += 1;
    const result = declared.events.find((e) => e.type === "DECLARATION_RESOLVED");
    if (result?.type === "DECLARATION_RESOLVED" && result.result.overallCorrect) {
      r.correctDeclarations += 1;
    }
    state = declared.state;
  }

  r.resolved = state.resolvedSets.length;
  return r;
}

function aggregate(difficulty: BotDifficulty, games = 12): Result {
  const total: Result = {
    asks: 0,
    successes: 0,
    declarations: 0,
    correctDeclarations: 0,
    resolved: 0,
  };
  for (let i = 1; i <= games; i++) {
    const r = playout(difficulty, i);
    total.asks += r.asks;
    total.successes += r.successes;
    total.declarations += r.declarations;
    total.correctDeclarations += r.correctDeclarations;
    total.resolved += r.resolved;
  }
  return total;
}

const rate = (r: Result) => (r.asks === 0 ? 0 : r.successes / r.asks);

describe("bot play quality (§73.2)", () => {
  const easy = aggregate("EASY");
  const medium = aggregate("MEDIUM");
  const hard = aggregate("HARD");

  it("reports the measured rates", () => {
    const pct = (r: typeof easy) => `${(rate(r) * 100).toFixed(1)}%`;
    console.log(
      `
  ask success — EASY ${pct(easy)} | MEDIUM ${pct(medium)} | HARD ${pct(hard)}` +
        `
  sets resolved — EASY ${easy.resolved} | MEDIUM ${medium.resolved} | HARD ${hard.resolved}` +
        `
  declarations  — EASY ${easy.declarations} | MEDIUM ${medium.declarations} | HARD ${hard.declarations}` +
        ` (HARD correct: ${hard.correctDeclarations}/${hard.declarations})
`,
    );
    expect(hard.asks).toBeGreaterThan(0);
  });

  it("plays enough asks to measure", () => {
    expect(easy.asks).toBeGreaterThan(50);
    expect(hard.asks).toBeGreaterThan(50);
  });

  it("HARD asks more successfully than EASY", () => {
    expect(rate(hard)).toBeGreaterThan(rate(easy));
  });

  it("MEDIUM asks more successfully than EASY", () => {
    expect(rate(medium)).toBeGreaterThan(rate(easy));
  });

  it("HARD is at least as good as MEDIUM", () => {
    expect(rate(hard)).toBeGreaterThanOrEqual(rate(medium) - 0.02);
  });

  it("HARD hits a respectable success rate", () => {
    // Random legal play in a 4-player game lands near 1-in-3.
    expect(rate(hard)).toBeGreaterThan(0.45);
  });

  it("HARD never declares a set it has not deduced", () => {
    // Certainty is certainty: every HARD declaration should be correct.
    expect(hard.declarations).toBeGreaterThan(0);
    expect(hard.correctDeclarations).toBe(hard.declarations);
  });

  it("HARD resolves more sets than EASY", () => {
    expect(hard.resolved).toBeGreaterThan(easy.resolved);
  });
});
