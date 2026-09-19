/**
 * Client state. Spec §65.1, §68.5.
 *
 * The server is authoritative; this store holds the last projection received
 * plus purely local UI concerns. `lastAsk` is never derived here — it arrives
 * in the projection so a reconnect does not lose it (§65.1).
 */

import { create } from "zustand";
import {
  ROOM_CODE_LENGTH,
  type ChatMessage,
  type ClientRoomState,
  type DeclarationResult,
  type GameEvent,
  type TeamId,
} from "@memory-game/shared";

export type Screen = "LOADING" | "HOME" | "LITERATURE_ROOM" | "NAME" | "LOBBY" | "GAME" | "POKER_ROOM" | "POKER_GAME";
export type ConnectionState = "CONNECTING" | "CONNECTED" | "RECONNECTING" | "SERVER_GONE";

const SESSION_KEY = "literature.session";
const USERNAME_KEY = "literature.username";

export function loadSavedUsername(): string {
  try {
    return globalThis.localStorage?.getItem(USERNAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveUsername(name: string): void {
  try {
    globalThis.localStorage?.setItem(USERNAME_KEY, name);
  } catch {
    /* ignore */
  }
}

/**
 * A room link opened cold (e.g. /CPYWKG) names the room the visitor meant to
 * reach. Captured once at module load — before the router rewrites the address
 * bar to /home — so the join screen can still pre-fill it later (§35 deep link).
 */
export const INITIAL_ROOM_CODE: string | null = (() => {
  try {
    const seg = window.location.pathname.slice(1).toUpperCase();
    return seg.length === ROOM_CODE_LENGTH && /^[A-Z0-9]+$/.test(seg) ? seg : null;
  } catch {
    return null;
  }
})();

/**
 * §35: per-TAB storage, deliberately not localStorage.
 *
 * localStorage is shared across every tab of a browser profile, so two tabs
 * would both resume the same seat and act as one player. sessionStorage is
 * scoped to the tab, still survives a refresh (the reconnection case that
 * matters), and matches the "temporary by design" model in §63.
 */
const store = (): Storage | null => {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
};

export interface StoredSession {
  roomId: string;
  sessionToken: string;
  name: string;
}

export function loadSession(): StoredSession | null {
  try {
    const raw = store()?.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(s: StoredSession): void {
  try {
    store()?.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    /* private mode; reconnection simply will not survive a reload */
  }
}

export function clearSession(): void {
  try {
    store()?.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

interface GameStore {
  screen: Screen;
  connection: ConnectionState;
  name: string;
  playerId: string | null;
  room: ClientRoomState | null;
  chat: ChatMessage[];
  /** §65.4: suppresses entrance animation for one render after hydration. */
  hydrating: boolean;
  lastSeq: number;
  error: string | null;
  /** §61.3: the declaration reveal waiting to be shown. */
  reveal: DeclarationResult | null;
  /** §69.4: advisory presence; nothing in the game reads it. */
  voiceParticipants: string[];
  gameOver: { winningTeamId?: TeamId; drawn: boolean; scores: Record<TeamId, number> } | null;

  setScreen: (s: Screen) => void;
  setConnection: (c: ConnectionState) => void;
  setName: (n: string) => void;
  setError: (e: string | null) => void;
  setIdentity: (playerId: string) => void;
  /** Applies a full authoritative projection. */
  applyState: (s: ClientRoomState, opts?: { hydrating?: boolean }) => void;
  /** Returns true when a gap was detected and a resync is required (§68.6). */
  noteEvent: (e: GameEvent, seq: number) => boolean;
  addChat: (m: ChatMessage) => void;
  setReveal: (r: DeclarationResult | null) => void;
  setVoiceParticipants: (ids: string[]) => void;
  setGameOver: (
    g: { winningTeamId?: TeamId; drawn: boolean; scores: Record<TeamId, number> } | null,
  ) => void;
  reset: () => void;
}

export const useGame = create<GameStore>((set, get) => ({
  // A stored session means a reconnect attempt is coming (§35) — hold on a
  // loading screen rather than flashing the home screen before it resolves.
  screen: loadSession() ? "LOADING" : (INITIAL_ROOM_CODE ? "LITERATURE_ROOM" : "HOME"),
  connection: "CONNECTING",
  name: loadSession()?.name || loadSavedUsername(),
  playerId: null,
  room: null,
  chat: [],
  hydrating: false,
  lastSeq: 0,
  error: null,
  reveal: null,
  gameOver: null,
  voiceParticipants: [],

  setScreen: (screen) => set({ screen }),
  setConnection: (connection) => set({ connection }),
  setName: (name) => {
    saveUsername(name);
    set({ name });
  },
  setError: (error) => set({ error }),
  setIdentity: (playerId) => set({ playerId }),

  applyState: (room, opts) =>
    set({
      room,
      lastSeq: room.seq,
      hydrating: opts?.hydrating ?? false,
      screen:
        room.status === "LOBBY"
          ? "LOBBY"
          : room.gameType === "POKER"
            ? "POKER_GAME"
            : "GAME",
      // Back in the lobby means the last game is done — clear its leftovers so
      // they can't flash back up if this player's next game ends the same way.
      ...(room.status === "LOBBY" ? { gameOver: null, reveal: null } : {}),
    }),

  noteEvent: (_event, seq) => {
    const { lastSeq } = get();
    // §68.6: a jump means we missed a broadcast. Ask for full state rather than
    // applying an update to state we know is stale.
    if (seq > lastSeq + 1 && lastSeq !== 0) return true;
    set({ lastSeq: Math.max(lastSeq, seq) });
    return false;
  },

  addChat: (m) => set((s) => ({ chat: [...s.chat, m].slice(-200) })),

  setReveal: (reveal) => set({ reveal }),
  setVoiceParticipants: (voiceParticipants) => set({ voiceParticipants }),
  setGameOver: (gameOver) => set({ gameOver }),

  reset: () =>
    set({
      screen: "HOME",
      room: null,
      playerId: null,
      chat: [],
      lastSeq: 0,
      error: null,
      reveal: null,
      gameOver: null,
      voiceParticipants: [],
    }),
}));

/** Convenience selectors. */
export const useMe = () => {
  const room = useGame((s) => s.room);
  const playerId = useGame((s) => s.playerId);
  return room?.players.find((p) => p.id === playerId) ?? null;
};

export const useIsSpectator = () => {
  const room = useGame((s) => s.room);
  const playerId = useGame((s) => s.playerId);
  if (!room || !playerId) return false;
  return Boolean(
    room.spectators?.some((s) => s.id === playerId) ||
    (!room.players.some((p) => p.id === playerId) && playerId)
  );
};

export const useIsHost = () => {
  const room = useGame((s) => s.room);
  const playerId = useGame((s) => s.playerId);
  return Boolean(room && playerId && room.hostId === playerId);
};
