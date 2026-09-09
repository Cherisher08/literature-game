/**
 * Room model. Spec §23, §54, §63.
 *
 * `GameRoom` is plain JSON so it stays serialisable (§63). Timers, socket
 * handles and any future voice client live in `RoomRuntime`, a side table keyed
 * by room id — never inside the room object itself.
 */

import type {
  BotDifficulty,
  ChatMessage,
  GameState,
  PlayerCount,
  RoomStatus,
  TeamId,
} from "@memory-game/shared";

export interface RoomPlayer {
  id: string;
  name: string;
  /** Join order. Final seats are assigned at game start to alternate teams (§71). */
  seatPosition: number;
  /** Chosen in the lobby (§71). Undefined until picked; auto-filled at start. */
  teamId?: TeamId;
  connected: boolean;
  /** §58: crypto-random, sent only to the owning socket, never broadcast. */
  sessionToken: string;
  /** Set while connected; used to target this player's socket. */
  socketId?: string;
  /** §73: bot seats have no socket and are driven server-side. */
  bot?: { difficulty: BotDifficulty };
  disconnectedAt?: number;
}

export interface GameRoom {
  id: string;
  hostId: string;
  status: RoomStatus;
  /** §72: chosen at creation. Join capacity, deck and teams all follow it. */
  playerCount: PlayerCount;
  players: RoomPlayer[];
  /** Present once the game starts. Owned by the engine (§57). */
  game?: GameState;
  chatMessages: ChatMessage[];
  createdAt: number;
  lastActivityAt: number;
  /** §68.6: monotonic; every broadcast carries it so clients detect gaps. */
  seq: number;
  /**
   * §69.4: player ids currently in the voice channel. Advisory only — it
   * mirrors a separate system that can desync, so no rule may consult it.
   */
  voiceParticipants: string[];
}

/**
 * Non-serialisable per-room state. Kept out of `GameRoom` so the room stays
 * plain JSON (§63) and the reducer stays testable (§57).
 */
export interface RoomRuntime {
  timers: Map<string, NodeJS.Timeout>;
  /** §68.5: actionId -> cached result, so a retried action is not applied twice. */
  dedupe: Map<string, { at: number; ok: boolean; error?: string }>;
}
