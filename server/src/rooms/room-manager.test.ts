import { afterEach, describe, expect, it, vi } from "vitest";
import { PLAYER_COUNT, ROOM_CODE_LENGTH } from "@memory-game/shared";
import { RoomManager } from "./room-manager.js";

const mgr = () => new RoomManager();

afterEach(() => vi.useRealTimers());

describe("room codes (§58)", () => {
  it("generates codes of the right length from the unambiguous alphabet", () => {
    const m = mgr();
    for (let i = 0; i < 30; i++) {
      const { room } = m.createRoom("Host", `s${i}`);
      expect(room.id).toHaveLength(ROOM_CODE_LENGTH);
      expect(room.id).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/);
      expect(room.id).not.toMatch(/[01OIL]/);
    }
  });

  it("does not collide", () => {
    const m = mgr();
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) codes.add(m.createRoom("Host", `s${i}`).room.id);
    expect(codes.size).toBe(100);
  });
});

describe("join and capacity (§58)", () => {
  it("seats players 1..6 and rejects the seventh", () => {
    const m = mgr();
    const { room } = m.createRoom("Host", "s0");
    for (let i = 1; i < PLAYER_COUNT; i++) {
      const r = m.joinRoom(room.id, `P${i}`, `s${i}`);
      expect("error" in r).toBe(false);
    }
    expect(room.players.map((p) => p.seatPosition)).toEqual([1, 2, 3, 4, 5, 6]);

    const seventh = m.joinRoom(room.id, "P6", "s6");
    expect(seventh).toEqual({ error: "ROOM_FULL" });
  });

  it("rejects joining an unknown room", () => {
    expect(mgr().joinRoom("ZZZZZZ", "P", "s")).toEqual({ error: "ROOM_NOT_FOUND" });
  });

  it("rejects joining once the game has started", () => {
    const m = mgr();
    const { room } = m.createRoom("Host", "s0");
    room.status = "PLAYING";
    expect(m.joinRoom(room.id, "P", "s1")).toEqual({ error: "GAME_ALREADY_STARTED" });
  });

  it("gives every player a distinct session token", () => {
    const m = mgr();
    const { room, player } = m.createRoom("Host", "s0");
    const second = m.joinRoom(room.id, "P1", "s1");
    if ("error" in second) throw new Error("join failed");
    expect(player.sessionToken).not.toBe(second.player.sessionToken);
    expect(player.sessionToken.length).toBeGreaterThan(20);
  });
});

describe("disconnect and reconnect (§34-35)", () => {
  it("keeps the seat on disconnect", () => {
    const m = mgr();
    const { room, player } = m.createRoom("Host", "s0");
    m.markDisconnected(room.id, player.id);
    expect(room.players).toHaveLength(1);
    expect(room.players[0]!.connected).toBe(false);
  });

  it("resumes a seat with a valid token", () => {
    const m = mgr();
    const { room, player } = m.createRoom("Host", "s0");
    m.markDisconnected(room.id, player.id);

    const r = m.reconnect(room.id, player.sessionToken, "s1");
    if ("error" in r) throw new Error(r.error);
    expect(r.player.connected).toBe(true);
    expect(r.player.socketId).toBe("s1");
  });

  it("rejects an invalid token", () => {
    const m = mgr();
    const { room } = m.createRoom("Host", "s0");
    expect(m.reconnect(room.id, "not-a-token", "s1")).toEqual({ error: "INVALID_SESSION" });
  });
});

describe("host migration (§59.1)", () => {
  it("moves the host to the lowest connected seat", () => {
    const m = mgr();
    const { room, player: host } = m.createRoom("Host", "s0");
    const second = m.joinRoom(room.id, "P1", "s1");
    const third = m.joinRoom(room.id, "P2", "s2");
    if ("error" in second || "error" in third) throw new Error("join failed");

    m.markDisconnected(room.id, host.id);
    expect(room.hostId).toBe(second.player.id);
  });

  it("does not hand the role back when the original host returns", () => {
    const m = mgr();
    const { room, player: host } = m.createRoom("Host", "s0");
    const second = m.joinRoom(room.id, "P1", "s1");
    if ("error" in second) throw new Error("join failed");

    m.markDisconnected(room.id, host.id);
    const newHost = room.hostId;
    m.reconnect(room.id, host.sessionToken, "s9");
    expect(room.hostId).toBe(newHost);
  });
});

describe("room lifecycle (§54)", () => {
  it("deletes the room when the last player leaves explicitly", () => {
    const m = mgr();
    const { room, player } = m.createRoom("Host", "s0");
    m.removePlayer(room.id, player.id);
    expect(m.get(room.id)).toBeUndefined();
  });

  it("does not delete immediately when everyone disconnects", () => {
    vi.useFakeTimers();
    const m = mgr();
    const { room, player } = m.createRoom("Host", "s0");
    m.markDisconnected(room.id, player.id);
    expect(m.get(room.id)).toBeDefined();
  });

  it("closes an all-disconnected room after the empty timeout", () => {
    vi.useFakeTimers();
    const m = mgr();
    const { room, player } = m.createRoom("Host", "s0");
    m.markDisconnected(room.id, player.id);

    vi.advanceTimersByTime(120_000 + 10);
    expect(m.get(room.id)).toBeUndefined();
  });

  it("cancels the close when someone reconnects in time", () => {
    vi.useFakeTimers();
    const m = mgr();
    const { room, player } = m.createRoom("Host", "s0");
    m.markDisconnected(room.id, player.id);

    vi.advanceTimersByTime(60_000);
    m.reconnect(room.id, player.sessionToken, "s1");
    vi.advanceTimersByTime(120_000);

    expect(m.get(room.id)).toBeDefined();
  });

  it("sweeps idle rooms (§54)", () => {
    const m = mgr();
    const { room } = m.createRoom("Host", "s0");
    const later = Date.now() + 3 * 60 * 60 * 1000;
    expect(m.sweep(later)).toContain(room.id);
    expect(m.get(room.id)).toBeUndefined();
  });

  it("sweeps rooms past max lifetime even when active", () => {
    const m = mgr();
    const { room } = m.createRoom("Host", "s0");
    const later = Date.now() + 7 * 60 * 60 * 1000;
    room.lastActivityAt = later; // still busy, but too old
    expect(m.sweep(later)).toContain(room.id);
  });

  it("keeps a fresh room", () => {
    const m = mgr();
    const { room } = m.createRoom("Host", "s0");
    expect(m.sweep(Date.now())).toEqual([]);
    expect(m.get(room.id)).toBeDefined();
  });

  it("notifies on close", () => {
    const closed: Array<[string, string]> = [];
    const m = new RoomManager({ onRoomClosed: (id, reason) => closed.push([id, reason]) });
    const { room, player } = m.createRoom("Host", "s0");
    m.removePlayer(room.id, player.id);
    expect(closed).toEqual([[room.id, "EMPTY"]]);
  });
});

describe("lobby team selection (§71)", () => {
  const fill = (m: RoomManager) => {
    const { room, player } = m.createRoom("Host", "s0");
    const players = [player];
    for (let i = 1; i < PLAYER_COUNT; i++) {
      const r = m.joinRoom(room.id, `P${i}`, `s${i}`);
      if ("error" in r) throw new Error(r.error);
      players.push(r.player);
    }
    return { room, players };
  };

  it("lets a player pick a team", () => {
    const m = mgr();
    const { room, players } = fill(m);
    const r = m.selectTeam(room.id, players[0]!.id, "B");
    expect("error" in r).toBe(false);
    expect(players[0]!.teamId).toBe("B");
  });

  it("lets a player switch teams", () => {
    const m = mgr();
    const { room, players } = fill(m);
    m.selectTeam(room.id, players[0]!.id, "A");
    m.selectTeam(room.id, players[0]!.id, "B");
    expect(players[0]!.teamId).toBe("B");
  });

  it("caps a team at three", () => {
    const m = mgr();
    const { room, players } = fill(m);
    for (let i = 0; i < 3; i++) m.selectTeam(room.id, players[i]!.id, "A");
    expect(m.selectTeam(room.id, players[3]!.id, "A")).toEqual({ error: "TEAM_FULL" });
  });

  it("treats re-picking the same team as a no-op", () => {
    const m = mgr();
    const { room, players } = fill(m);
    for (let i = 0; i < 3; i++) m.selectTeam(room.id, players[i]!.id, "A");
    expect("error" in m.selectTeam(room.id, players[0]!.id, "A")).toBe(false);
  });

  it("steps a player out to unassigned (§71.5)", () => {
    const m = mgr();
    const { room, players } = fill(m);
    m.selectTeam(room.id, players[0]!.id, "A");
    const r = m.clearTeam(room.id, players[0]!.id);
    expect("error" in r).toBe(false);
    expect(players[0]!.teamId).toBeUndefined();
  });

  it("lets two full teams swap via the unassigned pool (§71.5)", () => {
    const m = mgr();
    const { room, players } = fill(m);
    // 3v3 at six players: both sides full, nobody can move directly.
    for (const i of [0, 1, 2]) m.selectTeam(room.id, players[i]!.id, "A");
    for (const i of [3, 4, 5]) m.selectTeam(room.id, players[i]!.id, "B");
    expect(m.selectTeam(room.id, players[0]!.id, "B")).toEqual({ error: "TEAM_FULL" });

    // Step out, freeing a slot, then swap.
    m.clearTeam(room.id, players[0]!.id);
    expect("error" in m.selectTeam(room.id, players[3]!.id, "A")).toBe(false);
    expect("error" in m.selectTeam(room.id, players[0]!.id, "B")).toBe(false);

    expect(players[0]!.teamId).toBe("B");
    expect(players[3]!.teamId).toBe("A");
    expect(room.players.filter((p) => p.teamId === "A")).toHaveLength(3);
    expect(room.players.filter((p) => p.teamId === "B")).toHaveLength(3);
  });

  it("refuses stepping out once the game has started (§6)", () => {
    const m = mgr();
    const { room, players } = fill(m);
    room.status = "PLAYING";
    expect(m.clearTeam(room.id, players[0]!.id)).toEqual({ error: "NOT_IN_LOBBY" });
  });

  it("rejects changing teams once the game has started (§6)", () => {
    const m = mgr();
    const { room, players } = fill(m);
    room.status = "PLAYING";
    expect(m.selectTeam(room.id, players[0]!.id, "A")).toEqual({ error: "NOT_IN_LOBBY" });
  });

  it("seats chosen teams alternately at start (§6, §71)", () => {
    const m = mgr();
    const { room, players } = fill(m);
    // Deliberately not in join order: 0,2,4 pick B and 1,3,5 pick A.
    for (const i of [0, 2, 4]) m.selectTeam(room.id, players[i]!.id, "B");
    for (const i of [1, 3, 5]) m.selectTeam(room.id, players[i]!.id, "A");

    expect(m.assignSeatsForStart(room)).toEqual({ ok: true });
    expect(room.players.map((p) => p.seatPosition)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(room.players.map((p) => p.teamId)).toEqual(["A", "B", "A", "B", "A", "B"]);
    expect(room.players.filter((p) => p.teamId === "A").map((p) => p.name))
      .toEqual(["P1", "P3", "P5"]);
  });

  it("auto-fills unassigned players and still balances", () => {
    const m = mgr();
    const { room, players } = fill(m);
    m.selectTeam(room.id, players[0]!.id, "B");

    expect(m.assignSeatsForStart(room)).toEqual({ ok: true });
    expect(room.players.filter((p) => p.teamId === "A")).toHaveLength(3);
    expect(room.players.filter((p) => p.teamId === "B")).toHaveLength(3);
    expect(room.players.map((p) => p.teamId)).toEqual(["A", "B", "A", "B", "A", "B"]);
  });

  it("starts fine when nobody picks a team", () => {
    const m = mgr();
    const { room } = fill(m);
    expect(m.assignSeatsForStart(room)).toEqual({ ok: true });
    expect(room.players.map((p) => p.teamId)).toEqual(["A", "B", "A", "B", "A", "B"]);
  });

  it("rejects an unbalanced table", () => {
    const m = mgr();
    const { room, players } = fill(m);
    for (let i = 0; i < 3; i++) m.selectTeam(room.id, players[i]!.id, "A");
    // Only five players remain seatable into a 3/3 split if one leaves.
    m.removePlayer(room.id, players[5]!.id);
    expect(m.assignSeatsForStart(room)).toEqual({ error: "TEAMS_UNBALANCED" });
  });
});

describe("chat (§28, §58)", () => {
  it("assigns id, author and timestamp on the server", () => {
    const m = mgr();
    const { room, player } = m.createRoom("Host", "s0");
    const msg = m.addChatMessage(room, player.id, player.name, "hello");
    expect(msg.playerId).toBe(player.id);
    expect(msg.playerName).toBe("Host");
    expect(msg.id).toBeTruthy();
    expect(msg.timestamp).toBeGreaterThan(0);
  });

  it("caps history so a long session cannot grow unbounded", () => {
    const m = mgr();
    const { room, player } = m.createRoom("Host", "s0");
    for (let i = 0; i < 350; i++) m.addChatMessage(room, player.id, player.name, `m${i}`);
    expect(room.chatMessages).toHaveLength(300);
    expect(room.chatMessages[299]!.message).toBe("m349");
  });
});

describe("sequence numbers (§68.6)", () => {
  it("increments monotonically", () => {
    const m = mgr();
    const { room } = m.createRoom("Host", "s0");
    expect(m.nextSeq(room)).toBe(1);
    expect(m.nextSeq(room)).toBe(2);
    expect(room.seq).toBe(2);
  });
});
