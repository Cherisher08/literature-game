/**
 * Socket layer. Spec §27, §44, §53, §59, §68.6.
 *
 * This is the only place that translates engine events into emissions. The
 * engine never emits (§57), and actionId/seq are handled here so the reducer
 * never learns a message was retried (§68.6).
 */

import type { Server, Socket } from "socket.io";
import {
  ERROR_MESSAGE,
  type AckFailure,
  type ClientToServerEvents,
  type ErrorCode,
  type GameEvent,
  type ServerToClientEvents,
  type SocketData,
  type VoidAck,
} from "@memory-game/shared";

import { createGameState, reduce, type NewGamePlayer } from "../game/engine.js";
import { deal } from "../game/shuffle.js";
import { projectRoomFor } from "../rooms/projection.js";
import type { RoomManager } from "../rooms/room-manager.js";
import type { GameRoom } from "../rooms/types.js";
import { BotRunner } from "../bots/runner.js";
import { isVoiceConfigured, mintVoiceToken } from "../voice/livekit.js";
import { RateLimiter, dedupeGet, dedupeSet } from "./rate-limit.js";
import {
  askCardSchema,
  chatSendSchema,
  createRoomSchema,
  declareSchema,
  emptyEnvelopeSchema,
  addBotSchema,
  joinRoomSchema,
  parse,
  removeBotSchema,
  selectTeamSchema,
  voiceStateSchema,
} from "./validation.js";

export type GameServer = Server<ClientToServerEvents, ServerToClientEvents, never, SocketData>;
export type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, never, SocketData>;

const deny = (error: ErrorCode): AckFailure => ({
  ok: false,
  error,
  message: ERROR_MESSAGE[error],
});

export function registerHandlers(io: GameServer, rooms: RoomManager): void {
  // §58: the turn check already limits actions, but a reconnect loop should not
  // be free. Chat is limited separately and more tightly.
  const actionLimiter = new RateLimiter(20, 5_000);
  const chatLimiter = new RateLimiter(5, 5_000);
  const joinLimiter = new RateLimiter(10, 60_000);

  /**
   * §53: the only path room state takes to a client. Each socket receives its
   * own projection, so no payload ever carries another player's hand.
   */
  function broadcastState(room: GameRoom): void {
    for (const player of room.players) {
      if (!player.socketId) continue;
      io.to(player.socketId).emit("room:state", projectRoomFor(room, player.id));
    }
  }

  function broadcastEvents(room: GameRoom, events: GameEvent[]): void {
    for (const event of events) {
      const seq = rooms.nextSeq(room);
      io.to(room.id).emit("game:event", event, seq);
    }
    broadcastState(room);
    // §73: a bot may now be on turn. Safe to call after every mutation.
    bots.schedule(room);
  }

  // §73: bots publish through exactly the same path a human move does.
  const bots = new BotRunner(rooms, {
    publish: (room, events) => {
      for (const event of events) {
        const seq = rooms.nextSeq(room);
        io.to(room.id).emit("game:event", event, seq);
      }
      broadcastState(room);
    },
  });

  function currentRoom(socket: GameSocket): GameRoom | undefined {
    const { roomId } = socket.data;
    return roomId ? rooms.get(roomId) : undefined;
  }

  /**
   * Wraps an action handler with §58 rate limiting and §68.5 dedupe, so a
   * retried actionId returns the original result rather than applying twice.
   */
  function withEnvelope(
    socket: GameSocket,
    actionId: string,
    ack: (r: VoidAck) => void,
    run: (room: GameRoom, playerId: string) => VoidAck,
  ): void {
    if (!actionLimiter.allow(socket.id)) return ack(deny("RATE_LIMITED"));

    const room = currentRoom(socket);
    const playerId = socket.data.playerId;
    if (!room || !playerId) return ack(deny("ROOM_NOT_FOUND"));

    const cache = rooms.runtime(room.id).dedupe;
    const cached = dedupeGet(cache, actionId);
    if (cached) {
      return ack(
        cached.ok ? { ok: true } : deny((cached.error ?? "RATE_LIMITED") as ErrorCode),
      );
    }

    const result = run(room, playerId);
    dedupeSet(cache, actionId, {
      ok: result.ok,
      ...(result.ok ? {} : { error: result.error }),
    });
    ack(result);
  }

  io.on("connection", (socket: GameSocket) => {
    // -----------------------------------------------------------------------
    // Room lifecycle
    // -----------------------------------------------------------------------

    socket.on("room:create", (raw, ack) => {
      if (!joinLimiter.allow(socket.id)) return ack(deny("RATE_LIMITED"));
      const input = parse(createRoomSchema, raw);
      if (!input) return ack(deny("INVALID_SESSION"));

      const { room, player } = rooms.createRoom(input.name, socket.id, input.playerCount);
      socket.data.roomId = room.id;
      socket.data.playerId = player.id;
      void socket.join(room.id);

      ack({
        ok: true,
        data: {
          roomId: room.id,
          playerId: player.id,
          // §58: sent only to the owning socket, never in a broadcast.
          sessionToken: player.sessionToken,
          state: projectRoomFor(room, player.id),
        },
      });
    });

    socket.on("room:join", (raw, ack) => {
      if (!joinLimiter.allow(socket.id)) return ack(deny("RATE_LIMITED"));
      const input = parse(joinRoomSchema, raw);
      if (!input) return ack(deny("ROOM_NOT_FOUND"));

      // §35: a token resumes an existing seat, including mid-game.
      const result = input.sessionToken
        ? rooms.reconnect(input.roomId, input.sessionToken, socket.id)
        : rooms.joinRoom(input.roomId, input.name, socket.id);

      if ("error" in result) return ack(deny(result.error));

      const { room, player } = result;
      socket.data.roomId = room.id;
      socket.data.playerId = player.id;
      void socket.join(room.id);

      ack({
        ok: true,
        data: {
          roomId: room.id,
          playerId: player.id,
          sessionToken: player.sessionToken,
          state: projectRoomFor(room, player.id),
        },
      });

      socket.to(room.id).emit(
        "room:player-joined",
        projectRoomFor(room, player.id).players.find((p) => p.id === player.id)!,
      );
      broadcastState(room);
    });

    socket.on("room:leave", (ack) => {
      const room = currentRoom(socket);
      const playerId = socket.data.playerId;
      if (!room || !playerId) return ack(deny("ROOM_NOT_FOUND"));

      const roomId = room.id;
      const previousHost = room.hostId;
      const updated = rooms.removePlayer(roomId, playerId);
      void socket.leave(roomId);
      delete socket.data.roomId;
      delete socket.data.playerId;

      if (updated) {
        io.to(roomId).emit("room:player-left", playerId);
        if (updated.hostId !== previousHost) {
          io.to(roomId).emit("room:host-changed", updated.hostId);
        }
        broadcastState(updated);
      }
      ack({ ok: true });
    });

    /** §73: host-only bot management, lobby only. */
    socket.on("room:add-bot", (raw, ack) => {
      if (!actionLimiter.allow(socket.id)) return ack(deny("RATE_LIMITED"));
      const input = parse(addBotSchema, raw);
      if (!input) return ack(deny("NOT_IN_LOBBY"));

      const room = currentRoom(socket);
      const playerId = socket.data.playerId;
      if (!room || !playerId) return ack(deny("ROOM_NOT_FOUND"));
      if (room.hostId !== playerId) return ack(deny("NOT_HOST"));

      const result = rooms.addBot(room.id, input.difficulty, input.teamId);
      if ("error" in result) return ack(deny(result.error));

      broadcastState(result.room);
      ack({ ok: true });
    });

    socket.on("room:remove-bot", (raw, ack) => {
      if (!actionLimiter.allow(socket.id)) return ack(deny("RATE_LIMITED"));
      const input = parse(removeBotSchema, raw);
      if (!input) return ack(deny("INVALID_TARGET"));

      const room = currentRoom(socket);
      const playerId = socket.data.playerId;
      if (!room || !playerId) return ack(deny("ROOM_NOT_FOUND"));
      if (room.hostId !== playerId) return ack(deny("NOT_HOST"));

      const result = rooms.removeBot(room.id, input.playerId);
      if ("error" in result) return ack(deny(result.error));

      broadcastState(result);
      ack({ ok: true });
    });

    /** §68.5: full-state recovery after a detected gap. */
    socket.on("room:resync", (ack) => {
      const room = currentRoom(socket);
      const playerId = socket.data.playerId;
      if (!room || !playerId) return ack(deny("ROOM_NOT_FOUND"));
      ack({ ok: true, data: projectRoomFor(room, playerId) });
    });

    /** §71: pick a team in the lobby. */
    socket.on("room:select-team", (raw, ack) => {
      if (!actionLimiter.allow(socket.id)) return ack(deny("RATE_LIMITED"));
      const input = parse(selectTeamSchema, raw);
      if (!input) return ack(deny("NOT_IN_LOBBY"));

      const room = currentRoom(socket);
      const playerId = socket.data.playerId;
      if (!room || !playerId) return ack(deny("ROOM_NOT_FOUND"));

      const result =
        input.teamId === null
          ? rooms.clearTeam(room.id, playerId)
          : rooms.selectTeam(room.id, playerId, input.teamId);
      if ("error" in result) return ack(deny(result.error));

      broadcastState(result);
      ack({ ok: true });
    });

    // -----------------------------------------------------------------------
    // Game start
    // -----------------------------------------------------------------------

    socket.on("game:start", (ack) => {
      const room = currentRoom(socket);
      const playerId = socket.data.playerId;
      if (!room || !playerId) return ack(deny("ROOM_NOT_FOUND"));
      if (room.hostId !== playerId) return ack(deny("NOT_HOST"));
      if (room.status !== "LOBBY") return ack(deny("GAME_ALREADY_STARTED"));
      if (room.players.length !== room.playerCount) return ack(deny("ROOM_FULL"));

      // §71: fill unassigned players, then seat teams alternately per §6.
      const seated = rooms.assignSeatsForStart(room);
      if ("error" in seated) return ack(deny(seated.error));

      // §8: the server shuffles and deals. The client decides nothing.
      const hands = deal(room.playerCount);
      const players: NewGamePlayer[] = room.players.map((p, i) => ({
        id: p.id,
        name: p.name,
        seatPosition: p.seatPosition,
        hand: hands[i]!,
      }));

      room.game = createGameState(players, players[0]!.id);
      room.status = "PLAYING";
      rooms.touch(room);

      broadcastState(room);
      // §73: the first player may be a bot.
      bots.schedule(room);
      ack({ ok: true });
    });

    // -----------------------------------------------------------------------
    // Gameplay — every action goes through the reducer (§44)
    // -----------------------------------------------------------------------

    socket.on("game:ask-card", (raw, ack) => {
      const input = parse(askCardSchema, raw);
      if (!input) return ack(deny("UNKNOWN_CARD"));

      withEnvelope(socket, input.actionId, ack, (room, playerId) => {
        if (!room.game) return deny("GAME_ALREADY_STARTED");
        const result = reduce(room.game, {
          type: "ASK",
          playerId,
          targetId: input.payload.targetPlayerId,
          cardId: input.payload.cardId,
        });
        if (!result.ok) return deny(result.error);

        room.game = result.state;
        if (result.state.status === "FINISHED") room.status = "FINISHED";
        rooms.touch(room);
        broadcastEvents(room, result.events);
        return { ok: true };
      });
    });

    socket.on("game:declaration-open", (raw, ack) => {
      const input = parse(emptyEnvelopeSchema, raw);
      if (!input) return ack(deny("MALFORMED_DECLARATION"));

      withEnvelope(socket, input.actionId, ack, (room, playerId) => {
        if (!room.game) return deny("GAME_ALREADY_STARTED");
        const result = reduce(room.game, {
          type: "OPEN_DECLARATION",
          playerId,
          now: Date.now(),
        });
        if (!result.ok) return deny(result.error);

        room.game = result.state;
        rooms.touch(room);
        broadcastEvents(room, result.events);
        return { ok: true };
      });
    });

    socket.on("game:declaration-claim", (raw, ack) => {
      const input = parse(emptyEnvelopeSchema, raw);
      if (!input) return ack(deny("MALFORMED_DECLARATION"));

      withEnvelope(socket, input.actionId, ack, (room, playerId) => {
        if (!room.game) return deny("GAME_ALREADY_STARTED");
        const result = reduce(room.game, { type: "CLAIM_DECLARATION", playerId });
        if (!result.ok) return deny(result.error);

        room.game = result.state;
        rooms.touch(room);
        broadcastEvents(room, result.events);
        return { ok: true };
      });
    });

    socket.on("game:declaration-release", (raw, ack) => {
      const input = parse(emptyEnvelopeSchema, raw);
      if (!input) return ack(deny("MALFORMED_DECLARATION"));

      withEnvelope(socket, input.actionId, ack, (room, playerId) => {
        if (!room.game) return deny("GAME_ALREADY_STARTED");
        const result = reduce(room.game, { type: "RELEASE_DECLARATION", playerId });
        if (!result.ok) return deny(result.error);

        room.game = result.state;
        rooms.touch(room);
        broadcastEvents(room, result.events);
        return { ok: true };
      });
    });

    socket.on("game:declaration-cancel", (raw, ack) => {
      const input = parse(emptyEnvelopeSchema, raw);
      if (!input) return ack(deny("MALFORMED_DECLARATION"));

      withEnvelope(socket, input.actionId, ack, (room, playerId) => {
        if (!room.game) return deny("GAME_ALREADY_STARTED");
        const result = reduce(room.game, { type: "CANCEL_DECLARATION", playerId });
        if (!result.ok) return deny(result.error);

        room.game = result.state;
        rooms.touch(room);
        broadcastEvents(room, result.events);
        return { ok: true };
      });
    });

    socket.on("game:declare-set", (raw, ack) => {
      const input = parse(declareSchema, raw);
      if (!input) return ack(deny("MALFORMED_DECLARATION"));

      withEnvelope(socket, input.actionId, ack, (room, playerId) => {
        if (!room.game) return deny("GAME_ALREADY_STARTED");
        const result = reduce(room.game, {
          type: "DECLARE",
          playerId,
          setId: input.payload.setId,
          assignments: input.payload.assignments,
        });
        if (!result.ok) return deny(result.error);

        room.game = result.state;
        if (result.state.status === "FINISHED") room.status = "FINISHED";
        rooms.touch(room);
        broadcastEvents(room, result.events);
        return { ok: true };
      });
    });

    // -----------------------------------------------------------------------
    // Voice (§29, §30, §69) — entirely optional; the game never depends on it
    // -----------------------------------------------------------------------

    socket.on("voice:token", async (ack) => {
      if (!actionLimiter.allow(socket.id)) return ack(deny("RATE_LIMITED"));
      if (!isVoiceConfigured()) return ack(deny("VOICE_UNAVAILABLE"));

      const room = currentRoom(socket);
      const playerId = socket.data.playerId;
      if (!room || !playerId) return ack(deny("ROOM_NOT_FOUND"));

      const player = room.players.find((p) => p.id === playerId);
      if (!player) return ack(deny("ROOM_NOT_FOUND"));

      // §30: the token admits this player to this room's channel and no other.
      const creds = await mintVoiceToken(room.id, player.id, player.name);
      if (!creds) return ack(deny("VOICE_UNAVAILABLE"));
      ack({ ok: true, data: creds });
    });

    socket.on("voice:state", (raw, ack) => {
      const input = parse(voiceStateSchema, raw);
      if (!input) return ack(deny("RATE_LIMITED"));

      const room = currentRoom(socket);
      const playerId = socket.data.playerId;
      if (!room || !playerId) return ack(deny("ROOM_NOT_FOUND"));

      rooms.setVoicePresence(room, playerId, input.connected);
      io.to(room.id).emit("voice:participants", [...room.voiceParticipants]);
      ack({ ok: true });
    });

    // -----------------------------------------------------------------------
    // Chat (§28, §58) — room-wide only, never a teammate channel (§17)
    // -----------------------------------------------------------------------

    socket.on("chat:send", (raw, ack) => {
      if (!chatLimiter.allow(socket.id)) return ack(deny("RATE_LIMITED"));
      const input = parse(chatSendSchema, raw);
      if (!input) return ack(deny("RATE_LIMITED"));

      const room = currentRoom(socket);
      const playerId = socket.data.playerId;
      if (!room || !playerId) return ack(deny("ROOM_NOT_FOUND"));

      const player = room.players.find((p) => p.id === playerId);
      if (!player) return ack(deny("ROOM_NOT_FOUND"));

      const message = rooms.addChatMessage(room, player.id, player.name, input.payload.message);
      io.to(room.id).emit("chat:message", message);
      ack({ ok: true });
    });

    // -----------------------------------------------------------------------
    // Disconnect (§34, §54, §59.1)
    // -----------------------------------------------------------------------

    socket.on("disconnect", () => {
      const roomId = socket.data.roomId;
      const playerId = socket.data.playerId;
      actionLimiter.forget(socket.id);
      chatLimiter.forget(socket.id);
      joinLimiter.forget(socket.id);
      if (!roomId || !playerId) return;

      const before = rooms.get(roomId)?.hostId;
      const room = rooms.markDisconnected(roomId, playerId);
      if (!room) return;

      if (room.hostId !== before) io.to(room.id).emit("room:host-changed", room.hostId);
      io.to(room.id).emit("voice:participants", [...room.voiceParticipants]);
      broadcastState(room);
    });
  });
}
