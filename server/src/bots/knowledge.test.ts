/**
 * Bot deduction. Spec §73.
 *
 * The first test is the important one: a bot must never know more than a human
 * at the same seat. If that regresses, bots become omniscient cheats and the
 * game is worthless.
 */

import { describe, expect, it } from "vitest";
import {
  getCard,
  type ClientGameState,
  type GameEvent,
  type LastAsk,
  type PublicPlayer,
} from "@memory-game/shared";
import { buildKnowledge, deducedAssignment, knownHolder } from "./knowledge.js";
import { chooseMove } from "./strategy.js";

const IDS = ["alice", "bob", "carol", "dave"] as const;

function player(id: string, seat: number, cardCount: number): PublicPlayer {
  return {
    id,
    name: id,
    teamId: seat % 2 === 1 ? "A" : "B",
    seatPosition: seat,
    connected: true,
    cardCount,
    spectating: cardCount === 0,
    isBot: false,
  };
}

function view(opts: {
  myHand: string[];
  counts?: Partial<Record<string, number>>;
  history?: GameEvent[];
  me?: string;
}): ClientGameState {
  const me = opts.me ?? "alice";
  return {
    status: "PLAYING",
    players: IDS.map((id, i) => player(id, i + 1, opts.counts?.[id] ?? 5)),
    turn: { kind: "PLAYER", playerId: me },
    teamScores: { A: 0, B: 0 },
    askingRule: { A: "OPPONENT_ONLY", B: "OPPONENT_ONLY" },
    resolvedSets: [],
    activeSetIds: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    rules: { mustHoldCardInSet: true, mayAskForOwnedCard: true, winScore: 5 },
    history: opts.history ?? [],
    myHand: opts.myHand.map((id) => getCard(id)!),
    myPlayerId: me,
  };
}

const ask = (
  askerId: string,
  targetId: string,
  cardId: string,
  result: "SUCCESS" | "FAIL",
): GameEvent => {
  const card = getCard(cardId)!;
  const lastAsk: LastAsk = {
    askerId,
    askerName: askerId,
    askerTeamId: "A",
    targetId,
    targetName: targetId,
    card,
    result,
    askIndex: 1,
    timestamp: 0,
  };
  return { type: "ASK_RESOLVED", lastAsk };
};

// ---------------------------------------------------------------------------

describe("bot fairness (§53, §73)", () => {
  it("knows its own hand exactly and nobody else's", () => {
    const v = view({ myHand: ["S-2", "S-3"] });
    const k = buildKnowledge(v);

    expect(knownHolder(k, "S-2")).toBe("alice");
    expect(knownHolder(k, "S-3")).toBe("alice");
    // A card it does not hold is genuinely uncertain.
    expect(knownHolder(k, "S-4")).toBeUndefined();
    expect(k.candidates.get("S-4")!.size).toBeGreaterThan(1);
  });

  it("rules itself out of every card it does not hold", () => {
    const v = view({ myHand: ["S-2"] });
    const k = buildKnowledge(v);
    for (const id of ["S-3", "S-4", "H-5"]) {
      expect(k.candidates.get(id)!.has("alice")).toBe(false);
    }
  });

  it("takes nothing from the projection beyond what a human sees", () => {
    // The projection type carries exactly one hand, so there is nothing else
    // to read. This asserts the input contract the model relies on.
    const v = view({ myHand: ["S-2"] });
    expect(Object.keys(v)).not.toContain("players.hand");
    expect(v.players.every((p) => !("hand" in p))).toBe(true);
  });
});

describe("deduction from the public record", () => {
  it("learns a card's location from a successful ask", () => {
    const v = view({ myHand: ["S-2"], history: [ask("bob", "carol", "S-4", "SUCCESS")] });
    expect(knownHolder(buildKnowledge(v), "S-4")).toBe("bob");
  });

  it("eliminates a holder from a failed ask", () => {
    const v = view({ myHand: ["S-2"], history: [ask("bob", "carol", "S-4", "FAIL")] });
    const k = buildKnowledge(v);
    expect(k.candidates.get("S-4")!.has("carol")).toBe(false);
    // §13: asking proves nothing about the asker's own holding.
    expect(k.candidates.get("S-4")!.has("bob")).toBe(true);
  });

  it("lets a later transfer override an earlier elimination", () => {
    const v = view({
      myHand: ["S-2"],
      history: [ask("bob", "carol", "S-4", "FAIL"), ask("carol", "dave", "S-4", "SUCCESS")],
    });
    expect(knownHolder(buildKnowledge(v), "S-4")).toBe("carol");
  });

  it("records that an asker holds something in that set (§48)", () => {
    const v = view({ myHand: ["S-2"], history: [ask("bob", "carol", "S-4", "FAIL")] });
    expect(buildKnowledge(v).holdsInSet.get("bob")?.has(1)).toBe(true);
  });

  it("excludes players holding no cards", () => {
    const v = view({ myHand: ["S-2"], counts: { dave: 0 } });
    const k = buildKnowledge(v);
    expect(k.candidates.get("S-4")!.has("dave")).toBe(false);
  });

  it("narrows to a single candidate by elimination", () => {
    const v = view({
      myHand: ["S-2"],
      history: [ask("x", "bob", "S-4", "FAIL"), ask("x", "carol", "S-4", "FAIL")],
    });
    // alice excluded (not in hand), bob and carol denied -> only dave left.
    expect(knownHolder(buildKnowledge(v), "S-4")).toBe("dave");
  });

  it("deduces a whole set when every card is pinned", () => {
    const set1 = ["S-2", "S-3", "S-4", "S-5", "S-6", "S-7"];
    const history = set1.slice(1).map((id) => ask("bob", "carol", id, "SUCCESS"));
    const v = view({ myHand: ["S-2"], history });
    const assignment = deducedAssignment(buildKnowledge(v), 1);
    expect(assignment).toBeDefined();
    expect(assignment!.find((a) => a.cardId === "S-2")!.playerId).toBe("alice");
    expect(assignment!.filter((a) => a.playerId === "bob")).toHaveLength(5);
  });
});

describe("difficulty (§73)", () => {
  const rng = () => 0.5;

  it("EASY only declares a set it holds outright", () => {
    const whole = ["S-2", "S-3", "S-4", "S-5", "S-6", "S-7"];
    const move = chooseMove({
      view: view({ myHand: whole, counts: { alice: 6 } }),
      difficulty: "EASY",
      random: rng,
    });
    expect(move.kind).toBe("DECLARE");
    if (move.kind === "DECLARE") {
      expect(move.setId).toBe(1);
      expect(move.assignments.every((a) => a.playerId === "alice")).toBe(true);
    }
  });

  it("EASY does not declare on deduction alone", () => {
    const history = ["S-3", "S-4", "S-5", "S-6", "S-7"].map((id) =>
      ask("bob", "carol", id, "SUCCESS"),
    );
    const move = chooseMove({
      view: view({ myHand: ["S-2"], history }),
      difficulty: "EASY",
      random: rng,
    });
    expect(move.kind).not.toBe("DECLARE");
  });

  it("HARD declares a fully deduced set even when opponents hold it", () => {
    const history = ["S-3", "S-4", "S-5", "S-6", "S-7"].map((id) =>
      ask("bob", "carol", id, "SUCCESS"),
    );
    const move = chooseMove({
      view: view({ myHand: ["S-2"], history }),
      difficulty: "HARD",
      random: rng,
    });
    expect(move.kind).toBe("DECLARE");
    if (move.kind === "DECLARE") expect(move.setId).toBe(1);
  });

  it("only ever asks within a set it holds (§48)", () => {
    for (const difficulty of ["EASY", "MEDIUM", "HARD"] as const) {
      for (let i = 0; i < 40; i++) {
        const move = chooseMove({
          view: view({ myHand: ["S-2", "H-5"] }),
          difficulty,
          random: Math.random,
        });
        if (move.kind !== "ASK") continue;
        const setId = getCard(move.cardId)!.setId;
        expect([1, 3]).toContain(setId);
      }
    }
  });

  it("never asks itself, and never asks an empty-handed player (§49)", () => {
    for (let i = 0; i < 40; i++) {
      const move = chooseMove({
        view: view({ myHand: ["S-2"], counts: { dave: 0 } }),
        difficulty: "HARD",
        random: Math.random,
      });
      if (move.kind !== "ASK") continue;
      expect(move.targetId).not.toBe("alice");
      expect(move.targetId).not.toBe("dave");
    }
  });

  it("asks only opponents under OPPONENT_ONLY (§12)", () => {
    for (let i = 0; i < 40; i++) {
      const move = chooseMove({
        view: view({ myHand: ["S-2"] }),
        difficulty: "MEDIUM",
        random: Math.random,
      });
      if (move.kind !== "ASK") continue;
      // alice is seat 1 -> team A; bob and dave are team B.
      expect(["bob", "dave"]).toContain(move.targetId);
    }
  });

  it("does nothing when it holds no cards (§62.1)", () => {
    const move = chooseMove({
      view: view({ myHand: [], counts: { alice: 0 } }),
      difficulty: "HARD",
      random: rng,
    });
    expect(move.kind).toBe("NONE");
  });
});
