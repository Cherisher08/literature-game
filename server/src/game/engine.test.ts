import { describe, expect, it } from "vitest";
import {
  DEFAULT_RULES,
  getCard,
  getSet,
  type Assignment,
  type GameState,
  type SetId,
} from "@memory-game/shared";
import { createGameState, reduce, type NewGamePlayer } from "./engine.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SEATS = [
  { id: "alice", name: "Alice", seatPosition: 1 }, // A
  { id: "bob", name: "Bob", seatPosition: 2 }, // B
  { id: "carol", name: "Carol", seatPosition: 3 }, // A
  { id: "dave", name: "Dave", seatPosition: 4 }, // B
  { id: "erin", name: "Erin", seatPosition: 5 }, // A
  { id: "frank", name: "Frank", seatPosition: 6 }, // B
];

const cards = (...ids: string[]) => ids.map((id) => getCard(id)!);

/** Builds a state with exactly the hands given. Unlisted players hold nothing. */
function makeGame(
  hands: Record<string, string[]>,
  firstPlayerId = "alice",
  rules = DEFAULT_RULES,
): GameState {
  const players: NewGamePlayer[] = SEATS.map((s) => ({
    ...s,
    hand: cards(...(hands[s.id] ?? [])),
  }));
  return createGameState(players, firstPlayerId, rules);
}

const ok = (r: ReturnType<typeof reduce>) => {
  if (!r.ok) throw new Error(`expected success, got ${r.error}`);
  return r;
};
const err = (r: ReturnType<typeof reduce>) => {
  if (r.ok) throw new Error("expected failure, got success");
  return r.error;
};

const handOf = (s: GameState, id: string) =>
  s.players.find((p) => p.id === id)!.hand.map((c) => c.id);

/** Every card of a set, distributed across the given players in canonical order. */
function spreadSet(setId: SetId, playerIds: string[]): Record<string, string[]> {
  const ids = getSet(setId)!.cardIds;
  const out: Record<string, string[]> = {};
  ids.forEach((cardId, i) => {
    const pid = playerIds[i % playerIds.length]!;
    (out[pid] ??= []).push(cardId);
  });
  return out;
}

const assignmentsFrom = (state: GameState, setId: SetId): Assignment[] =>
  getSet(setId)!.cardIds.map((cardId) => ({
    cardId,
    playerId: state.players.find((p) => p.hand.some((c) => c.id === cardId))!.id,
  }));

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe("game setup (§6)", () => {
  it("alternates teams by seat", () => {
    const s = makeGame({});
    expect(s.players.map((p) => p.teamId)).toEqual(["A", "B", "A", "B", "A", "B"]);
  });
});

// ---------------------------------------------------------------------------
// §48 — set membership, the core rule
// ---------------------------------------------------------------------------

describe("set membership requirement (§48)", () => {
  it("rejects an ask in a set the asker holds no card of", () => {
    const s = makeGame({ alice: ["S-2"], bob: ["H-5"] });
    expect(err(reduce(s, { type: "ASK", playerId: "alice", targetId: "bob", cardId: "H-5" })))
      .toBe("ILLEGAL_ASK_SET");
  });

  it("allows an ask in a set the asker holds a card of", () => {
    const s = makeGame({ alice: ["H-2"], bob: ["H-5"] });
    const r = ok(reduce(s, { type: "ASK", playerId: "alice", targetId: "bob", cardId: "H-5" }));
    expect(r.state.lastAsk?.result).toBe("SUCCESS");
  });

  it("does not change the turn when rejected", () => {
    const s = makeGame({ alice: ["S-2"], bob: ["H-5"] });
    reduce(s, { type: "ASK", playerId: "alice", targetId: "bob", cardId: "H-5" });
    expect(s.turn).toEqual({ kind: "PLAYER", playerId: "alice" });
  });

  it("does not enter history when rejected", () => {
    const s = makeGame({ alice: ["S-2"], bob: ["H-5"] });
    reduce(s, { type: "ASK", playerId: "alice", targetId: "bob", cardId: "H-5" });
    expect(s.history).toHaveLength(0);
  });

  it("can be switched off", () => {
    const s = makeGame({ alice: ["S-2"], bob: ["H-5"] }, "alice", {
      ...DEFAULT_RULES,
      mustHoldCardInSet: false,
    });
    expect(ok(reduce(s, { type: "ASK", playerId: "alice", targetId: "bob", cardId: "H-5" })).ok)
      .toBe(true);
  });
});

// ---------------------------------------------------------------------------
// §13 — tactical asking for a card you already hold
// ---------------------------------------------------------------------------

describe("asking for a card you already hold (§13)", () => {
  it("is allowed by default", () => {
    const s = makeGame({ alice: ["H-5"], bob: ["H-2"] });
    const r = ok(reduce(s, { type: "ASK", playerId: "alice", targetId: "bob", cardId: "H-5" }));
    // Bob does not have it: the ask fails and the turn passes.
    expect(r.state.lastAsk?.result).toBe("FAIL");
    expect(r.state.turn).toEqual({ kind: "PLAYER", playerId: "bob" });
  });

  it("is rejected when the rule is switched off", () => {
    const s = makeGame({ alice: ["H-5"], bob: ["H-2"] }, "alice", {
      ...DEFAULT_RULES,
      mayAskForOwnedCard: false,
    });
    expect(err(reduce(s, { type: "ASK", playerId: "alice", targetId: "bob", cardId: "H-5" })))
      .toBe("ALREADY_OWNED");
  });
});

// ---------------------------------------------------------------------------
// §14-15, §49 — ask resolution and validation order
// ---------------------------------------------------------------------------

describe("ask resolution (§14, §15)", () => {
  it("transfers the card and keeps the turn on success (§14)", () => {
    const s = makeGame({ alice: ["H-2"], bob: ["H-5", "S-3"] });
    const r = ok(reduce(s, { type: "ASK", playerId: "alice", targetId: "bob", cardId: "H-5" }));
    expect(handOf(r.state, "alice")).toContain("H-5");
    expect(handOf(r.state, "bob")).not.toContain("H-5");
    expect(r.state.turn).toEqual({ kind: "PLAYER", playerId: "alice" });
    expect(r.events.map((e) => e.type)).toContain("CARD_TRANSFERRED");
  });

  it("passes the turn to the target on failure (§15)", () => {
    const s = makeGame({ alice: ["H-2"], bob: ["S-3"] });
    const r = ok(reduce(s, { type: "ASK", playerId: "alice", targetId: "bob", cardId: "H-5" }));
    expect(r.state.turn).toEqual({ kind: "PLAYER", playerId: "bob" });
    expect(r.state.lastAsk?.turnPassedToId).toBe("bob");
  });

  it("increments askIndex monotonically (§65.1)", () => {
    const s = makeGame({ alice: ["H-2"], bob: ["S-3"] });
    const r1 = ok(reduce(s, { type: "ASK", playerId: "alice", targetId: "bob", cardId: "H-5" }));
    expect(r1.state.lastAsk?.askIndex).toBe(1);
    const r2 = ok(reduce(r1.state, {
      type: "ASK", playerId: "bob", targetId: "alice", cardId: "S-2",
    }));
    expect(r2.state.lastAsk?.askIndex).toBe(2);
  });
});

describe("ask validation order (§49)", () => {
  const base = () => makeGame({ alice: ["H-2"], bob: ["H-5"], carol: ["H-3"] });

  it("rejects when it is not your turn", () => {
    expect(err(reduce(base(), { type: "ASK", playerId: "bob", targetId: "alice", cardId: "H-2" })))
      .toBe("NOT_YOUR_TURN");
  });

  it("rejects asking yourself", () => {
    expect(err(reduce(base(), { type: "ASK", playerId: "alice", targetId: "alice", cardId: "H-2" })))
      .toBe("INVALID_TARGET");
  });

  it("rejects an empty-handed target", () => {
    const s = makeGame({ alice: ["H-2"], bob: [] });
    expect(err(reduce(s, { type: "ASK", playerId: "alice", targetId: "bob", cardId: "H-5" })))
      .toBe("TARGET_EMPTY");
  });

  it("rejects asking a teammate under OPPONENT_ONLY", () => {
    expect(err(reduce(base(), { type: "ASK", playerId: "alice", targetId: "carol", cardId: "H-3" })))
      .toBe("WRONG_TEAM");
  });

  it("rejects an unknown card", () => {
    expect(err(reduce(base(), { type: "ASK", playerId: "alice", targetId: "bob", cardId: "NOPE" })))
      .toBe("UNKNOWN_CARD");
  });

  it("rejects an ask by a player with no cards", () => {
    const s = makeGame({ alice: [], bob: ["H-5"] });
    expect(err(reduce(s, { type: "ASK", playerId: "alice", targetId: "bob", cardId: "H-5" })))
      .toBe("EMPTY_HAND");
  });
});

// ---------------------------------------------------------------------------
// §50, §62.1 — empty hands and spectating
// ---------------------------------------------------------------------------

describe("empty hands and turn passing (§50)", () => {
  it("skips an empty teammate and lands on one with cards", () => {
    // Alice's last card goes to Bob; the turn would return to Alice, who is now empty.
    const s = makeGame({ alice: ["H-2"], bob: ["H-5"], carol: ["S-4"], erin: ["D-3"] });
    const r = ok(reduce(s, { type: "ASK", playerId: "alice", targetId: "bob", cardId: "H-5" }));
    // Alice gained a card, so she keeps the turn.
    expect(r.state.turn).toEqual({ kind: "PLAYER", playerId: "alice" });
  });

  it("passes to a teammate when a failed ask lands on an empty player", () => {
    // Bob holds one card. Alice asks for it and gets it, emptying Bob.
    const s = makeGame({ alice: ["H-2"], bob: ["H-5"], dave: ["S-7"] });
    const r1 = ok(reduce(s, { type: "ASK", playerId: "alice", targetId: "bob", cardId: "H-5" }));
    expect(handOf(r1.state, "bob")).toHaveLength(0);

    // Alice now asks Dave for a hearts card he does not hold. She holds H-2, so the
    // ask is legal under §48; the turn should pass to Dave, who does have cards.
    const r2 = ok(reduce(r1.state, {
      type: "ASK", playerId: "alice", targetId: "dave", cardId: "H-3",
    }));
    expect(r2.state.turn).toEqual({ kind: "PLAYER", playerId: "dave" });
  });
});

// ---------------------------------------------------------------------------
// §62.3 — DECLARE_ONLY
// ---------------------------------------------------------------------------

describe("DECLARE_ONLY when opponents hold no cards (§62.3)", () => {
  it("derives DECLARE_ONLY for the team whose opponents are empty", () => {
    const s = makeGame({ alice: ["H-2"], carol: ["H-3"] }); // team B holds nothing
    expect(s.askingRule.A).toBe("DECLARE_ONLY");
  });

  it("rejects every ask with NO_TARGETS_AVAILABLE", () => {
    const s = makeGame({ alice: ["H-2"], carol: ["H-3"] });
    expect(err(reduce(s, { type: "ASK", playerId: "alice", targetId: "carol", cardId: "H-3" })))
      .toBe("NO_TARGETS_AVAILABLE");
  });

  it("returns to OPPONENT_ONLY when the opponents regain cards", () => {
    const s = makeGame({ alice: ["H-2"], bob: ["H-5"] });
    expect(s.askingRule.A).toBe("OPPONENT_ONLY");
  });
});

// ---------------------------------------------------------------------------
// §62.4 — declaration window
// ---------------------------------------------------------------------------

describe("declaration window (§62.4)", () => {
  const open = (s: GameState, playerId = "alice", now = 1000) =>
    ok(reduce(s, { type: "OPEN_DECLARATION", playerId, now }));

  it("only the turn holder may open one", () => {
    const s = makeGame({ alice: ["H-2"], bob: ["H-5"] });
    expect(err(reduce(s, { type: "OPEN_DECLARATION", playerId: "bob", now: 1 })))
      .toBe("NOT_YOUR_TURN");
  });

  it("rejects opening while one is already open", () => {
    const s = open(makeGame({ alice: ["H-2"], bob: ["H-5"] })).state;
    expect(err(reduce(s, { type: "OPEN_DECLARATION", playerId: "alice", now: 2 })))
      .toBe("DECLARATION_IN_PROGRESS");
  });

  it("lets a teammate holding cards claim it", () => {
    const s = open(makeGame({ alice: ["H-2"], bob: ["H-5"], carol: ["S-3"] })).state;
    const r = ok(reduce(s, { type: "CLAIM_DECLARATION", playerId: "carol" }));
    expect(r.state.declarationWindow?.claimedBy).toBe("carol");
  });

  it("refuses a claim from a card-less teammate (§62.1)", () => {
    // Erin is on team A but holds nothing.
    const s = open(makeGame({ alice: ["H-2"], bob: ["H-5"] })).state;
    expect(err(reduce(s, { type: "CLAIM_DECLARATION", playerId: "erin" }))).toBe("EMPTY_HAND");
  });

  it("refuses a card-less player opening a declaration (§62.1)", () => {
    const g = makeGame({ alice: [], bob: ["H-5"], carol: ["S-3"] }, "alice");
    expect(err(reduce(g, { type: "OPEN_DECLARATION", playerId: "alice", now: 1 })))
      .toBe("EMPTY_HAND");
  });

  it("rejects a claim from the opposing team", () => {
    const s = open(makeGame({ alice: ["H-2"], bob: ["H-5"] })).state;
    expect(err(reduce(s, { type: "CLAIM_DECLARATION", playerId: "bob" }))).toBe("WRONG_TEAM");
  });

  it("is first-writer-wins", () => {
    const s = open(makeGame({ alice: ["H-2"], bob: ["H-5"], carol: ["S-3"], erin: ["D-4"] })).state;
    const first = ok(reduce(s, { type: "CLAIM_DECLARATION", playerId: "carol" }));
    expect(err(reduce(first.state, { type: "CLAIM_DECLARATION", playerId: "erin" })))
      .toBe("DECLARATION_TAKEN");
  });

  it("releases back to unclaimed, not to the opener", () => {
    const s = open(makeGame({ alice: ["H-2"], bob: ["H-5"], carol: ["S-3"] })).state;
    const claimed = ok(reduce(s, { type: "CLAIM_DECLARATION", playerId: "carol" })).state;
    const released = ok(reduce(claimed, { type: "RELEASE_DECLARATION", playerId: "carol" })).state;
    expect(released.declarationWindow?.claimedBy).toBeUndefined();
    expect(released.declarationWindow?.openedBy).toBe("alice");
  });

  it("rejects a release from someone who is not the claimant", () => {
    const s = open(makeGame({ alice: ["H-2"], bob: ["H-5"], carol: ["S-3"], erin: ["D-4"] })).state;
    const claimed = ok(reduce(s, { type: "CLAIM_DECLARATION", playerId: "carol" })).state;
    expect(err(reduce(claimed, { type: "RELEASE_DECLARATION", playerId: "erin" })))
      .toBe("NOT_CLAIMANT");
  });

  it("expires with no penalty and returns the turn to the opener", () => {
    const s = open(makeGame({ alice: ["H-2"], bob: ["H-5"] }), "alice", 1000).state;
    const r = ok(reduce(s, { type: "EXPIRE_DECLARATION", now: 1000 + 90_000 }));
    expect(r.state.declarationWindow).toBeUndefined();
    expect(r.state.turn).toEqual({ kind: "PLAYER", playerId: "alice" });
    expect(r.state.teamScores).toEqual({ A: 0, B: 0 });
  });

  it("lets the opener cancel and ask again (§62.4)", () => {
    const g = makeGame({ alice: ["H-2"], bob: ["H-5"] });
    const opened = open(g).state;
    // The bug: while a window is open, asking is blocked.
    expect(err(reduce(opened, { type: "ASK", playerId: "alice", targetId: "bob", cardId: "H-5" })))
      .toBe("DECLARATION_IN_PROGRESS");

    const cancelled = ok(reduce(opened, { type: "CANCEL_DECLARATION", playerId: "alice" })).state;
    expect(cancelled.declarationWindow).toBeUndefined();
    expect(cancelled.turn).toEqual({ kind: "PLAYER", playerId: "alice" });

    // And the turn is usable again.
    const r = ok(reduce(cancelled, {
      type: "ASK", playerId: "alice", targetId: "bob", cardId: "H-5",
    }));
    expect(r.state.lastAsk?.result).toBe("SUCCESS");
  });

  it("cancelling costs nothing (§62.4)", () => {
    const g = makeGame({ alice: ["H-2"], bob: ["H-5"] });
    const cancelled = ok(reduce(open(g).state, {
      type: "CANCEL_DECLARATION", playerId: "alice",
    })).state;
    expect(cancelled.teamScores).toEqual({ A: 0, B: 0 });
    expect(cancelled.resolvedSets).toHaveLength(0);
  });

  it("refuses a cancel from the opposing team", () => {
    const g = makeGame({ alice: ["H-2"], bob: ["H-5"] });
    expect(err(reduce(open(g).state, { type: "CANCEL_DECLARATION", playerId: "bob" })))
      .toBe("WRONG_TEAM");
  });

  it("refuses a cancel while a teammate holds the claim", () => {
    const g = makeGame({ alice: ["H-2"], bob: ["H-5"], carol: ["S-3"], erin: ["D-4"] });
    const claimed = ok(reduce(open(g).state, {
      type: "CLAIM_DECLARATION", playerId: "carol",
    })).state;
    expect(err(reduce(claimed, { type: "CANCEL_DECLARATION", playerId: "erin" })))
      .toBe("NOT_CLAIMANT");
    // The claimant may back out themselves.
    expect(ok(reduce(claimed, { type: "CANCEL_DECLARATION", playerId: "carol" })).ok).toBe(true);
  });

  it("blocks asking while a window is open", () => {
    const s = open(makeGame({ alice: ["H-2"], bob: ["H-5"] })).state;
    expect(err(reduce(s, { type: "ASK", playerId: "alice", targetId: "bob", cardId: "H-5" })))
      .toBe("DECLARATION_IN_PROGRESS");
  });
});

// ---------------------------------------------------------------------------
// §61 — declaration resolution and reveal
// ---------------------------------------------------------------------------

describe("declaration (§61)", () => {
  /** Set 1 spread across all six players; team A on the turn. */
  function setGame() {
    const hands = spreadSet(1, ["alice", "bob", "carol", "dave", "erin", "frank"]);
    const s = makeGame(hands);
    return ok(reduce(s, { type: "OPEN_DECLARATION", playerId: "alice", now: 0 })).state;
  }

  it("awards the set to the declaring team when all six are correct", () => {
    const s = setGame();
    const r = ok(reduce(s, {
      type: "DECLARE", playerId: "alice", setId: 1, assignments: assignmentsFrom(s, 1),
    }));
    const result = r.events.find((e) => e.type === "DECLARATION_RESOLVED")!;
    expect(result.result.overallCorrect).toBe(true);
    expect(result.result.correctCount).toBe(6);
    expect(r.state.teamScores).toEqual({ A: 1, B: 0 });
  });

  it("gives the set to the opponents when one card is wrong (§21)", () => {
    const s = setGame();
    const wrong = assignmentsFrom(s, 1).map((a, i) =>
      i === 3 ? { ...a, playerId: a.playerId === "alice" ? "bob" : "alice" } : a,
    );
    const r = ok(reduce(s, { type: "DECLARE", playerId: "alice", setId: 1, assignments: wrong }));
    const result = r.events.find((e) => e.type === "DECLARATION_RESOLVED")!;
    expect(result.result.overallCorrect).toBe(false);
    expect(result.result.correctCount).toBe(5);
    expect(r.state.teamScores).toEqual({ A: 0, B: 1 });
  });

  it("never treats a majority as correct (§61.2)", () => {
    const s = setGame();
    const wrong = assignmentsFrom(s, 1).map((a) => ({ ...a, playerId: "alice" }));
    const r = ok(reduce(s, { type: "DECLARE", playerId: "alice", setId: 1, assignments: wrong }));
    const result = r.events.find((e) => e.type === "DECLARATION_RESOLVED")!;
    expect(result.result.correctCount).toBeLessThan(6);
    expect(result.result.overallCorrect).toBe(false);
  });

  it("reveals the true holders read before the cards are removed (§61.2)", () => {
    const s = setGame();
    const before = getSet(1)!.cardIds.map(
      (id) => s.players.find((p) => p.hand.some((c) => c.id === id))!.id,
    );
    const r = ok(reduce(s, {
      type: "DECLARE", playerId: "alice", setId: 1, assignments: assignmentsFrom(s, 1),
    }));
    const result = r.events.find((e) => e.type === "DECLARATION_RESOLVED")!;
    expect(result.result.reveal.map((row) => row.actualPlayerId)).toEqual(before);
    expect(result.result.reveal.every((row) => row.actualPlayerId !== "")).toBe(true);
  });

  it("orders the reveal by canonical set order, not submission order (§61.2)", () => {
    const s = setGame();
    const shuffledAssignments = [...assignmentsFrom(s, 1)].reverse();
    const r = ok(reduce(s, {
      type: "DECLARE", playerId: "alice", setId: 1, assignments: shuffledAssignments,
    }));
    const result = r.events.find((e) => e.type === "DECLARATION_RESOLVED")!;
    expect(result.result.reveal.map((row) => row.cardId)).toEqual([...getSet(1)!.cardIds]);
  });

  it("removes all six cards from every hand (§51)", () => {
    const s = setGame();
    const r = ok(reduce(s, {
      type: "DECLARE", playerId: "alice", setId: 1, assignments: assignmentsFrom(s, 1),
    }));
    const remaining = r.state.players.flatMap((p) => p.hand.map((c) => c.id));
    for (const id of getSet(1)!.cardIds) expect(remaining).not.toContain(id);
  });

  it("marks a set won on a wrong declaration as stolen (§64.6)", () => {
    const s = setGame();
    const wrong = assignmentsFrom(s, 1).map((a) => ({ ...a, playerId: "alice" }));
    const r = ok(reduce(s, { type: "DECLARE", playerId: "alice", setId: 1, assignments: wrong }));
    expect(r.state.resolvedSets[0]).toMatchObject({ setId: 1, wonByTeamId: "B", stolen: true });
  });

  it("rejects a malformed declaration without costing the set (§51.1)", () => {
    const s = setGame();
    const short = assignmentsFrom(s, 1).slice(0, 5);
    expect(err(reduce(s, { type: "DECLARE", playerId: "alice", setId: 1, assignments: short })))
      .toBe("MALFORMED_DECLARATION");
    expect(s.teamScores).toEqual({ A: 0, B: 0 });
  });

  it("rejects duplicate card assignments", () => {
    const s = setGame();
    const dup = assignmentsFrom(s, 1);
    dup[1] = { ...dup[0]! };
    expect(err(reduce(s, { type: "DECLARE", playerId: "alice", setId: 1, assignments: dup })))
      .toBe("MALFORMED_DECLARATION");
  });

  it("rejects declaring an already resolved set", () => {
    const hands = spreadSet(1, ["alice", "bob", "carol", "dave", "erin", "frank"]);
    hands["alice"] = [...(hands["alice"] ?? []), "H-2"]; // survives the declaration (§62.1)
    const s0 = makeGame(hands);
    const s = ok(reduce(s0, { type: "OPEN_DECLARATION", playerId: "alice", now: 0 })).state;
    const after = ok(reduce(s, {
      type: "DECLARE", playerId: "alice", setId: 1, assignments: assignmentsFrom(s, 1),
    })).state;
    const reopened = ok(reduce(after, {
      type: "OPEN_DECLARATION", playerId: "alice", now: 5,
    })).state;
    expect(err(reduce(reopened, {
      type: "DECLARE", playerId: "alice", setId: 1, assignments: assignmentsFrom(s, 1),
    }))).toBe("SET_RESOLVED");
  });

  it("blocks asking for a card in a resolved set", () => {
    // Alice and Bob keep hearts so the ask survives EMPTY_HAND and TARGET_EMPTY
    // and actually reaches the SET_RESOLVED check (§49 step 9).
    const hands = spreadSet(1, ["alice", "bob", "carol", "dave", "erin", "frank"]);
    hands["alice"] = [...(hands["alice"] ?? []), "H-2"];
    hands["bob"] = [...(hands["bob"] ?? []), "H-5"];
    const s0 = makeGame(hands);
    const s = ok(reduce(s0, { type: "OPEN_DECLARATION", playerId: "alice", now: 0 })).state;
    const after = ok(reduce(s, {
      type: "DECLARE", playerId: "alice", setId: 1, assignments: assignmentsFrom(s, 1),
    })).state;

    const primed: GameState = { ...after, turn: { kind: "PLAYER", playerId: "alice" } };
    expect(err(reduce(primed, {
      type: "ASK", playerId: "alice", targetId: "bob", cardId: "S-2",
    }))).toBe("SET_RESOLVED");
  });

  it("declares a set the team holds none of (§51)", () => {
    // Set 1 entirely in team B's hands; team A declares it correctly anyway.
    const hands = spreadSet(1, ["bob", "dave", "frank"]);
    hands["alice"] = ["H-2"];
    const s0 = makeGame(hands);
    const s = ok(reduce(s0, { type: "OPEN_DECLARATION", playerId: "alice", now: 0 })).state;
    const r = ok(reduce(s, {
      type: "DECLARE", playerId: "alice", setId: 1, assignments: assignmentsFrom(s, 1),
    }));
    expect(r.state.teamScores).toEqual({ A: 1, B: 0 });
  });
});

// ---------------------------------------------------------------------------
// §62.5 — the turn after a declaration
// ---------------------------------------------------------------------------

describe("turn after a declaration (§62.5)", () => {
  it("passes to the declaring team as a whole", () => {
    const hands = spreadSet(1, ["alice", "bob", "carol", "dave", "erin", "frank"]);
    hands["alice"] = [...(hands["alice"] ?? []), "H-2"];
    const s0 = makeGame(hands);
    const s = ok(reduce(s0, { type: "OPEN_DECLARATION", playerId: "alice", now: 0 })).state;
    const r = ok(reduce(s, {
      type: "DECLARE", playerId: "alice", setId: 1, assignments: assignmentsFrom(s, 1),
    }));
    expect(r.state.turn).toEqual({ kind: "TEAM_OPEN", teamId: "A" });
  });

  it("lets any teammate claim the open turn by acting", () => {
    const hands = spreadSet(1, ["alice", "bob", "carol", "dave", "erin", "frank"]);
    hands["carol"] = [...(hands["carol"] ?? []), "H-2"];
    hands["bob"] = [...(hands["bob"] ?? []), "H-5"];
    const s0 = makeGame(hands);
    const s = ok(reduce(s0, { type: "OPEN_DECLARATION", playerId: "alice", now: 0 })).state;
    const declared = ok(reduce(s, {
      type: "DECLARE", playerId: "alice", setId: 1, assignments: assignmentsFrom(s, 1),
    })).state;
    expect(declared.turn).toEqual({ kind: "TEAM_OPEN", teamId: "A" });

    const r = ok(reduce(declared, {
      type: "ASK", playerId: "carol", targetId: "bob", cardId: "H-5",
    }));
    expect(r.state.turn).toEqual({ kind: "PLAYER", playerId: "carol" });
  });

  it("rejects an opponent acting on an open team turn", () => {
    const hands = spreadSet(1, ["alice", "bob", "carol", "dave", "erin", "frank"]);
    hands["alice"] = [...(hands["alice"] ?? []), "H-2"];
    hands["bob"] = [...(hands["bob"] ?? []), "H-5"];
    const s0 = makeGame(hands);
    const s = ok(reduce(s0, { type: "OPEN_DECLARATION", playerId: "alice", now: 0 })).state;
    const declared = ok(reduce(s, {
      type: "DECLARE", playerId: "alice", setId: 1, assignments: assignmentsFrom(s, 1),
    })).state;
    expect(err(reduce(declared, {
      type: "ASK", playerId: "bob", targetId: "alice", cardId: "H-2",
    }))).toBe("TURN_TAKEN");
  });

  it("falls back to the lowest seat with cards when the team turn expires", () => {
    const hands = spreadSet(1, ["alice", "bob", "carol", "dave", "erin", "frank"]);
    hands["carol"] = [...(hands["carol"] ?? []), "H-2"];
    const s0 = makeGame(hands);
    const s = ok(reduce(s0, { type: "OPEN_DECLARATION", playerId: "alice", now: 0 })).state;
    const declared = ok(reduce(s, {
      type: "DECLARE", playerId: "alice", setId: 1, assignments: assignmentsFrom(s, 1),
    })).state;
    const r = ok(reduce(declared, { type: "EXPIRE_TEAM_TURN" }));
    expect(r.state.turn).toEqual({ kind: "PLAYER", playerId: "carol" });
  });
});

// ---------------------------------------------------------------------------
// §62.2 — first to 5 wins
// ---------------------------------------------------------------------------

describe("winning (§62.2)", () => {
  /** Declares `count` sets correctly for team A. */
  function winSets(count: number): GameState {
    const ids: SetId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const hands: Record<string, string[]> = {};
    for (const id of ids.slice(0, count)) {
      for (const [pid, cs] of Object.entries(spreadSet(id, ["bob", "dave", "frank"]))) {
        (hands[pid] ??= []).push(...cs);
      }
    }
    // Alice must still hold a card at every declaration (§62.1), so give her
    // cards from sets that are never declared here.
    hands["alice"] = ["D-9", "C-2", "C-9", "S-8"];
    let state = makeGame(hands);

    for (const id of ids.slice(0, count)) {
      if (state.status === "FINISHED") break;
      state = { ...state, turn: { kind: "PLAYER", playerId: "alice" } };
      state = ok(reduce(state, { type: "OPEN_DECLARATION", playerId: "alice", now: 0 })).state;
      state = ok(reduce(state, {
        type: "DECLARE", playerId: "alice", setId: id, assignments: assignmentsFrom(state, id),
      })).state;
    }
    return state;
  }

  it("keeps playing at 4 sets", () => {
    const s = winSets(4);
    expect(s.teamScores.A).toBe(4);
    expect(s.status).toBe("PLAYING");
    expect(s.winningTeamId).toBeUndefined();
  });

  it("ends immediately at 5 sets, with sets unresolved", () => {
    const s = winSets(5);
    expect(s.teamScores.A).toBe(5);
    expect(s.status).toBe("FINISHED");
    expect(s.winningTeamId).toBe("A");
    expect(s.resolvedSets).toHaveLength(5);
  });

  it("emits GAME_OVER", () => {
    const s = winSets(5);
    expect(s.history.some((e) => e.type === "GAME_OVER")).toBe(true);
  });

  it("rejects actions once finished", () => {
    const s = winSets(5);
    expect(err(reduce(s, { type: "ASK", playerId: "alice", targetId: "bob", cardId: "S-2" })))
      .toBe("GAME_OVER");
  });
});

// ---------------------------------------------------------------------------
// Purity (§57)
// ---------------------------------------------------------------------------

describe("reducer purity (§57)", () => {
  it("does not mutate the input state", () => {
    const s = makeGame({ alice: ["H-2"], bob: ["H-5"] });
    const snapshot = JSON.stringify(s);
    reduce(s, { type: "ASK", playerId: "alice", targetId: "bob", cardId: "H-5" });
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it("produces JSON-serialisable state (§63)", () => {
    const s = makeGame({ alice: ["H-2"], bob: ["H-5"] });
    const r = ok(reduce(s, { type: "ASK", playerId: "alice", targetId: "bob", cardId: "H-5" }));
    expect(() => JSON.parse(JSON.stringify(r.state))).not.toThrow();
  });
});
