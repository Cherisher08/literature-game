import type { Card } from "./cards.js";

export type HandRank =
  | "HIGH_CARD"
  | "ONE_PAIR"
  | "TWO_PAIR"
  | "THREE_OF_A_KIND"
  | "STRAIGHT"
  | "FLUSH"
  | "FULL_HOUSE"
  | "FOUR_OF_A_KIND"
  | "STRAIGHT_FLUSH"
  | "ROYAL_FLUSH";

export const HAND_RANK_ORDER: Record<HandRank, number> = {
  HIGH_CARD: 1,
  ONE_PAIR: 2,
  TWO_PAIR: 3,
  THREE_OF_A_KIND: 4,
  STRAIGHT: 5,
  FLUSH: 6,
  FULL_HOUSE: 7,
  FOUR_OF_A_KIND: 8,
  STRAIGHT_FLUSH: 9,
  ROYAL_FLUSH: 10,
};

export interface EvaluatedHand {
  rank: HandRank;
  score: number; // Direct numeric comparison score
  name: string; // e.g., "Full House, Aces full of Kings"
  best5: Card[]; // 5 cards that make up the hand
}

export type PokerRound =
  | "WAITING"
  | "PRE_FLOP"
  | "FLOP"
  | "TURN"
  | "RIVER"
  | "SHOWDOWN"
  | "HAND_OVER";

export type PokerActionType = "FOLD" | "CHECK" | "CALL" | "BET" | "RAISE" | "ALL_IN";

export interface PokerAction {
  type: PokerActionType;
  amount?: number;
}

export interface PotInfo {
  id: number;
  amount: number;
  eligiblePlayerIds: string[];
}

export interface PokerHandWinner {
  playerId: string;
  playerName: string;
  amount: number;
  potId: number;
  handName: string;
  bestCards: Card[];
}

export interface PublicPokerPlayer {
  id: string;
  name: string;
  seatPosition: number;
  chips: number;
  currentBet: number;
  folded: boolean;
  isAllIn: boolean;
  isBot: boolean;
  connected: boolean;
  lastAction?: {
    type: PokerActionType;
    amount?: number;
    description: string;
  };
  hasCards: boolean;
  holeCards?: Card[]; // Present only for local player or revealed at showdown
  handResult?: {
    rankName: string;
    winnings: number;
    best5: Card[];
  };
}

export interface ClientPokerState {
  status: "LOBBY" | "PLAYING" | "FINISHED";
  round: PokerRound;
  smallBlind: number;
  bigBlind: number;
  dealerSeat: number;
  sbSeat: number;
  bbSeat: number;
  activeSeat: number | null;
  activePlayerId: string | null;
  turnExpiresAt?: number;
  mainPot: number;
  sidePots: PotInfo[];
  communityCards: Card[];
  highestBet: number;
  minRaise: number;
  players: PublicPokerPlayer[];
  myPlayerId: string;
  myHoleCards: Card[];
  currentHandRank?: string;
  handNumber: number;
  winners?: PokerHandWinner[];
}

export interface PokerConfig {
  startingChips: number;
  smallBlind: number;
  bigBlind: number;
  maxPlayers: number;
  turnTimeoutSec: number;
}

export const DEFAULT_POKER_CONFIG: PokerConfig = {
  startingChips: 1000,
  smallBlind: 10,
  bigBlind: 20,
  maxPlayers: 9,
  turnTimeoutSec: 25,
};
