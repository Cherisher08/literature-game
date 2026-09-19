import { describe, expect, it } from "vitest";
import { DEFAULT_POKER_CONFIG } from "@memory-game/shared";
import {
  createInitialPokerState,
  handlePokerAction,
  projectPokerState,
  startNewPokerHand,
} from "./engine.js";

describe("Poker Engine State Machine", () => {
  it("initializes poker state with players and default chips", () => {
    const state = createInitialPokerState(
      [
        { id: "p1", name: "Alice", isBot: false },
        { id: "p2", name: "Bob", isBot: false },
        { id: "p3", name: "Charlie", isBot: true },
      ],
      DEFAULT_POKER_CONFIG,
    );

    expect(state.players).toHaveLength(3);
    expect(state.players[0]!.chips).toBe(1000);
    expect(state.status).toBe("LOBBY");
  });

  it("starts a hand, posts blinds, and deals hole cards", () => {
    const state = createInitialPokerState(
      [
        { id: "p1", name: "Alice", isBot: false },
        { id: "p2", name: "Bob", isBot: false },
        { id: "p3", name: "Charlie", isBot: true },
      ],
      DEFAULT_POKER_CONFIG,
    );

    startNewPokerHand(state);

    expect(state.status).toBe("PLAYING");
    expect(state.round).toBe("PRE_FLOP");
    expect(state.handNumber).toBe(1);

    // Each active player should have 2 hole cards
    for (const p of state.players) {
      expect(p.holeCards).toHaveLength(2);
    }

    // SB should have put in 10, BB should have put in 20
    const sb = state.players[state.sbSeat]!;
    const bb = state.players[state.bbSeat]!;
    expect(sb.currentBet).toBe(10);
    expect(bb.currentBet).toBe(20);
    expect(state.highestBet).toBe(20);
    expect(state.mainPot).toBe(30);
  });

  it("allows calling, checking, raising and advancing streets", () => {
    const state = createInitialPokerState(
      [
        { id: "p1", name: "Alice", isBot: false },
        { id: "p2", name: "Bob", isBot: false },
      ],
      DEFAULT_POKER_CONFIG,
    );

    startNewPokerHand(state);
    // In heads up, p1 is dealer/SB, p2 is BB
    const activePlayerId = state.players[state.activeSeat!]!.id;

    // Active player calls BB
    const callRes = handlePokerAction(state, activePlayerId, { type: "CALL" });
    expect(callRes.ok).toBe(true);

    // BB checks
    const bbPlayerId = state.players[state.activeSeat!]!.id;
    const checkRes = handlePokerAction(state, bbPlayerId, { type: "CHECK" });
    expect(checkRes.ok).toBe(true);

    // Street should now advance to FLOP!
    expect(state.round).toBe("FLOP");
    expect(state.communityCards).toHaveLength(3);
    expect(state.highestBet).toBe(0);
  });

  it("awards pot immediately when all but one player folds", () => {
    const state = createInitialPokerState(
      [
        { id: "p1", name: "Alice", isBot: false },
        { id: "p2", name: "Bob", isBot: false },
      ],
      DEFAULT_POKER_CONFIG,
    );

    startNewPokerHand(state);
    const activePlayerId = state.players[state.activeSeat!]!.id;

    // Active player folds
    const foldRes = handlePokerAction(state, activePlayerId, { type: "FOLD" });
    expect(foldRes.ok).toBe(true);

    expect(state.round).toBe("HAND_OVER");
    expect(state.winners).toHaveLength(1);
    expect(state.winners![0]!.playerId).not.toBe(activePlayerId);
  });

  it("projects state securely hiding opponent hole cards pre-showdown", () => {
    const state = createInitialPokerState(
      [
        { id: "p1", name: "Alice", isBot: false },
        { id: "p2", name: "Bob", isBot: false },
      ],
      DEFAULT_POKER_CONFIG,
    );

    startNewPokerHand(state);

    const projP1 = projectPokerState(state, "p1");
    expect(projP1.myHoleCards).toHaveLength(2);

    // p1 sees own cards
    const p1InP1 = projP1.players.find((p) => p.id === "p1")!;
    expect(p1InP1.holeCards).toHaveLength(2);

    // p1 CANNOT see p2's cards
    const p2InP1 = projP1.players.find((p) => p.id === "p2")!;
    expect(p2InP1.holeCards).toBeUndefined();
    expect(p2InP1.hasCards).toBe(true);
  });
});
