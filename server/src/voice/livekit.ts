/**
 * Voice infrastructure. Spec §29, §30, §69.
 *
 * LiveKit SFU. Audio only — video is never published (§69.3).
 *
 * Two rules this module exists to enforce:
 *
 *  - §69.3: a token grants `roomJoin`, `canPublish` and `canSubscribe` for
 *    exactly ONE room, and nothing else. `roomCreate` / `roomAdmin` are never
 *    issued to a client-facing endpoint.
 *  - §17: the room is the only voice channel. There is deliberately no
 *    teammate-only room and no selective subscription — LiveKit makes both
 *    trivial, and both are exactly the hidden channel §17 exists to prevent.
 *    Do not add one.
 */

import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { config } from "../config.js";

/** Tokens are short-lived and re-minted on reconnect (§69.3). */
const TOKEN_TTL_SECONDS = 6 * 60 * 60;

export const isVoiceConfigured = (): boolean =>
  Boolean(config.livekit.url && config.livekit.apiKey && config.livekit.apiSecret);

let roomService: RoomServiceClient | undefined;

function service(): RoomServiceClient | undefined {
  if (!isVoiceConfigured()) return undefined;
  roomService ??= new RoomServiceClient(
    config.livekit.url.replace(/^ws/, "http"),
    config.livekit.apiKey,
    config.livekit.apiSecret,
  );
  return roomService;
}

export interface VoiceCredentials {
  url: string;
  token: string;
  /** The LiveKit room, which is always the game room id (§30). */
  room: string;
}

/**
 * Mints a join token for one player in one room. §30: the room name is the game
 * room id, so a token admits its holder to exactly that room's voice channel.
 */
export async function mintVoiceToken(
  roomId: string,
  playerId: string,
  playerName: string,
): Promise<VoiceCredentials | undefined> {
  if (!isVoiceConfigured()) return undefined;

  const at = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
    identity: playerId,
    name: playerName,
    ttl: TOKEN_TTL_SECONDS,
  });

  at.addGrant({
    room: roomId,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    // Explicitly denied. A client never needs these, and granting them would
    // let a modified client create or administer rooms.
    roomCreate: false,
    roomAdmin: false,
    roomList: false,
    // No data channel: game state travels over the authoritative socket (§44),
    // and an open data channel is a private side-channel (§17).
    canPublishData: false,
  });

  return { url: config.livekit.url, token: await at.toJwt(), room: roomId };
}

/**
 * §30/§54: destroy the voice room when the game room is destroyed. Without
 * this, LiveKit rooms outlive the in-memory ones and quietly accrue cost.
 */
export async function destroyVoiceRoom(roomId: string): Promise<void> {
  const svc = service();
  if (!svc) return;
  try {
    await svc.deleteRoom(roomId);
  } catch {
    // Deleting a room that was never created (nobody joined voice) is normal.
  }
}
