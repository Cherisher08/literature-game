/**
 * Room lifecycle. Spec §5, §31, §34-35, §54, §58, §59.1.
 *
 * Rooms live in memory only (§63). Timers live in a side table so `GameRoom`
 * stays plain JSON.
 */

import { randomInt, randomUUID } from "node:crypto";
import {
  EMPTY_ROOM_TIMEOUT_MS,
  MAX_CHAT_HISTORY,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ROOM_IDLE_TTL_MS,
  ROOM_MAX_LIFETIME_MS,
  DEFAULT_PLAYER_COUNT,
  type ChatMessage,
  type PlayerCount,
  type ErrorCode,
  type TeamId,
} from "@memory-game/shared";
import type { GameRoom, RoomPlayer, RoomRuntime } from "./types.js";

export type RoomCloseReason = "EMPTY" | "EXPIRED";

export interface RoomManagerHooks {
  onRoomClosed?: (roomId: string, reason: RoomCloseReason) => void;
}

export class RoomManager {
  private rooms = new Map<string, GameRoom>();
  private runtimes = new Map<string, RoomRuntime>();
  private sweeper?: NodeJS.Timeout;

  constructor(private hooks: RoomManagerHooks = {}) {}

  // -------------------------------------------------------------------------
  // Codes and ids (§58)
  // -------------------------------------------------------------------------

  /** Crypto-random, unambiguous alphabet, collision-checked against live rooms. */
  private generateRoomCode(): string {
    for (let attempt = 0; attempt < 50; attempt++) {
      let code = "";
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
    throw new Error("could not allocate a unique room code");
  }

  // -------------------------------------------------------------------------
  // Access
  // -------------------------------------------------------------------------

  get(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  runtime(roomId: string): RoomRuntime {
    let rt = this.runtimes.get(roomId);
    if (!rt) {
      rt = { timers: new Map(), dedupe: new Map() };
      this.runtimes.set(roomId, rt);
    }
    return rt;
  }

  get size(): number {
    return this.rooms.size;
  }

  touch(room: GameRoom): void {
    room.lastActivityAt = Date.now();
  }

  /** §69.4: advisory presence. Never consulted by the rules engine. */
  setVoicePresence(room: GameRoom, playerId: string, connected: boolean): void {
    const present = room.voiceParticipants.includes(playerId);
    if (connected && !present) room.voiceParticipants.push(playerId);
    if (!connected && present) {
      room.voiceParticipants = room.voiceParticipants.filter((id) => id !== playerId);
    }
  }

  /** §68.6: bump before every broadcast so clients can detect a gap. */
  nextSeq(room: GameRoom): number {
    room.seq += 1;
    return room.seq;
  }

  // -------------------------------------------------------------------------
  // Create / join / leave
  // -------------------------------------------------------------------------

  createRoom(
    hostName: string,
    socketId: string,
    playerCount: PlayerCount = DEFAULT_PLAYER_COUNT,
  ): { room: GameRoom; player: RoomPlayer } {
    const id = this.generateRoomCode();
    const now = Date.now();

    const player: RoomPlayer = {
      id: randomUUID(),
      name: hostName,
      seatPosition: 1,
      connected: true,
      sessionToken: randomUUID(),
      socketId,
    };

    const room: GameRoom = {
      id,
      hostId: player.id,
      status: "LOBBY",
      playerCount,
      players: [player],
      chatMessages: [],
      createdAt: now,
      lastActivityAt: now,
      seq: 0,
      voiceParticipants: [],
    };

    this.rooms.set(id, room);
    return { room, player };
  }

  joinRoom(
    roomId: string,
    name: string,
    socketId: string,
  ): { room: GameRoom; player: RoomPlayer } | { error: ErrorCode } {
    const room = this.rooms.get(roomId);
    if (!room) return { error: "ROOM_NOT_FOUND" };
    if (room.players.length >= room.playerCount) return { error: "ROOM_FULL" };
    if (room.status !== "LOBBY") return { error: "GAME_ALREADY_STARTED" };

    const taken = new Set(room.players.map((p) => p.seatPosition));
    let seat = 1;
    while (taken.has(seat)) seat += 1;

    const player: RoomPlayer = {
      id: randomUUID(),
      name,
      seatPosition: seat,
      connected: true,
      sessionToken: randomUUID(),
      socketId,
    };

    room.players.push(player);
    room.players.sort((a, b) => a.seatPosition - b.seatPosition);
    this.touch(room);
    this.cancelTimer(room.id, "empty");

    return { room, player };
  }

  /** §35: resume a seat with a session token. */
  reconnect(
    roomId: string,
    sessionToken: string,
    socketId: string,
  ): { room: GameRoom; player: RoomPlayer } | { error: ErrorCode } {
    const room = this.rooms.get(roomId);
    if (!room) return { error: "ROOM_NOT_FOUND" };

    const player = room.players.find((p) => p.sessionToken === sessionToken);
    if (!player) return { error: "INVALID_SESSION" };

    player.connected = true;
    player.socketId = socketId;
    delete player.disconnectedAt;

    this.touch(room);
    this.cancelTimer(room.id, "empty");
    return { room, player };
  }

  /** §34: mark offline but keep the seat. Does not remove the player. */
  markDisconnected(roomId: string, playerId: string): GameRoom | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    const player = room.players.find((p) => p.id === playerId);
    if (!player) return undefined;

    player.connected = false;
    player.disconnectedAt = Date.now();
    delete player.socketId;
    this.setVoicePresence(room, playerId, false);

    this.reassignHostIfNeeded(room);
    this.scheduleEmptyRoomCloseIfNeeded(room);
    return room;
  }

  /** Explicit leave: the seat is given up. */
  removePlayer(roomId: string, playerId: string): GameRoom | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    room.players = room.players.filter((p) => p.id !== playerId);
    room.voiceParticipants = room.voiceParticipants.filter((id) => id !== playerId);
    if (room.game) {
      room.game = {
        ...room.game,
        players: room.game.players.filter((p) => p.id !== playerId),
      };
    }

    if (room.players.length === 0) {
      this.closeRoom(room.id, "EMPTY");
      return undefined;
    }

    this.reassignHostIfNeeded(room);
    this.scheduleEmptyRoomCloseIfNeeded(room);
    return room;
  }

  /** §59.1: on host disconnect, the connected player at the lowest seat takes over. */
  private reassignHostIfNeeded(room: GameRoom): boolean {
    const host = room.players.find((p) => p.id === room.hostId);
    if (host?.connected) return false;

    const candidate = room.players
      .filter((p) => p.connected)
      .sort((a, b) => a.seatPosition - b.seatPosition)[0];

    if (!candidate || candidate.id === room.hostId) return false;
    room.hostId = candidate.id;
    return true;
  }

  hostOf(room: GameRoom): string {
    return room.hostId;
  }


  // -------------------------------------------------------------------------
  // Lobby team selection (§71)
  // -------------------------------------------------------------------------

  /** Players in a team, by chosen team only. Unassigned players count to neither. */
  teamMembers(room: GameRoom, teamId: TeamId): RoomPlayer[] {
    return room.players.filter((p) => p.teamId === teamId);
  }

  /**
   * §71: a player picks their own team in the lobby. Capped at half the table so
   * the two teams stay even; §6 requires 3v3.
   */
  selectTeam(roomId: string, playerId: string, teamId: TeamId): GameRoom | { error: ErrorCode } {
    const room = this.rooms.get(roomId);
    if (!room) return { error: "ROOM_NOT_FOUND" };
    if (room.status !== "LOBBY") return { error: "NOT_IN_LOBBY" };

    const player = room.players.find((p) => p.id === playerId);
    if (!player) return { error: "INVALID_SESSION" };

    // Re-picking the same team is a no-op, not an error.
    if (player.teamId === teamId) return room;
    if (this.teamMembers(room, teamId).length >= room.playerCount / 2) {
      return { error: "TEAM_FULL" };
    }

    player.teamId = teamId;
    this.touch(room);
    return room;
  }

  /**
   * §71.5: steps a player out to the unassigned pool. This is what makes a
   * swap possible when both teams are full — someone vacates a slot first.
   */
  clearTeam(roomId: string, playerId: string): GameRoom | { error: ErrorCode } {
    const room = this.rooms.get(roomId);
    if (!room) return { error: "ROOM_NOT_FOUND" };
    if (room.status !== "LOBBY") return { error: "NOT_IN_LOBBY" };

    const player = room.players.find((p) => p.id === playerId);
    if (!player) return { error: "INVALID_SESSION" };

    delete player.teamId;
    this.touch(room);
    return room;
  }

  /**
   * §71: fills any unassigned players into whichever team has room, then
   * assigns final seats so teams alternate as §6 requires — team A takes seats
   * 1, 3, 5 and team B takes 2, 4, 6, each in join order.
   *
   * Returns an error if the table cannot be split evenly.
   */
  assignSeatsForStart(room: GameRoom): { ok: true } | { error: ErrorCode } {
    const half = room.playerCount / 2;
    const byJoinOrder = [...room.players].sort((a, b) => a.seatPosition - b.seatPosition);

    const teamA = byJoinOrder.filter((p) => p.teamId === "A");
    const teamB = byJoinOrder.filter((p) => p.teamId === "B");
    const unassigned = byJoinOrder.filter((p) => !p.teamId);

    for (const player of unassigned) {
      if (teamA.length < half) {
        player.teamId = "A";
        teamA.push(player);
      } else if (teamB.length < half) {
        player.teamId = "B";
        teamB.push(player);
      } else {
        return { error: "TEAMS_UNBALANCED" };
      }
    }

    if (teamA.length !== half || teamB.length !== half) {
      return { error: "TEAMS_UNBALANCED" };
    }

    teamA.forEach((p, i) => (p.seatPosition = i * 2 + 1)); // 1, 3, 5
    teamB.forEach((p, i) => (p.seatPosition = i * 2 + 2)); // 2, 4, 6
    room.players.sort((a, b) => a.seatPosition - b.seatPosition);

    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // Chat (§28, §58)
  // -------------------------------------------------------------------------

  addChatMessage(room: GameRoom, playerId: string, playerName: string, message: string): ChatMessage {
    // Server assigns id, author and timestamp. Client values are never trusted.
    const msg: ChatMessage = {
      id: randomUUID(),
      playerId,
      playerName,
      message,
      timestamp: Date.now(),
    };

    room.chatMessages.push(msg);
    if (room.chatMessages.length > MAX_CHAT_HISTORY) {
      room.chatMessages.splice(0, room.chatMessages.length - MAX_CHAT_HISTORY);
    }
    this.touch(room);
    return msg;
  }

  // -------------------------------------------------------------------------
  // Lifecycle (§54)
  // -------------------------------------------------------------------------

  private setTimer(roomId: string, key: string, ms: number, fn: () => void): void {
    const rt = this.runtime(roomId);
    const existing = rt.timers.get(key);
    if (existing) clearTimeout(existing);
    const t = setTimeout(fn, ms);
    // Do not hold the process open for a room timer.
    t.unref?.();
    rt.timers.set(key, t);
  }

  cancelTimer(roomId: string, key: string): void {
    const rt = this.runtimes.get(roomId);
    const t = rt?.timers.get(key);
    if (t) {
      clearTimeout(t);
      rt!.timers.delete(key);
    }
  }

  /**
   * §54: resolves the contradiction between §31 and §34. Disconnected players
   * keep their seats, so an all-disconnected room is closed on a timer rather
   * than immediately or never.
   */
  private scheduleEmptyRoomCloseIfNeeded(room: GameRoom): void {
    const anyConnected = room.players.some((p) => p.connected);
    if (anyConnected) {
      this.cancelTimer(room.id, "empty");
      return;
    }
    this.setTimer(room.id, "empty", EMPTY_ROOM_TIMEOUT_MS, () => {
      const current = this.rooms.get(room.id);
      if (!current) return;
      if (current.players.some((p) => p.connected)) return;
      this.closeRoom(room.id, "EMPTY");
    });
  }

  closeRoom(roomId: string, reason: RoomCloseReason): void {
    const rt = this.runtimes.get(roomId);
    if (rt) {
      for (const t of rt.timers.values()) clearTimeout(t);
      this.runtimes.delete(roomId);
    }
    if (this.rooms.delete(roomId)) {
      this.hooks.onRoomClosed?.(roomId, reason);
    }
  }

  /**
   * §54: a single interval over the map. Without it, abandoned rooms accumulate
   * until the process restarts.
   */
  startSweeper(intervalMs = 60_000): void {
    if (this.sweeper) return;
    this.sweeper = setInterval(() => this.sweep(), intervalMs);
    this.sweeper.unref?.();
  }

  stopSweeper(): void {
    if (this.sweeper) clearInterval(this.sweeper);
    delete this.sweeper;
  }

  sweep(now = Date.now()): string[] {
    const closed: string[] = [];
    for (const room of [...this.rooms.values()]) {
      const idle = now - room.lastActivityAt > ROOM_IDLE_TTL_MS;
      const tooOld = now - room.createdAt > ROOM_MAX_LIFETIME_MS;
      if (idle || tooOld) {
        this.closeRoom(room.id, "EXPIRED");
        closed.push(room.id);
      }
    }
    return closed;
  }

  /** Test/shutdown helper. */
  clear(): void {
    for (const id of [...this.rooms.keys()]) this.closeRoom(id, "EXPIRED");
    this.stopSweeper();
  }
}
