/**
 * State projection. Spec §53.
 *
 * This is the anti-cheat. Every payload sent to a client is built here, by
 * construction, from the authoritative room. Nothing else may serialise a
 * `GameRoom` or a `GameState` to a socket.
 *
 * The rule: exactly one hand goes out per payload, and it belongs to the
 * recipient. Everyone else is a card count.
 */

import type {
  ClientGameState,
  ClientRoomState,
  GameState,
  PublicPlayer,
} from "@memory-game/shared";
import { isVoiceConfigured } from "../voice/livekit.js";
import type { GameRoom } from "./types.js";

/** Public view of a lobby player, before any game exists. */
function lobbyPlayer(room: GameRoom, playerId: string): PublicPlayer {
  const p = room.players.find((x) => x.id === playerId)!;
  return {
    id: p.id,
    name: p.name,
    // §71: null until this player picks. Final seats are assigned at start.
    teamId: p.teamId ?? null,
    seatPosition: p.seatPosition,
    connected: p.connected,
    cardCount: 0,
    spectating: false,
    isBot: Boolean(p.bot),
    ...(p.bot ? { difficulty: p.bot.difficulty } : {}),
    ...(p.botControlled ? { botStandIn: true } : {}),
  };
}

function publicPlayers(room: GameRoom, game: GameState | undefined): PublicPlayer[] {
  if (!game) return room.players.map((p) => lobbyPlayer(room, p.id));

  return game.players.map((p) => {
    const roomPlayer = room.players.find((x) => x.id === p.id);
    return {
      id: p.id,
      name: p.name,
      teamId: p.teamId,
      seatPosition: p.seatPosition,
      connected: roomPlayer?.connected ?? false,
      // Count only. Never p.hand.
      cardCount: p.hand.length,
      // §62.1: derived, never latched.
      spectating: p.hand.length === 0,
      isBot: Boolean(roomPlayer?.bot),
      ...(roomPlayer?.bot ? { difficulty: roomPlayer.bot.difficulty } : {}),
      ...(roomPlayer?.botControlled ? { botStandIn: true } : {}),
    };
  });
}

/**
 * Builds the game view for one recipient. `myHand` is the only card-bearing
 * field, and it is read from the recipient's own player record.
 */
export function projectGameFor(
  room: GameRoom,
  game: GameState,
  playerId: string,
): ClientGameState {
  const me = game.players.find((p) => p.id === playerId);

  return {
    status: room.status,
    players: publicPlayers(room, game),
    turn: game.turn,
    teamScores: game.teamScores,
    askingRule: game.askingRule,
    resolvedSets: game.resolvedSets,
    activeSetIds: game.activeSetIds,
    ...(game.drawn ? { drawn: game.drawn } : {}),
    ...(game.declarationWindow ? { declarationWindow: game.declarationWindow } : {}),
    ...(game.lastAsk ? { lastAsk: game.lastAsk } : {}),
    rules: game.rules,
    ...(game.winningTeamId ? { winningTeamId: game.winningTeamId } : {}),
    history: game.history,
    // A spectator or an unknown id gets an empty hand, never someone else's.
    myHand: me ? [...me.hand] : [],
    myPlayerId: playerId,
  };
}

/** The full per-socket payload. The only way room state reaches a client. */
export function projectRoomFor(room: GameRoom, playerId: string): ClientRoomState {
  return {
    roomId: room.id,
    hostId: room.hostId,
    status: room.status,
    playerCount: room.playerCount,
    // §69.4: advisory only.
    voice: { available: isVoiceConfigured(), participants: [...room.voiceParticipants] },
    players: publicPlayers(room, room.game),
    spectators: (room.spectators || []).map((s) => ({
      id: s.id,
      name: s.name,
      connected: s.connected,
    })),
    ...(room.game ? { game: projectGameFor(room, room.game, playerId) } : {}),
    seq: room.seq,
  };
}
