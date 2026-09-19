/**
 * Extensible Game Instructions registry.
 *
 * Provides comprehensive gameplay rules, quick summaries, card set definitions,
 * and strategic tips. Easy to extend for future games (Poker, Judgement, etc.).
 */

export interface HalfSuitInfo {
  name: string;
  suit: "S" | "H" | "D" | "C" | "NONE";
  cards: string;
  description: string;
}

export interface RuleStep {
  title: string;
  badge?: string;
  description: string;
  keyPoints: string[];
}

export interface GameInstructions {
  id: string;
  title: string;
  tagline: string;
  playerCount: string;
  overview: string;
  objective: string;
  rules: RuleStep[];
  halfSuits?: HalfSuitInfo[];
  proTips: string[];
}

export const GAME_INSTRUCTIONS: Record<string, GameInstructions> = {
  literature: {
    id: "literature",
    title: "Literature (Fish)",
    tagline: "The classic team card game of deduction, memory, and precision declarations",
    playerCount: "4, 6, or 8 Players (2 Teams: Team A vs Team B)",
    overview:
      "Literature is played with a full 54-card deck (including 8s and 2 Jokers) divided into 9 half-suits of 6 cards each. Players sit alternately and work with their teammates to discover who holds each card, assemble complete sets, and declare them.",
    objective:
      "First team to correctly declare 5 out of the 9 half-suits wins the match. If all 9 sets are claimed, the team with the majority score wins.",
    rules: [
      {
        title: "1. The Deck & Half-Suits",
        badge: "9 Sets of 6 Cards",
        description:
          "All 54 cards are in play, partitioned into 9 mutually exclusive half-suits:",
        keyPoints: [
          "Low Spades, Low Hearts, Low Diamonds, Low Clubs: Ranks 2 through 7 (6 cards each).",
          "High Spades, High Hearts, High Diamonds, High Clubs: Ranks 9, 10, Jack, Queen, King, Ace (6 cards each).",
          "Special Set — Eights & Jokers: All four 8s (♠, ♥, ♦, ♣) plus the Black Joker and Colored Joker (6 cards).",
        ],
      },
      {
        title: "2. Asking for a Card",
        badge: "Core Mechanic",
        description:
          "On your turn, you may ask any opponent for a specific card. There are two essential rules to remember:",
        keyPoints: [
          "The Holding Rule: You can ONLY ask for a card within a half-suit if you ALREADY HOLD at least one card of that same half-suit in your own hand.",
          "Target: You ask an opponent for a specific card you do not have.",
          "Success (They Have It): The opponent hands you that card. You retain your turn and may ask anyone again.",
          "Failure (They Don't Have It): The ask fails. Your turn immediately ends, and the turn passes to the opponent you asked!",
        ],
      },
      {
        title: "3. Declaring a Half-Suit",
        badge: "Scoring Points",
        description:
          "When you believe your team knows the exact location of all 6 cards in a half-suit, a player can DECLARE:",
        keyPoints: [
          "Any player can declare when it is their turn (or during their team's open turn).",
          "The declarer must assign every single one of the 6 cards in the set to a specific player (including their own cards and teammates' cards).",
          "100% Accurate: If every card is named correctly, your team wins that set (1 point)!",
          "Any Single Mistake: If even ONE card is wrongly assigned, the point is automatically awarded to the OPPONENT team!",
          "Cards in declared sets are removed from play for the rest of the game.",
        ],
      },
      {
        title: "4. Running Out of Cards & Endgame",
        badge: "Spectating & Team Play",
        description:
          "When players run out of cards, the game continues seamlessly:",
        keyPoints: [
          "If your hand becomes empty, you can no longer ask or be asked for cards. You continue spectating while your teammates play.",
          "If an entire team has no cards left, the opposing team cannot ask any cards and enters DECLARE ONLY mode until all remaining sets are declared.",
          "First team to reach 5 points wins!",
        ],
      },
    ],
    halfSuits: [
      {
        name: "Low Spades",
        suit: "S",
        cards: "2♠, 3♠, 4♠, 5♠, 6♠, 7♠",
        description: "6 low spade cards",
      },
      {
        name: "High Spades",
        suit: "S",
        cards: "9♠, 10♠, J♠, Q♠, K♠, A♠",
        description: "6 high spade cards",
      },
      {
        name: "Low Hearts",
        suit: "H",
        cards: "2♥, 3♥, 4♥, 5♥, 6♥, 7♥",
        description: "6 low heart cards",
      },
      {
        name: "High Hearts",
        suit: "H",
        cards: "9♥, 10♥, J♥, Q♥, K♥, A♥",
        description: "6 high heart cards",
      },
      {
        name: "Low Diamonds",
        suit: "D",
        cards: "2♦, 3♦, 4♦, 5♦, 6♦, 7♦",
        description: "6 low diamond cards",
      },
      {
        name: "High Diamonds",
        suit: "D",
        cards: "9♦, 10♦, J♦, Q♦, K♦, A♦",
        description: "6 high diamond cards",
      },
      {
        name: "Low Clubs",
        suit: "C",
        cards: "2♣, 3♣, 4♣, 5♣, 6♣, 7♣",
        description: "6 low club cards",
      },
      {
        name: "High Clubs",
        suit: "C",
        cards: "9♣, 10♣, J♣, Q♣, K♣, A♣",
        description: "6 high club cards",
      },
      {
        name: "Eights & Jokers",
        suit: "NONE",
        cards: "8♠, 8♥, 8♦, 8♣, Black Joker, Colored Joker",
        description: "All four 8s plus both jokers",
      },
    ],
    proTips: [
      "Pay attention to the Last Exchange panel! When an opponent asks for a card, it proves they hold at least one card in that half-suit.",
      "When someone says 'No', you know for certain that neither the asker nor the target held that specific card at that moment.",
      "Be careful when asking: an incorrect ask hands the turn directly to the target opponent.",
      "Work in sync with teammates via chat or voice to piece together full sets before declaring.",
      "Never rush a declaration without certainty — an incorrect declaration immediately gifts the set to your opponents.",
    ],
  },
  poker: {
    id: "poker",
    title: "Texas Hold'em Poker",
    tagline: "Outwit, outbluff, and outlast at the most iconic table in the world",
    playerCount: "2 to 9 Players",
    overview:
      "Texas Hold'em is a community card game where players create the best five-card poker hand using any combination of their two private hole cards and the five community cards dealt face-up on the board.",
    objective:
      "Win chips by having the highest-ranking hand at showdown or by betting enough to make all other players fold before showdown.",
    rules: [
      {
        title: "1. Blinds & Pre-Flop",
        badge: "Starting Hands",
        description: "Two players post forced bets (Small Blind & Big Blind). Every player is dealt two private hole cards.",
        keyPoints: [
          "Action begins with the player to the left of the Big Blind.",
          "Options: Fold, Call (match the Big Blind), or Raise.",
        ],
      },
      {
        title: "2. Flop, Turn & River",
        badge: "Community Cards",
        description: "Five shared community cards are revealed in three stages with betting rounds between each:",
        keyPoints: [
          "The Flop: 3 community cards face-up.",
          "The Turn: 1 additional community card face-up.",
          "The River: The 5th and final community card face-up.",
        ],
      },
      {
        title: "3. Showdown",
        badge: "Winning",
        description: "Remaining players reveal their hole cards. The player with the highest 5-card hand wins the pot.",
        keyPoints: [
          "Hand rankings (highest to lowest): Royal Flush, Straight Flush, Four of a Kind, Full House, Flush, Straight, Three of a Kind, Two Pair, One Pair, High Card.",
        ],
      },
    ],
    proTips: [
      "Position is power: acting last gives you valuable information about how other players value their hands.",
      "Don't play every hand; select quality starting hole cards.",
    ],
  },
  judgement: {
    id: "judgement",
    title: "Judgement",
    tagline: "Bid exactly how many tricks you'll win — not one more, not one less",
    playerCount: "2 to 7 Players",
    overview:
      "Judgement (also known as Kachuful) is a trick-taking card game where precision bidding is everything. Winning more or fewer tricks than your bid penalizes you.",
    objective:
      "Score the highest points across rounds by accurately predicting and winning your exact bid.",
    rules: [
      {
        title: "1. Dealing & Trump",
        badge: "Round Setup",
        description: "Players receive a varying number of cards per round. A trump card or trump suit is revealed.",
        keyPoints: [
          "Cards can range from 1 to 7 or more depending on table settings.",
          "The revealed trump suit beats any non-trump card in a trick.",
        ],
      },
      {
        title: "2. Bidding",
        badge: "Predictions",
        description: "Each player in turn bids the exact number of tricks they predict they will take.",
        keyPoints: [
          "The dealer cannot make the total sum of bids equal the total tricks available (forcing at least one player to lose).",
        ],
      },
      {
        title: "3. Trick Play & Scoring",
        badge: "Executing",
        description: "Players must follow the lead suit if possible. Highest card of lead suit or highest trump wins the trick.",
        keyPoints: [
          "Hit your exact bid: Earn bonus points + points per trick.",
          "Miss your bid by even 1 trick: Zero points (or penalty).",
        ],
      },
    ],
    proTips: [
      "Count high cards (Aces and Kings) and trumps carefully when bidding.",
      "Keep track of cards played in each suit to know when your low cards might win tricks.",
    ],
  },
  elimination: {
    id: "elimination",
    title: "Elimination",
    tagline: "Race to the lowest hand total — claim before someone beats you to it",
    playerCount: "2 to 8 Players",
    overview:
      "A fast-paced draw & discard card game where players manage their hands to reach the lowest point total before declaring a claim.",
    objective:
      "Minimize your hand's point value and claim when your total is 7 or lower with the lowest hand at the table.",
    rules: [
      {
        title: "1. Hand Value & Turns",
        badge: "Draw & Discard",
        description: "Each player starts with 5 cards. Number cards carry face value, Aces are 1, and Face cards (J, Q, K) are 10 points.",
        keyPoints: [
          "Draw from the deck or top of the discard pile.",
          "Discard one card or multiple cards of matching rank.",
        ],
      },
      {
        title: "2. Claiming",
        badge: "Showdown",
        description: "When your total hand value is 7 or lower, you can choose to claim on your turn.",
        keyPoints: [
          "If your total is strictly lower than everyone else's: You win the round with 0 penalty points.",
          "If anyone has an equal or lower total: You receive a heavy penalty!",
        ],
      },
    ],
    proTips: [
      "Discard high matching cards together to rapidly lower your total.",
      "Watch what cards opponents pick from the discard pile to deduce their totals.",
    ],
  },
};
