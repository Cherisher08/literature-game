/**
 * Client state. Spec §65.1, §68.5.
 *
 * The server is authoritative; this store holds the last projection received
 * plus purely local UI concerns. `lastAsk` is never derived here — it arrives
 * in the projection so a reconnect does not lose it (§65.1).
 */

import { create } from "zustand";
import type {
  ChatMessage,
  ClientRoomState,
  DeclarationResult,
  GameEvent,
  TeamId,
} from "@memory-game/shared";

export type Screen = "NAME" | "HOME" | "LOBBY" | "GAME";
export type ConnectionState = "CONNECTING" | "CONNECTED" | "RECONNECTING" | "SERVER_GONE";

const SESSION_KEY = "literature.session";

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
  screen: "NAME",
  connection: "CONNECTING",
  name: "",
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
  setName: (name) => set({ name }),
  setError: (error) => set({ error }),
  setIdentity: (playerId) => set({ playerId }),

  applyState: (room, opts) =>
    set({
      room,
      lastSeq: room.seq,
      hydrating: opts?.hydrating ?? false,
      screen: room.status === "LOBBY" ? "LOBBY" : "GAME",
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

export const useIsHost = () => {
  const room = useGame((s) => s.room);
  const playerId = useGame((s) => s.playerId);
  return Boolean(room && playerId && room.hostId === playerId);
};
