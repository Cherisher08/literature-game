/**
 * The single authoritative error enum. Spec §59, extended by §62.6.
 *
 * These are input/legality errors returned to the offending client only.
 * They are never game events, never enter history, and never change the turn (§48).
 */

export type ErrorCode =
  // Room / lifecycle
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "GAME_ALREADY_STARTED"
  | "GAME_OVER"
  | "INVALID_SESSION"
  | "NOT_HOST"
  // Turn
  | "NOT_YOUR_TURN"
  | "TURN_TAKEN"
  // Ask validation, in the order of §49
  | "EMPTY_HAND"
  | "INVALID_TARGET"
  | "TARGET_EMPTY"
  | "WRONG_TEAM"
  | "UNKNOWN_CARD"
  | "SET_RESOLVED"
  | "ILLEGAL_ASK_SET"
  | "ALREADY_OWNED"
  | "NO_TARGETS_AVAILABLE"
  // Lobby team selection (§71)
  | "TEAM_FULL"
  | "TEAMS_UNBALANCED"
  | "NOT_IN_LOBBY"
  // Declaration
  | "MALFORMED_DECLARATION"
  | "DECLARATION_IN_PROGRESS"
  | "DECLARATION_TAKEN"
  | "NO_DECLARATION_WINDOW"
  | "NOT_CLAIMANT"
  // Voice (§69)
  | "VOICE_UNAVAILABLE"
  // Abuse
  | "RATE_LIMITED";

/** Player-facing copy. The client may localise; this is the fallback. */
export const ERROR_MESSAGE: Record<ErrorCode, string> = {
  ROOM_NOT_FOUND: "That room no longer exists.",
  ROOM_FULL: "That room is full.",
  GAME_ALREADY_STARTED: "That game has already started.",
  GAME_OVER: "This game has finished.",
  INVALID_SESSION: "Your session is no longer valid.",
  NOT_HOST: "Only the host can do that.",

  NOT_YOUR_TURN: "It is not your turn.",
  TURN_TAKEN: "A teammate took the turn first.",

  EMPTY_HAND: "You have no cards, so you cannot ask.",
  INVALID_TARGET: "You cannot ask that player.",
  TARGET_EMPTY: "That player has no cards left.",
  WRONG_TEAM: "You cannot ask a player on that team right now.",
  UNKNOWN_CARD: "That card does not exist.",
  SET_RESOLVED: "That set has already been resolved.",
  ILLEGAL_ASK_SET: "You must already hold a card from that set to ask for it.",
  ALREADY_OWNED: "You already hold that card.",
  NO_TARGETS_AVAILABLE: "The other team has no cards. Your team must declare.",

  TEAM_FULL: "That team is already full.",
  TEAMS_UNBALANCED: "Both teams need exactly three players before starting.",
  NOT_IN_LOBBY: "Teams can only be changed before the game starts.",

  MALFORMED_DECLARATION: "That declaration is incomplete or invalid.",
  DECLARATION_IN_PROGRESS: "A declaration is already underway.",
  DECLARATION_TAKEN: "A teammate is already making this declaration.",
  NO_DECLARATION_WINDOW: "Your team has not opened a declaration.",
  NOT_CLAIMANT: "Only the teammate who took the declaration can do that.",

  VOICE_UNAVAILABLE: "Voice chat is not available on this server.",

  RATE_LIMITED: "Slow down a moment.",
};
