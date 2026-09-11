/** Tunable constants. Spec §54, §55, §58, §62. */

/**
 * §55, §72: supported table sizes.
 *
 * The full 54-card deck — all nine sets, Eights & Jokers included — is used at
 * every table size. 54 divides evenly only by 6, so at 4 and 8 players some
 * players hold one card more than others. That asymmetry is a far smaller cost
 * than dropping the joker set, which is the most distinctive part of the deck.
 *
 *   4 players -> 13 or 14 cards each, 2v2
 *   6 players -> 9 cards each,        3v3
 *   8 players -> 6 or 7 cards each,   4v4
 */
export const PLAYER_COUNTS = [4, 6, 8] as const;
export type PlayerCount = (typeof PLAYER_COUNTS)[number];

export const DEFAULT_PLAYER_COUNT: PlayerCount = 6;

export const isPlayerCount = (n: number): n is PlayerCount =>
  (PLAYER_COUNTS as readonly number[]).includes(n);

export const TOTAL_SETS = 9;
export const TOTAL_CARDS = 54;

export const totalSetsFor = (_players: PlayerCount): number => TOTAL_SETS;
export const totalCardsFor = (_players: PlayerCount): number => TOTAL_CARDS;

/** The larger hand size when the deal is uneven; used to scale card-count bars. */
export const cardsPerPlayerFor = (players: PlayerCount): number =>
  Math.ceil(TOTAL_CARDS / players);

/** The smaller hand size when the deal is uneven. */
export const minCardsPerPlayerFor = (players: PlayerCount): number =>
  Math.floor(TOTAL_CARDS / players);

/** True when the deck cannot be split evenly at this table size. */
export const isUnevenDeal = (players: PlayerCount): boolean => TOTAL_CARDS % players !== 0;

/** §62.2: first team to a majority of the nine sets wins. Always 5. */
export const winScoreFor = (_players: PlayerCount): number =>
  Math.floor(TOTAL_SETS / 2) + 1;

/** Six-player defaults, kept for convenience. */
export const PLAYER_COUNT = 6;
export const CARDS_PER_PLAYER = 9;
export const WIN_SCORE = 5;

/** §62.4: an unclaimed or unfinished declaration window expires. */
export const DECLARATION_WINDOW_MS = 90_000;

/** §62.5: an unclaimed TEAM_OPEN turn falls back to the lowest seat with cards. */
export const TEAM_TURN_MS = 60_000;

/** §54: room lifecycle. */
export const EMPTY_ROOM_TIMEOUT_MS = 120_000;
export const PLAYER_RECONNECT_MS = 120_000;

/** A disconnected player still on turn this long is played by a bot until they return. */
export const BOT_TAKEOVER_MS = 30_000;

/** Time the game-over result stays up before the whole room lands back in the lobby together. */
export const POST_GAME_LOBBY_DELAY_MS = 8_000;
export const ROOM_IDLE_TTL_MS = 2 * 60 * 60 * 1000;
export const ROOM_MAX_LIFETIME_MS = 6 * 60 * 60 * 1000;

/** §58: abuse limits. */
export const MAX_NAME_LENGTH = 20;
export const MAX_CHAT_LENGTH = 500;
export const MAX_CHAT_HISTORY = 300;
export const ROOM_CODE_LENGTH = 6;

/** §58: unambiguous room-code alphabet — no 0/O, 1/I/L. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** §59: rejected on mismatch so a cached client fails loudly after a deploy. */
export const PROTOCOL_VERSION = 1;
