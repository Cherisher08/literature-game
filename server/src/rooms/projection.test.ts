/**
 * The §53 anti-cheat boundary. These are the tests that must never be deleted:
 * a regression here silently hands every hand to every client.
 */

import { describe, expect, it } from "vitest";
import { getCard, type GameState } from "@memory-game/shared";
import { createGameState, type NewGamePlayer } from "../game/engine.js";
import { projectGameFor, projectRoomFor } from "./projection.js";
import type { GameRoom } from "./types.js";

const SEATS = ["alice", "bob", "carol", "dave", "erin", "frank"];

function makeRoom(): { room: GameRoom; game: GameState } {
  const players: NewGamePlayer[] = SEATS.map((id, i) => ({
    id,
    name: id[0]!.toUpperCase() + id.slice(1),
    seatPosition: i + 1,
    hand: [getCard(["S-2", "S-3", "S-4", "S-5", "S-6", "S-7"][i]!)!],
  }));
  const game = createGameState(players, "alice");

  const room: GameRoom = {
    id: "ABC123",
    hostId: "alice",
    status: "PLAYING",
    playerCount: 6,
    players: SEATS.map((id, i) => ({
      id,
      name: id,
      seatPosition: i + 1,
      connected: true,
      sessionToken: `token-${id}`,
      socketId: `sock-${id}`,
    })),
    game,
    chatMessages: [],
    createdAt: 0,
    lastActivityAt: 0,
    seq: 3,
  };

  return { room, game };
}

describe("card privacy (§53)", () => {
  it("gives the recipient their own hand", () => {
    const { room, game } = makeRoom();
    const view = projectGameFor(room, game, "alice");
    expect(view.myHand.map((c) => c.id)).toEqual(["S-2"]);
    expect(view.myPlayerId).toBe("alice");
  });

  it("never leaks another player's cards anywhere in the payload", () => {
    const { room } = makeRoom();
    const view = projectRoomFor(room, "alice");
    const json = JSON.stringify(view);

    // Every other player's card must be absent from the entire serialised payload.
    for (const id of ["S-3", "S-4", "S-5", "S-6", "S-7"]) {
      expect(json).not.toContain(id);
    }
    // The recipient's own card is present.
    expect(json).toContain("S-2");
  });

  it("exposes only counts for other players", () => {
    const { room, game } = makeRoom();
    const view = projectGameFor(room, game, "alice");
    for (const p of view.players) {
      expect(p.cardCount).toBe(1);
      expect(Object.keys(p)).not.toContain("hand");
      expect(Object.keys(p)).not.toContain("cards");
    }
  });

  it("never includes session tokens (§58)", () => {
    const { room } = makeRoom();
    const json = JSON.stringify(projectRoomFor(room, "alice"));
    for (const id of SEATS) {
      expect(json).not.toContain(`token-${id}`);
    }
  });

  it("gives a spectator an empty hand, not someone else's", () => {
    const { room, game } = makeRoom();
    const emptied: GameState = {
      ...game,
      players: game.players.map((p) => (p.id === "alice" ? { ...p, hand: [] } : p)),
    };
    const view = projectGameFor(room, emptied, "alice");
    expect(view.myHand).toEqual([]);
    expect(view.players.find((p) => p.id === "alice")!.spectating).toBe(true);
  });

  it("gives an unknown player id an empty hand rather than throwing", () => {
    const { room, game } = makeRoom();
    const view = projectGameFor(room, game, "nobody");
    expect(view.myHand).toEqual([]);
  });

  it("derives spectating from the hand, never from a stored flag (§62.1)", () => {
    const { room, game } = makeRoom();
    const view = projectGameFor(room, game, "alice");
    expect(view.players.every((p) => p.spectating === false)).toBe(true);
  });

  it("copies the hand so callers cannot mutate engine state", () => {
    const { room, game } = makeRoom();
    const view = projectGameFor(room, game, "alice");
    view.myHand.pop();
    expect(game.players.find((p) => p.id === "alice")!.hand).toHaveLength(1);
  });
});

describe("room projection", () => {
  it("carries the room seq for gap detection (§68.6)", () => {
    const { room } = makeRoom();
    expect(projectRoomFor(room, "alice").seq).toBe(3);
  });

  it("omits the game in the lobby", () => {
    const { room } = makeRoom();
    const lobby: GameRoom = { ...room, status: "LOBBY" };
    delete lobby.game;
    const view = projectRoomFor(lobby, "alice");
    expect(view.game).toBeUndefined();
    expect(view.players).toHaveLength(6);
  });

  it("shows no team in the lobby until a player picks one (§71)", () => {
    const { room } = makeRoom();
    const lobby: GameRoom = { ...room, status: "LOBBY" };
    delete lobby.game;
    expect(projectRoomFor(lobby, "alice").players.map((p) => p.teamId))
      .toEqual([null, null, null, null, null, null]);
  });

  it("reflects a chosen team in the lobby (§71)", () => {
    const { room } = makeRoom();
    const lobby: GameRoom = { ...room, status: "LOBBY" };
    delete lobby.game;
    lobby.players[0]!.teamId = "B";
    expect(projectRoomFor(lobby, "alice").players[0]!.teamId).toBe("B");
  });
});
