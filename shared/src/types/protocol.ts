/**
 * The client/server wire contract. Spec §27, §53, §59, §68.6.
 *
 * The projection types here are the anti-cheat (§53). `PublicPlayer` has no
 * field capable of holding another player's cards, and `ClientGameState`
 * carries exactly one hand: the recipient's own. The leak is unrepresentable
 * in the type rather than something to remember to strip.
 */

import type { Card, SetId } from "./cards.js";
import type {
  AskingRule,
  BotDifficulty,
  DeclarationWindow,
  GameEvent,
  LastAsk,
  ResolvedSet,
  RuleConfig,
  TeamId,
  Turn,
} from "./game.js";
import type { ErrorCode } from "./errors.js";

// ---------------------------------------------------------------------------
// Projections (§53)
// ---------------------------------------------------------------------------

/** What every player may know about every other player. Count, never cards. */
export interface PublicPlayer {
  id: string;
  name: string;
  /** null only in the lobby, before this player has picked a team (§71). */
  teamId: TeamId | null;
  seatPosition: number;
  connected: boolean;
  /** §53: the count is public; the contents are not. */
  cardCount: number;
  /** §62.1: derived from cardCount, never stored. */
  spectating: boolean;
  /** §73: true for a bot-controlled seat. */
  isBot: boolean;
  /** Present only for bots. */
  difficulty?: BotDifficulty;
  /** True when `isBot` is a stand-in for a disconnected human, not a seat added as a bot. */
  botStandIn?: boolean;
}

export interface PublicSpectator {
  id: string;
  name: string;
  connected: boolean;
}

export type RoomStatus = "LOBBY" | "PLAYING" | "FINISHED";

export interface ClientGameState {
  status: RoomStatus;
  players: PublicPlayer[];
  turn: Turn;
  teamScores: Record<TeamId, number>;
  askingRule: Record<TeamId, AskingRule>;
  resolvedSets: ResolvedSet[];
  activeSetIds: SetId[];
  drawn?: boolean;
  declarationWindow?: DeclarationWindow;
  lastAsk?: LastAsk;
  rules: RuleConfig;
  winningTeamId?: TeamId;
  history: GameEvent[];
  /** The recipient's own hand. The only cards in this payload. */
  myHand: Card[];
  myPlayerId: string;
}

export interface ClientRoomState {
  roomId: string;
  hostId: string;
  status: RoomStatus;
  /** §72: chosen when the room is created; join capacity and deck follow it. */
  playerCount: number;
  /** §69.4: advisory. Nothing in the rules may depend on it. */
  voice: VoiceState;
  players: PublicPlayer[];
  spectators: PublicSpectator[];
  /** Present only once the game has started. */
  game?: ClientGameState;
  /** §68.6: monotonic per room; a gap means resync. */
  seq: number;
}

// ---------------------------------------------------------------------------
// Chat (§28)
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Envelopes and acks (§59, §68.6)
// ---------------------------------------------------------------------------

/**
 * §68.5: every client action carries a client-generated id so a retry after an
 * ack timeout is deduped rather than applied twice.
 */
export interface ActionEnvelope<T> {
  actionId: string;
  payload: T;
}

export interface AckFailure {
  ok: false;
  error: ErrorCode;
  message?: string;
}

/** For actions that return a value. */
export type Ack<T> = { ok: true; data: T } | AckFailure;

/** For actions whose only outcome is success or an error code. */
export type VoidAck = { ok: true } | AckFailure;

// ---------------------------------------------------------------------------
// Client -> server payloads
// ---------------------------------------------------------------------------

export interface JoinRoomPayload {
  protocolVersion: number;
  roomId: string;
  name: string;
  /** Present when resuming a seat (§35). */
  sessionToken?: string;
  /** True when the user explicitly requests to join as a spectator. */
  spectateOnly?: boolean;
}

export interface CreateRoomPayload {
  protocolVersion: number;
  name: string;
  /** §72: 4, 6 or 8. */
  playerCount: number;
}

export interface AskCardPayload {
  targetPlayerId: string;
  cardId: string;
}

export interface DeclarePayload {
  setId: SetId;
  assignments: Array<{ cardId: string; playerId: string }>;
}

export interface ChatSendPayload {
  message: string;
}

/** §69: credentials for one player in one room. */
export interface VoiceCredentials {
  url: string;
  token: string;
  room: string;
}

export interface VoiceState {
  /** False when the server has no LiveKit credentials (§69). */
  available: boolean;
  /** Player ids currently connected to the room's voice channel. */
  participants: string[];
}

export interface AddBotPayload {
  difficulty: BotDifficulty;
  teamId?: TeamId;
}

export interface RemoveBotPayload {
  playerId: string;
}

export interface SelectTeamPayload {
  /** null steps out to the unassigned pool (§71.5). */
  teamId: TeamId | null;
}

export interface JoinResult {
  roomId: string;
  playerId: string;
  /** Sent only to the owning socket. Never appears in a broadcast (§58). */
  sessionToken: string;
  state: ClientRoomState;
  /** True if the user joined as a spectator. */
  isSpectator?: boolean;
}

// ---------------------------------------------------------------------------
// Socket.IO event maps
// ---------------------------------------------------------------------------

export interface ClientToServerEvents {
  "room:create": (p: CreateRoomPayload, ack: (r: Ack<JoinResult>) => void) => void;
  "room:join": (p: JoinRoomPayload, ack: (r: Ack<JoinResult>) => void) => void;
  "room:leave": (ack: (r: VoidAck) => void) => void;
  "room:resync": (ack: (r: Ack<ClientRoomState>) => void) => void;
  "room:select-team": (p: SelectTeamPayload, ack: (r: VoidAck) => void) => void;
  /** §69.3: mints a short-lived, single-room join token. */
  /** §73: host-only. */
  "room:add-bot": (p: AddBotPayload, ack: (r: VoidAck) => void) => void;
  "room:remove-bot": (p: RemoveBotPayload, ack: (r: VoidAck) => void) => void;
  "voice:token": (ack: (r: Ack<VoiceCredentials>) => void) => void;
  /** Advisory presence only; the engine never reads it (§69.4). */
  "voice:state": (p: { connected: boolean }, ack: (r: VoidAck) => void) => void;
  "game:start": (ack: (r: VoidAck) => void) => void;
  "game:ask-card": (e: ActionEnvelope<AskCardPayload>, ack: (r: VoidAck) => void) => void;
  "game:declaration-open": (e: ActionEnvelope<Record<string, never>>, ack: (r: VoidAck) => void) => void;
  "game:declaration-claim": (e: ActionEnvelope<Record<string, never>>, ack: (r: VoidAck) => void) => void;
  "game:declaration-release": (e: ActionEnvelope<Record<string, never>>, ack: (r: VoidAck) => void) => void;
  "game:declaration-cancel": (e: ActionEnvelope<Record<string, never>>, ack: (r: VoidAck) => void) => void;
  "game:declare-set": (e: ActionEnvelope<DeclarePayload>, ack: (r: VoidAck) => void) => void;
  "chat:send": (e: ActionEnvelope<ChatSendPayload>, ack: (r: VoidAck) => void) => void;
}

export interface ServerToClientEvents {
  /** Full authoritative state. Projected per socket (§53). */
  "room:state": (s: ClientRoomState) => void;
  "room:player-joined": (p: PublicPlayer) => void;
  "room:player-left": (playerId: string) => void;
  "room:host-changed": (hostId: string) => void;
  "room:closed": (reason: "EMPTY" | "EXPIRED") => void;
  "game:event": (e: GameEvent, seq: number) => void;
  "chat:message": (m: ChatMessage) => void;
  "voice:participants": (playerIds: string[]) => void;
  error: (e: { error: ErrorCode; message: string }) => void;
}

export interface SocketData {
  playerId?: string;
  roomId?: string;
}
