/**
 * Socket client. Spec §44, §59, §68.5.
 *
 * Every action carries a client-generated `actionId` so a retry after an ack
 * timeout is deduped server-side rather than applied twice. Broadcasts carry a
 * `seq`; a gap triggers a full resync rather than applying updates to state we
 * know is stale.
 */

import { io, type Socket } from "socket.io-client";
import type {
  Ack,
  ClientRoomState,
  ClientToServerEvents,
  ChatMessage,
  GameEvent,
  JoinResult,
  ServerToClientEvents,
  VoiceCredentials,
  VoidAck,
} from "@memory-game/shared";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const ACK_TIMEOUT_MS = 8_000;

export const newActionId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `a-${Date.now()}-${Math.random().toString(36).slice(2)}`;

let socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (socket) return socket;
  // Same-origin in dev via the Vite proxy; VITE_SERVER_URL overrides in prod.
  const url = import.meta.env["VITE_SERVER_URL"] as string | undefined;
  socket = url
    ? io(url, { transports: ["websocket"], autoConnect: true })
    : io({ transports: ["websocket"], autoConnect: true });
  return socket;
}

/** Emits with an ack and a timeout, so a lost ack surfaces rather than hanging. */
export function request<E extends keyof ClientToServerEvents, R>(
  event: E,
  ...args: unknown[]
): Promise<R | { ok: false; error: "TIMEOUT" }> {
  const s = getSocket();
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, error: "TIMEOUT" });
    }, ACK_TIMEOUT_MS);

    (s.emit as (...a: unknown[]) => void)(event, ...args, (res: R) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(res);
    });
  });
}

// ---------------------------------------------------------------------------
// Typed action helpers
// ---------------------------------------------------------------------------

export const api = {
  createRoom: (name: string, protocolVersion: number, playerCount: number) =>
    request<"room:create", Ack<JoinResult>>("room:create", {
      protocolVersion,
      name,
      playerCount,
    }),

  joinRoom: (roomId: string, name: string, protocolVersion: number, sessionToken?: string) =>
    request<"room:join", Ack<JoinResult>>("room:join", {
      protocolVersion,
      roomId,
      name,
      ...(sessionToken ? { sessionToken } : {}),
    }),

  leaveRoom: () => request<"room:leave", VoidAck>("room:leave"),

  resync: () => request<"room:resync", Ack<ClientRoomState>>("room:resync"),

  /** null steps out to the unassigned pool (§71.5). */
  selectTeam: (teamId: "A" | "B" | null) =>
    request<"room:select-team", VoidAck>("room:select-team", { teamId }),

  startGame: () => request<"game:start", VoidAck>("game:start"),

  askCard: (targetPlayerId: string, cardId: string) =>
    request<"game:ask-card", VoidAck>("game:ask-card", {
      actionId: newActionId(),
      payload: { targetPlayerId, cardId },
    }),

  openDeclaration: () =>
    request<"game:declaration-open", VoidAck>("game:declaration-open", {
      actionId: newActionId(),
      payload: {},
    }),

  claimDeclaration: () =>
    request<"game:declaration-claim", VoidAck>("game:declaration-claim", {
      actionId: newActionId(),
      payload: {},
    }),

  releaseDeclaration: () =>
    request<"game:declaration-release", VoidAck>("game:declaration-release", {
      actionId: newActionId(),
      payload: {},
    }),

  cancelDeclaration: () =>
    request<"game:declaration-cancel", VoidAck>("game:declaration-cancel", {
      actionId: newActionId(),
      payload: {},
    }),

  declare: (setId: number, assignments: Array<{ cardId: string; playerId: string }>) =>
    request<"game:declare-set", VoidAck>("game:declare-set", {
      actionId: newActionId(),
      payload: { setId, assignments },
    }),

  addBot: (difficulty: "EASY" | "MEDIUM" | "HARD", teamId?: "A" | "B") =>
    request<"room:add-bot", VoidAck>("room:add-bot", {
      difficulty,
      ...(teamId ? { teamId } : {}),
    }),

  removeBot: (playerId: string) =>
    request<"room:remove-bot", VoidAck>("room:remove-bot", { playerId }),

  voiceToken: () => request<"voice:token", Ack<VoiceCredentials>>("voice:token"),

  setVoiceState: (connected: boolean) =>
    request<"voice:state", VoidAck>("voice:state", { connected }),

  sendChat: (message: string) =>
    request<"chat:send", VoidAck>("chat:send", {
      actionId: newActionId(),
      payload: { message },
    }),
};

export type ServerListeners = {
  onState: (s: ClientRoomState) => void;
  onEvent: (e: GameEvent, seq: number) => void;
  onChat: (m: ChatMessage) => void;
  onHostChanged: (hostId: string) => void;
  onClosed: (reason: "EMPTY" | "EXPIRED") => void;
  onVoiceParticipants: (playerIds: string[]) => void;
  onConnect: () => void;
  onDisconnect: () => void;
};

export function attachListeners(l: ServerListeners): () => void {
  const s = getSocket();
  s.on("room:state", l.onState);
  s.on("game:event", l.onEvent);
  s.on("chat:message", l.onChat);
  s.on("room:host-changed", l.onHostChanged);
  s.on("room:closed", l.onClosed);
  s.on("voice:participants", l.onVoiceParticipants);
  s.on("connect", l.onConnect);
  s.on("disconnect", l.onDisconnect);

  return () => {
    s.off("room:state", l.onState);
    s.off("game:event", l.onEvent);
    s.off("chat:message", l.onChat);
    s.off("room:host-changed", l.onHostChanged);
    s.off("room:closed", l.onClosed);
    s.off("voice:participants", l.onVoiceParticipants);
    s.off("connect", l.onConnect);
    s.off("disconnect", l.onDisconnect);
  };
}
