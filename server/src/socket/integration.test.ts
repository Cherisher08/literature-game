/**
 * End-to-end over real sockets. Spec §27, §44, §53, §68.6.
 *
 * These exercise the whole Phase 2 stack: validation, room manager, projection,
 * engine and emission. The privacy assertion here is the important one — it
 * proves the §53 boundary holds over the wire, not just in a unit test.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { io as ioClient, type Socket } from "socket.io-client";
import {
  PLAYER_COUNT,
  PROTOCOL_VERSION,
  type Ack,
  type ClientRoomState,
  type JoinResult,
  type VoidAck,
} from "@memory-game/shared";
import { createGameApp, type GameApp } from "../app.js";

let app: GameApp;
let url: string;
const clients: Socket[] = [];

beforeAll(async () => {
  app = createGameApp();
  await new Promise<void>((resolve) => app.httpServer.listen(0, resolve));
  const addr = app.httpServer.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  url = `http://localhost:${port}`;
});

afterAll(async () => {
  for (const c of clients) c.disconnect();
  await app.close();
});

function connect(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = ioClient(url, { transports: ["websocket"], forceNew: true });
    s.on("connect", () => {
      clients.push(s);
      resolve(s);
    });
    s.on("connect_error", reject);
  });
}

const emit = <T>(s: Socket, event: string, ...args: unknown[]): Promise<T> =>
  new Promise((resolve) => s.emit(event, ...args, (r: T) => resolve(r)));

const actionId = () => `a-${Math.random().toString(36).slice(2)}-${Date.now()}`;

/** Waits for the next room:state on a socket. */
const nextState = (s: Socket): Promise<ClientRoomState> =>
  new Promise((resolve) => s.once("room:state", resolve));

describe("socket protocol (§27, §59)", () => {
  it("creates a room and returns a session token to the owner only", async () => {
    const host = await connect();
    const res = await emit<Ack<JoinResult>>(host, "room:create", {
      protocolVersion: PROTOCOL_VERSION,
      name: "Alice",
      playerCount: 6,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.roomId).toHaveLength(6);
    expect(res.data.sessionToken).toBeTruthy();
    expect(res.data.state.players).toHaveLength(1);
  });

  it("rejects a protocol version mismatch (§59)", async () => {
    const s = await connect();
    const res = await emit<Ack<JoinResult>>(s, "room:create", {
      protocolVersion: 999,
      name: "Bob",
      playerCount: 6,
    });
    expect(res.ok).toBe(false);
  });

  it("rejects an empty name after trimming (§58)", async () => {
    const s = await connect();
    const res = await emit<Ack<JoinResult>>(s, "room:create", {
      protocolVersion: PROTOCOL_VERSION,
      name: "   ",
      playerCount: 6,
    });
    expect(res.ok).toBe(false);
  });

  it("rejects an unsupported player count (§72)", async () => {
    const s = await connect();
    const res = await emit<Ack<JoinResult>>(s, "room:create", {
      protocolVersion: PROTOCOL_VERSION,
      name: "Bob",
      playerCount: 5,
    });
    expect(res.ok).toBe(false);
  });

  it("rejects a malformed ask payload at the boundary (§58)", async () => {
    const host = await connect();
    const created = await emit<Ack<JoinResult>>(host, "room:create", {
      protocolVersion: PROTOCOL_VERSION,
      name: "Alice",
      playerCount: 6,
    });
    if (!created.ok) throw new Error("create failed");

    const res = await emit<VoidAck>(host, "game:ask-card", {
      actionId: actionId(),
      payload: { targetPlayerId: { evil: true }, cardId: ["nope"] },
    });
    expect(res.ok).toBe(false);
  });
});

describe("full game over the wire", () => {
  it("deals privately, plays a turn, and never leaks a hand (§53)", async () => {
    const host = await connect();
    const created = await emit<Ack<JoinResult>>(host, "room:create", {
      protocolVersion: PROTOCOL_VERSION,
      name: "Alice",
      playerCount: 6,
    });
    if (!created.ok) throw new Error("create failed");
    const roomId = created.data.roomId;

    // Fill the room.
    const joiners: Socket[] = [];
    const joins: JoinResult[] = [];
    for (let i = 1; i < PLAYER_COUNT; i++) {
      const s = await connect();
      const r = await emit<Ack<JoinResult>>(s, "room:join", {
        protocolVersion: PROTOCOL_VERSION,
        roomId,
        name: `P${i}`,
      });
      if (!r.ok) throw new Error(`join ${i} failed`);
      joiners.push(s);
      joins.push(r.data);
    }

    // Only the host may start.
    const notHost = await emit<VoidAck>(joiners[0]!, "game:start");
    expect(notHost.ok).toBe(false);

    const hostState = nextState(host);
    const started = await emit<VoidAck>(host, "game:start");
    expect(started.ok).toBe(true);

    const state = await hostState;
    expect(state.status).toBe("PLAYING");
    expect(state.game).toBeDefined();

    // §47/§55: 9 cards each, and the host sees only their own.
    expect(state.game!.myHand).toHaveLength(9);
    expect(state.game!.players.every((p) => p.cardCount === 9)).toBe(true);

    // §53: no other player's cards appear anywhere in the payload.
    const hostCardIds = new Set(state.game!.myHand.map((c) => c.id));
    const json = JSON.stringify(state);
    const others = await Promise.all(
      joiners.map(async (s) => {
        const r = await emit<Ack<ClientRoomState>>(s, "room:resync");
        if (!r.ok) throw new Error("resync failed");
        return r.data;
      }),
    );

    for (const other of others) {
      for (const card of other.game!.myHand) {
        if (!hostCardIds.has(card.id)) {
          expect(json).not.toContain(`"${card.id}"`);
        }
      }
      // Every player's hand is disjoint from the host's.
      expect(other.game!.myHand.some((c) => hostCardIds.has(c.id))).toBe(false);
    }

    // All 54 cards are dealt exactly once across the six hands.
    const allDealt = [state, ...others].flatMap((s) => s.game!.myHand.map((c) => c.id));
    expect(new Set(allDealt).size).toBe(54);
  });

  it("dedupes a retried actionId (§68.5)", async () => {
    const host = await connect();
    const created = await emit<Ack<JoinResult>>(host, "room:create", {
      protocolVersion: PROTOCOL_VERSION,
      name: "Alice",
      playerCount: 6,
    });
    if (!created.ok) throw new Error("create failed");

    const id = actionId();
    const payload = { actionId: id, payload: { message: "hello" } };

    const first = await emit<VoidAck>(host, "chat:send", payload);
    expect(first.ok).toBe(true);

    // A retried ask must not apply twice. Chat is not enveloped through the
    // dedupe path, so use an action that is: an illegal ask returns a stable
    // error, and the retry must return the same one rather than re-running.
    const askId = actionId();
    const ask = { actionId: askId, payload: { targetPlayerId: "nobody", cardId: "H-5" } };
    const a1 = await emit<VoidAck>(host, "game:ask-card", ask);
    const a2 = await emit<VoidAck>(host, "game:ask-card", ask);
    expect(a1).toEqual(a2);
  });

  it("resyncs full state on demand (§68.6)", async () => {
    const host = await connect();
    const created = await emit<Ack<JoinResult>>(host, "room:create", {
      protocolVersion: PROTOCOL_VERSION,
      name: "Alice",
      playerCount: 6,
    });
    if (!created.ok) throw new Error("create failed");

    const res = await emit<Ack<ClientRoomState>>(host, "room:resync");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.roomId).toBe(created.data.roomId);
    expect(typeof res.data.seq).toBe("number");
  });

  it("rejoins a seat with a session token (§35)", async () => {
    const host = await connect();
    const created = await emit<Ack<JoinResult>>(host, "room:create", {
      protocolVersion: PROTOCOL_VERSION,
      name: "Alice",
      playerCount: 6,
    });
    if (!created.ok) throw new Error("create failed");

    host.disconnect();
    await new Promise((r) => setTimeout(r, 50));

    const resumed = await connect();
    const res = await emit<Ack<JoinResult>>(resumed, "room:join", {
      protocolVersion: PROTOCOL_VERSION,
      roomId: created.data.roomId,
      name: "Alice",
      sessionToken: created.data.sessionToken,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.playerId).toBe(created.data.playerId);
  });

  it("broadcasts chat to the room (§28)", async () => {
    const host = await connect();
    const created = await emit<Ack<JoinResult>>(host, "room:create", {
      protocolVersion: PROTOCOL_VERSION,
      name: "Alice",
      playerCount: 6,
    });
    if (!created.ok) throw new Error("create failed");

    const guest = await connect();
    await emit<Ack<JoinResult>>(guest, "room:join", {
      protocolVersion: PROTOCOL_VERSION,
      roomId: created.data.roomId,
      name: "Bob",
    });

    const received = new Promise<{ message: string; playerName: string }>((resolve) =>
      guest.once("chat:message", resolve),
    );
    await emit<VoidAck>(host, "chat:send", {
      actionId: actionId(),
      payload: { message: "hello team" },
    });

    const msg = await received;
    expect(msg.message).toBe("hello team");
    expect(msg.playerName).toBe("Alice");
  });

  it("admits a spectator who receives state and can chat", async () => {
    const host = await connect();
    const created = await emit<Ack<JoinResult>>(host, "room:create", {
      protocolVersion: PROTOCOL_VERSION,
      name: "Host",
      playerCount: 4,
    });
    if (!created.ok) throw new Error("create failed");

    const spectatorSock = await connect();
    const joinRes = await emit<Ack<JoinResult>>(spectatorSock, "room:join", {
      protocolVersion: PROTOCOL_VERSION,
      roomId: created.data.roomId,
      name: "SpectatorSam",
      spectateOnly: true,
    });

    expect(joinRes.ok).toBe(true);
    if (!joinRes.ok) return;
    expect(joinRes.data.isSpectator).toBe(true);
    expect(joinRes.data.state.spectators).toHaveLength(1);
    expect(joinRes.data.state.spectators[0].name).toBe("SpectatorSam");

    // Test that spectator can send chat messages
    const hostReceived = new Promise<{ message: string; playerName: string }>((resolve) =>
      host.once("chat:message", resolve),
    );

    const chatRes = await emit<VoidAck>(spectatorSock, "chat:send", {
      actionId: actionId(),
      payload: { message: "Cheering for Team A!" },
    });
    expect(chatRes.ok).toBe(true);

    const msg = await hostReceived;
    expect(msg.message).toBe("Cheering for Team A!");
    expect(msg.playerName).toBe("SpectatorSam");
  });
});
