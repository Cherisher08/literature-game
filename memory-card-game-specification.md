# Memory Card Game — Complete Game Logic & Feature Specification

## 1. Project Overview

This project is a real-time, multiplayer, team-based online card game inspired by the **Literature / Memory-style card game**.

The application is designed to be:

- Real-time
- Multiplayer
- Team-based
- Strategy and memory focused
- Browser accessible
- Privacy-friendly
- Database-less
- Room-based
- Temporary by design

The game uses an authoritative server model: the **server owns and validates all game state and rules**.

---

# 2. Privacy Model

## 2.1 Name Collection

When a player opens or joins the application, they are asked for a display name.

Example:

```text
Enter your name:
[Mogesh             ]

        Continue
```

Only the display name is required.

## 2.2 No Additional Data Collection

The application does **not intentionally collect**:

- Email addresses
- Phone numbers
- Passwords
- Addresses
- Profile information
- Date of birth
- Social media accounts
- Permanent player profiles
- Persistent gameplay history

The player's name exists only for the active session/room unless the application explicitly changes this policy in the future.

---

# 3. Technology Stack

## Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Socket.IO Client
- Zustand (recommended for client-side UI state)

## Backend

- Node.js
- Express.js
- TypeScript
- Socket.IO

## Voice

> **Deferred by Section 69.1.** Voice is the last thing implemented. Ignore it in phases 1–5; nothing earlier may depend on it.

Recommended architecture:

- WebRTC
- SFU-based voice infrastructure
- LiveKit or mediasoup

The voice system is server-managed infrastructure and belongs to the room lifecycle.

## Storage

No database is required.

All active room data is stored in server memory.

Example:

```ts
const rooms = new Map<string, GameRoom>();
```

---

# 4. High-Level Architecture

```text
                    ┌──────────────────────┐
                    │    React Web App     │
                    │                      │
                    │ Game UI              │
                    │ Room UI              │
                    │ Text Chat            │
                    │ Voice Controls       │
                    └──────────┬───────────┘
                               │
                        Socket.IO / HTTPS
                               │
                               ▼
                    ┌──────────────────────┐
                    │   Express.js Server  │
                    │                      │
                    │ Room Manager         │
                    │ Game Engine          │
                    │ Rule Validation      │
                    │ Text Chat            │
                    │ Socket Events        │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  In-Memory Rooms     │
                    │                      │
                    │ Map<RoomId, Room>    │
                    └──────────────────────┘

                               │
                               ▼

                    ┌──────────────────────┐
                    │ Voice Infrastructure │
                    │ WebRTC / SFU         │
                    └──────────────────────┘
```

---

# 5. Room Lifecycle

## 5.1 Entering the Application

Flow:

```text
Open Application
      ↓
Enter Display Name
      ↓
Continue
      ↓
Create Room OR Join Room
```

---

## 5.2 Creating a Room

A player can create a new game room.

The server:

1. Generates a unique room ID/code.
2. Creates an in-memory room.
3. Adds the creator as the first player.
4. Marks the creator as the room host.
5. Waits for additional players.

Example:

```text
Player
  ↓
Create Room
  ↓
Server creates Room ABC123
  ↓
Player joins lobby
```

---

## 5.3 Joining a Room

A player enters a room code or opens a shared room link.

Flow:

```text
Open Room Link
      ↓
Enter Name (if not already entered)
      ↓
Join Room
      ↓
Server validates room
      ↓
Player enters lobby
```

The server validates:

- Room exists
- Room is not full
- Game rules allow joining at the current stage

---

# 6. Players and Teams

The standard version is designed for **6 players**.

Players are divided into two teams.

Players sit alternately.

Example:

| Position | Player | Team |
|---|---|---|
| 1 | Player A | Team A |
| 2 | Player B | Team B |
| 3 | Player C | Team A |
| 4 | Player D | Team B |
| 5 | Player E | Team A |
| 6 | Player F | Team B |

Therefore:

```text
Team A → Positions 1, 3, 5

Team B → Positions 2, 4, 6
```

The UI should visually show:

- Players
- Team membership
- Turn indicator
- Online/disconnected status
- Voice status

Players must not be able to manually change teams after the game starts.

> **Extended by Section 71.** Players *may* pick their team in the lobby; the prohibition applies only once the game starts. Final seats are derived from team choice so the alternation above still holds.

---

# 7. Card Sets

The game contains **9 sets**.

Each set contains **6 cards**.

Therefore:

```text
9 Sets × 6 Cards = 54 Cards
```

The exact card grouping must follow the version of the Memory game being implemented.

## Special 9th Set

The ninth set contains:

- 8♠
- 8♥
- 8♦
- 8♣
- Black Joker
- Colored Joker

These six cards together form one complete set.

```text
SET 9

8♠
8♥
8♦
8♣
Black Joker
Colored Joker
```

The remaining cards are divided into the other eight sets according to the agreed game rules.

---

# 8. Game Start Flow

```text
Room Created
      ↓
Players Join
      ↓
Required Number of Players Reached
      ↓
Teams Assigned
      ↓
Cards Shuffled
      ↓
Cards Distributed
      ↓
Game Starts
      ↓
First Player Selected
```

The server is responsible for shuffling and distributing cards.

The client must never decide:

- Which player receives which card
- The card order
- The shuffled deck

---

# 9. Server Authority

The server is the single source of truth.

The frontend sends **intentions/actions**.

Example:

```text
Client:
"I want to ask Player B for 5♥"

Server:
Checks whether action is legal
      ↓
Checks actual card ownership
      ↓
Updates state
      ↓
Broadcasts result
```

The client must not be trusted to validate game rules.

---

# 10. Player Turns

Only the player whose turn is active can perform a card request.

The server maintains:

```ts
currentPlayerId: string;
```

The UI clearly displays:

```text
YOUR TURN
```

or

```text
Waiting for Player B
```

---

# 11. Asking for a Card

A player asks another player for one exact card.

The request contains:

- Target player
- Exact card rank/value
- Exact suit/symbol

Example:

```text
Player A asks Player B:

"Do you have the 5 of Hearts?"
```

The server receives an event similar to:

```ts
{
  roomId,
  targetPlayerId,
  cardId
}
```

---

# 12. Asking an Opponent

Under the normal rules, a player asks a member of the opposing team.

The server validates:

```text
Is this the player's turn?
        ↓
Is the target player valid?
        ↓
Is the requested card valid?
        ↓
Does the target player actually have the card?
```

---

# 13. Important Tactical Rule — Asking for a Card You Already Have

A player is allowed to ask another player for a card that the player already possesses.

Example:

```text
Player A already has 5♥.

Player A can still ask Player B:

"Do you have 5♥?"
```

This is intentional and must be supported.

The server must **not reject a request simply because the requesting player already owns that card**.

This can be used as a tactical move.

Reasons may include:

- Creating misleading information
- Signaling indirectly through requests
- Influencing opponents' deductions
- Changing the information available to other players
- Strategic gameplay

The game should allow this behavior.

---

# 14. If the Target Player Has the Card

Example:

```text
Player A asks Player B for 5♥.

Player B has 5♥.
```

Then:

```text
Player B MUST give the card to Player A.
```

The target player cannot falsely deny ownership.

Server flow:

```text
Request Received
      ↓
Check Actual Ownership
      ↓
Card Exists in Target Hand?
      │
      YES
      ↓
Transfer Card
      ↓
Broadcast Updated Game State
      ↓
Continue according to turn rules
```

The server automatically performs the transfer.

---

# 15. If the Target Player Does Not Have the Card

Example:

```text
Player A asks Player B for 5♥.

Player B does not have 5♥.
```

The answer is automatically determined by the server.

The target player cannot lie.

Flow:

```text
Player A asks Player B
      ↓
Player B does not have card
      ↓
Request fails
      ↓
Turn passes to Player B
      ↓
Player B can now make a request
```

The UI should clearly show the result.

Example:

```text
Player B does not have 5♥
```

---

# 16. No False Information

The application removes the possibility of cheating by making the server responsible for card ownership.

Players never manually answer:

```text
Yes, I have it
```

or:

```text
No, I don't have it
```

The server determines the result automatically.

Therefore:

```text
No lying about cards is possible.
```

---

# 17. Team Communication Rules

A major rule of the physical game is that teammates cannot verbally communicate card information.

The digital version should preserve the strategic nature of this rule.

The game itself should not provide special private communication intended to reveal card ownership.

However, the application includes room communication features, so the implementation should clearly define the intended communication policy.

Recommended default:

- Text chat is room-wide
- Voice chat is room-wide
- No private teammate-only chat
- No private direct messages

This prevents the application from providing a built-in hidden channel specifically for teammates.

Players are expected to follow the intended gameplay rules while using room communication.

---

# 18. Declaration — "L"

When a team believes it knows the exact locations of all six cards in a set, one player can make a declaration.

This is called:

# L — Declaration

Only one player makes the declaration.

The declaring player must specify exactly where every card in the selected set is located.

---

# 19. Declaration UI Flow

Example:

```text
Select Set
      ↓
Show all 6 cards
      ↓
For each card select a player
      ↓
Review declaration
      ↓
Confirm
      ↓
Send declaration to server
```

Example declaration:

```text
SET 9

8♠             → Player A
8♥             → Player C
8♦             → Player B
8♣             → Player E
Black Joker    → Player D
Colored Joker  → Player F
```

The server receives all assignments.

---

# 20. Correct Declaration

The server compares the declaration against the actual card locations.

If every card assignment is correct:

```text
DECLARATION CORRECT
        ↓
Declaring Team Wins the Set
        ↓
Point awarded
        ↓
Set is removed/resolved
```

The UI should clearly announce:

```text
TEAM A WON SET 9!
```

---

# 21. Wrong Declaration

If even one card location is incorrect:

```text
DECLARATION WRONG
        ↓
Opposing Team Wins the Set
        ↓
Point awarded to Opponent
        ↓
Set is removed/resolved
```

This creates significant risk and strategy.

A player should only declare when sufficiently confident.

---

# 22. Post-Declaration Asking Rule

After a declaration, whether the declaration is:

- Correct, OR
- Wrong

the special game rule applies:

> A player can ask someone from their own team.

This is an important variation of the game and must be represented in the server's rule engine.

The exact implementation should preserve the intended turn behavior and asking permissions after a declaration.

The game engine should explicitly model this state rather than relying on UI assumptions.

Example:

```ts
type AskingRule =
  | "OPPONENT_ONLY"
  | "TEAMMATE_ALLOWED";
```

The server determines which rule is active.

---

# 23. Game State Model

A possible server-side room structure:

```ts
interface GameRoom {
  id: string;

  hostId: string;

  status:
    | "LOBBY"
    | "PLAYING"
    | "FINISHED";

  players: Player[];

  teams: Team[];

  game: GameState;

  chatMessages: ChatMessage[];

  voiceParticipants: VoiceParticipant[];

  createdAt: number;
}
```

---

# 24. Player Model

Example:

```ts
interface Player {
  id: string;

  name: string;

  seatPosition: number;

  teamId: string;

  connected: boolean;

  hand: Card[];
}
```

The player's hand is server-owned.

The server sends each player only the information they are allowed to see.

---

# 25. Game State Model

Example:

```ts
interface GameState {
  currentPlayerId: string;

  sets: CardSet[];

  completedSets: CompletedSet[];

  teamScores: {
    teamA: number;
    teamB: number;
  };

  askingRule:
    | "OPPONENT_ONLY"
    | "TEAMMATE_ALLOWED";

  gameHistory: GameEvent[];
}
```

---

# 26. Card Privacy

This is critical.

A player should see:

```text
MY HAND
```

with all their cards.

Other players should **not receive the actual cards in another player's hand**.

They may only see public information such as:

- Player name
- Team
- Number of cards
- Card transfers that are publicly visible according to game rules
- Requests
- Declaration results

Never broadcast every player's complete hand to every client.

---

# 27. Socket Event Design

## Client → Server

### Join Room

```text
room:join
```

### Leave Room

```text
room:leave
```

### Start Game

```text
game:start
```

### Ask for Card

```text
game:ask-card
```

### Declare Set

```text
game:declare-set
```

### Send Chat Message

```text
chat:send
```

### Voice State Updates

```text
voice:state
```

---

## Server → Client

### Room State

```text
room:state
```

### Game State Update

```text
game:state
```

### Card Request Result

```text
game:request-result
```

### Turn Changed

```text
game:turn-changed
```

### Declaration Result

```text
game:declaration-result
```

### Chat Message

```text
chat:message
```

### Player Joined

```text
room:player-joined
```

### Player Left

```text
room:player-left
```

---

# 28. Text Chat

Each room contains its own room-wide text chat.

Example:

```text
┌────────────────────────────┐
│ ROOM CHAT                  │
├────────────────────────────┤
│ Player A: Hello 👋         │
│ Player C: Ready!           │
│ Player B: Let's start      │
├────────────────────────────┤
│ Type a message...          │
└────────────────────────────┘
```

Messages are associated only with the active room.

Example:

```ts
interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}
```

Chat messages are stored only in server memory.

---

# 29. Voice Chat

> **Deferred by Section 69.1.** Built last. See Section 69 for packages, token scope, lifecycle and hosting.

Every room can have internal voice chat.

Recommended UI:

```text
🎙 Voice Connected

Player A 🎤
Player B 🔇
Player C 🎤
Player D 🎤
```

Players should have controls for:

- Mute/unmute microphone
- Leave voice
- Rejoin voice
- View who is speaking

The game server/application infrastructure is responsible for managing room voice participation.

The preferred media architecture is:

```text
Browser
   ↓
WebRTC
   ↓
SFU Voice Infrastructure
   ↓
Other Room Participants
```

---

# 30. Voice Privacy

Voice communication is room-specific.

A player should only connect to the voice channel for the room they are currently in.

```text
Room ABC123
   │
   ├── Voice Channel ABC123
   └── Text Chat ABC123
```

When a player leaves the room:

```text
Disconnect from room voice channel
```

When the room is deleted:

```text
Destroy room voice resources
```

---

# 31. Room Data Lifecycle

All room data is temporary.

```text
Room Created
      ↓
Players Join
      ↓
Game Runs
      ↓
Game State Changes
      ↓
Players Leave
      ↓
Last Player Leaves
      ↓
Room Deleted
      ↓
All Room Data Destroyed
```

Example server logic:

```ts
if (room.players.length === 0) {
  rooms.delete(roomId);
}
```

The deleted data includes:

- Players
- Player names
- Cards
- Game state
- Scores
- Chat messages
- Game history
- Temporary voice room information

---

# 32. No Database

The application does not require a database for the core game.

```text
┌──────────────────────┐
│      Server RAM      │
│                      │
│  Room ABC123         │
│  Room XYZ789         │
│  Room GAME42         │
└──────────────────────┘
```

When the server process stops:

```text
All active in-memory data is lost.
```

This is expected behavior for the initial database-less architecture.

---

# 33. Server Restart Behavior

> **Confirmed by Section 63.** No state recovery is planned; the message below is the only mitigation and must read as terminal, not as a retry.

Because the application uses only memory:

```text
Server Restart
      ↓
Active Rooms Lost
      ↓
Active Games End
      ↓
Chat History Lost
      ↓
Room Data Lost
```

The UI should handle disconnections gracefully.

Recommended message:

```text
The game server was restarted.
This room is no longer available.
Please create or join a new room.
```

---

# 34. Disconnect Handling

A player may temporarily lose their internet connection.

Recommended behavior:

```text
Player Disconnects
      ↓
Mark Player as Disconnected
      ↓
Allow short reconnection window
      ↓
Player reconnects
      ↓
Restore active room session
```

Because no persistent identity/account system exists, reconnection should use a temporary session token created when joining the room.

This token:

- Is temporary
- Exists only for the active room/session
- Is not a permanent account identifier

If the room is destroyed, the token becomes invalid.

---

# 35. Reconnection Flow

```text
Player Disconnects
      ↓
Socket Connection Lost
      ↓
Player Marked Offline
      ↓
Reconnect Attempt
      ↓
Temporary Session Valid?
      │
      YES
      ↓
Restore Player
      ↓
Send Current Authorized State
```

---

# 36. Security Principles

The client should never be trusted with sensitive game state.

The server must validate:

- Whose turn it is
- Valid targets
- Team relationships
- Requested cards
- Actual card ownership
- Card transfers
- Declarations
- Scores
- Completed sets

The frontend should only display the state it is authorized to know.

---

# 37. Anti-Cheating Design

The following actions must not be possible by modifying frontend code:

```text
❌ Give yourself a card
❌ View all player hands
❌ Change the current turn
❌ Force another player to give a card
❌ Fake a successful declaration
❌ Modify team scores
```

All such actions are protected by server-side validation.

---

# 38. Recommended User Interface

> **Superseded by Sections 64–66.** The wireframe below is retained for its regions only; the visual system, the Last Ask panel and all motion are specified there against the screenshots in `design-reference/`.

The main game screen can contain:

```text
┌───────────────────────────────────────────────┐
│ Room: ABC123              🎙 Voice   ⚙        │
├───────────────────────────────────────────────┤
│                                               │
│              TEAM A: 2                        │
│              TEAM B: 3                        │
│                                               │
│       Player A        Player B                │
│                                               │
│       Player C        Player D                │
│                                               │
│       Player E        Player F                │
│                                               │
├───────────────────────────────────────────────┤
│                                               │
│              YOUR TURN                        │
│                                               │
│ Target Player: [Player B ▼]                   │
│ Card:          [5 ♥ ▼]                        │
│                                               │
│               [ ASK ]                         │
│                                               │
├───────────────────────────────────────────────┤
│ MY CARDS                                      │
│ [2♠] [5♥] [8♦] [Joker] ...                    │
├───────────────────────────┬───────────────────┤
│ GAME ACTIVITY             │ ROOM CHAT         │
│ Player A asked Player B   │ Hello!            │
│ Player B gave 5♥          │ Ready?            │
└───────────────────────────┴───────────────────┘
```

---

# 39. Main Game Flow

```text
OPEN APP
   ↓
ENTER NAME
   ↓
CREATE / JOIN ROOM
   ↓
WAIT IN LOBBY
   ↓
PLAYERS JOIN
   ↓
START GAME
   ↓
CARDS DISTRIBUTED
   ↓
TURN STARTS
   ↓
PLAYER ASKS FOR CARD
   ↓
SERVER VALIDATES
   │
   ├── TARGET HAS CARD
   │        ↓
   │     TRANSFER CARD
   │
   └── TARGET DOES NOT HAVE CARD
            ↓
         TURN CHANGES
   ↓
TEAM BUILDS KNOWLEDGE
   ↓
PLAYER DECLARES SET
   │
   ├── CORRECT → TEAM WINS SET
   │
   └── WRONG → OPPONENT WINS SET
   ↓
CONTINUE GAME
   ↓
ALL SETS RESOLVED
   ↓
WINNER DETERMINED
```

---

# 40. Winning the Game

> **Superseded by Section 62.2.** The game now ends the moment a team reaches 5 won sets, rather than when all 9 are resolved.

The game continues until all sets have been resolved.

There are 9 sets total.

The team with the highest number of won sets wins.

Example:

```text
Team A: 5 Sets
Team B: 4 Sets

🏆 TEAM A WINS!
```

---

# 41. MVP Feature List

## Required

- [x] React web application
- [x] Express.js backend
- [x] TypeScript
- [x] Real-time multiplayer
- [x] Room creation
- [x] Room joining
- [x] Name-only entry
- [x] No accounts
- [x] No database
- [x] In-memory rooms
- [x] Automatic room deletion
- [x] Team assignment
- [x] Card distribution
- [x] Turn management
- [x] Exact card requests
- [x] Automatic card ownership validation
- [x] Tactical asking for cards already owned
- [x] Declaration system
- [x] Correct/wrong declaration handling
- [x] Score tracking
- [x] Room text chat
- [ ] Room voice chat — **deferred to the final phase (§69.1)**; not part of the initial build
- [x] Disconnect handling
- [x] Server-side anti-cheat validation

---

# 42. Future Features

Possible future additions:

- Spectator mode
- Game replay while room exists
- Configurable game rules
- Different player counts
- Custom room settings
- Host controls
- Kick player option
- Rematch
- Emoji reactions
- Push-to-talk
- Voice activity indicators
- PWA installation
- Mobile application

These should not require changing the core game engine if the architecture is properly separated.

---

# 43. Recommended Project Structure

```text
memory-card-game/

├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── stores/
│   │   ├── hooks/
│   │   ├── socket/
│   │   └── types/
│
├── server/
│   ├── src/
│   │   ├── game/
│   │   │   ├── game-engine.ts
│   │   │   ├── room-manager.ts
│   │   │   ├── card-service.ts
│   │   │   ├── turn-service.ts
│   │   │   └── declaration-service.ts
│   │   │
│   │   ├── socket/
│   │   ├── chat/
│   │   ├── voice/
│   │   └── index.ts
│
└── shared/
    ├── types/
    ├── events/
    └── constants/
```

---

# 44. Core Development Principle

The most important architectural principle is:

> **The client requests actions. The server decides whether those actions are valid.**

Example:

```text
CLIENT
"I want to ask for 5♥"
        ↓
SERVER
"Is this allowed?"
        ↓
SERVER
"Does the target have it?"
        ↓
SERVER
"Update authoritative state"
        ↓
ALL CLIENTS
Receive appropriate updates
```

This architecture keeps the game fair, secure, and synchronized.

---

# 45. Final Product Definition

The final product is a:

> **Privacy-friendly, database-less, real-time multiplayer browser card game where players use memory, deduction, and strategy to identify card locations, compete in alternating teams, make tactical card requests, and declare complete sets.**

The application provides:

- Real-time gameplay
- Server-authoritative rules
- Temporary rooms
- Internal text chat
- Internal voice chat
- No accounts
- Name-only participation
- No persistent game data
- Automatic deletion of room data when the room becomes empty

---

# Specification Addendum (Sections 46–60)

The following sections close gaps found in Sections 1–45. They do not replace anything above; where an addendum contradicts an earlier section, the contradiction is called out explicitly so it can be decided deliberately.

---

# 46. The Game Being Implemented

The rules described in Sections 11–22 are the game known as **Literature** (also *Fish*, *Canadian Fish*, or *Half Suit*). Naming it matters, because the standard rule set answers several questions Sections 1–45 leave open. Where this addendum resolves an ambiguity, it follows standard Literature unless Section 13 (tactical self-asking) explicitly overrides it.

---

# 47. Exact Card Set Composition

Section 7 states that 9 sets × 6 cards = 54 cards but leaves the first eight sets undefined. Standard Literature uses a 54-card deck (52 + 2 jokers) split as follows.

Each suit is split into a **low** half-suit and a **high** half-suit. The 8s never belong to a suited set — they form the ninth set with the jokers.

| Set | Name | Cards |
|---|---|---|
| 1 | Low Spades | 2♠ 3♠ 4♠ 5♠ 6♠ 7♠ |
| 2 | High Spades | 9♠ 10♠ J♠ Q♠ K♠ A♠ |
| 3 | Low Hearts | 2♥ 3♥ 4♥ 5♥ 6♥ 7♥ |
| 4 | High Hearts | 9♥ 10♥ J♥ Q♥ K♥ A♥ |
| 5 | Low Diamonds | 2♦ 3♦ 4♦ 5♦ 6♦ 7♦ |
| 6 | High Diamonds | 9♦ 10♦ J♦ Q♦ K♦ A♦ |
| 7 | Low Clubs | 2♣ 3♣ 4♣ 5♣ 6♣ 7♣ |
| 8 | High Clubs | 9♣ 10♣ J♣ Q♣ K♣ A♣ |
| 9 | Eights & Jokers | 8♠ 8♥ 8♦ 8♣ Black Joker Colored Joker |

Deal: 54 cards ÷ 6 players = **9 cards each**, no remainder. This is why the player count must divide 54 — see Section 55.

```ts
type SetId = 1|2|3|4|5|6|7|8|9;

interface Card {
  id: string;      // stable, e.g. "H-5", "JOKER-BLACK"
  setId: SetId;
  rank: string;    // "2".."10","J","Q","K","A","JOKER"
  suit: "S"|"H"|"D"|"C"|"NONE";
  label: string;   // display only, e.g. "5♥"
}
```

`Card.id` — not object identity — is the wire format for every request, transfer and declaration.

---

# 48. Missing Core Rule — Set Membership Requirement

**This is the most significant omission in Sections 11–16.** Standard Literature requires:

> A player may only ask for a card belonging to a set in which that player already holds at least one card.

Without this rule the game has almost no deduction: a player could ask for anything, and an ask would leak no information. With it, every ask publicly announces "the asker holds at least one card of this set," which is the engine that drives the entire memory/deduction loop.

The server must validate:

```text
Does the asking player hold >= 1 card of the requested card's set?
        |
        NO -> reject the action (ILLEGAL_ASK_SET), turn does NOT pass
        |
        YES -> continue validation
```

A rejected illegal action is an input error, not a game event: it is returned to the offending client only, does not enter game history, and does not change the turn.

## 48.1 Interaction with Section 13

Standard Literature also forbids asking for a card you already hold. **Section 13 deliberately reverses this**, and that decision is preserved here — but the two rules should be understood as independent switches, because Section 13 alone (without Section 48) removes essentially all deduction from the game:

```ts
interface RuleConfig {
  mustHoldCardInSet: boolean;    // default true  (Section 48)
  mayAskForOwnedCard: boolean;   // default true  (Section 13)
}
```

Recommended default: both `true`. Section 48 preserves the deduction loop; Section 13 then adds a genuine bluffing layer on top of it, because an ask no longer proves the asker lacks that specific card — only that they hold *something* in the set.

---

# 49. Full Ask Validation Order

The server validates in this exact order and stops at the first failure. Order matters: it determines which error the client sees and, more importantly, guarantees that no rejected action leaks information about a hand.

```text
1.  Room exists and status === "PLAYING"
2.  Requester is a seated player in the room
3.  It is the requester's turn                      -> NOT_YOUR_TURN
4.  Requester's hand is non-empty                   -> EMPTY_HAND (see §50)
5.  Target exists, is seated, and is not the asker  -> INVALID_TARGET
6.  Target's hand is non-empty                      -> TARGET_EMPTY
7.  Target satisfies the active asking rule         -> WRONG_TEAM
8.  Card id is a real card                          -> UNKNOWN_CARD
9.  Card's set is not already resolved              -> SET_RESOLVED
10. Requester holds >=1 card of that set (§48)      -> ILLEGAL_ASK_SET
11. Requester does not hold the card itself         -> only if mayAskForOwnedCard === false
        |
   Resolve: does the target hold the card?
```

Steps 1–11 are **legality**. Only after all of them pass does the server look inside the target's hand — and that lookup is the outcome, never a validation error. Rules 6 and 9 are absent from Section 12 and are both live sources of desync if omitted.

---

# 50. Empty Hands and Turn Passing

> **Extended by Section 62.1.** A card-less player is now a defined spectator state, and may still declare for their team.

Sections 10 and 15 never address a player running out of cards, which happens routinely — a player who is asked repeatedly can be stripped to zero, and every declaration removes six cards from play (Section 51).

Rules:

- A player with an empty hand **cannot ask**. Their turn passes immediately.
- When the turn would land on an empty-handed player, the server transfers the turn to **a teammate with cards**, chosen by the lowest seat position after the empty player (deterministic and auditable). A "team picks" variant can come later; the deterministic rule is the MVP.
- If an entire team has no cards, the turn passes to the opposing team. Since only asks move cards, a card-less team can never regain cards. Therefore: **when one team holds zero cards, the remaining sets can only be resolved by declaration.** The server must detect this state and surface it, or the game visibly stalls.

```ts
type TurnPassReason =
  | "ASK_FAILED"          // §15
  | "PLAYER_EMPTY"        // §50
  | "DECLARATION"         // §51.2
  | "TEAM_EMPTY";
```

Every turn change broadcasts its reason. Players cannot follow the game otherwise, and it makes the engine's turn logic testable in isolation.

---

# 51. Declaration Mechanics — Missing Details

Sections 18–21 define the outcome of a declaration but not its mechanics.

**When may a player declare?** *(Superseded by Section 62.4: the turn holder opens a declaration window and any teammate may declare.)* The MVP restricts declaring to **the current player, on their turn, in place of an ask**. This makes declarations serialisable and removes the race described in Section 51.3. A "declare at any time" variant is listed in Section 60.

**Which sets may be declared?** Any set not already resolved. A team is not required to hold all six cards — declaring a set held partly or wholly by opponents is legal and is a normal (high-risk) play.

**What happens to the cards?** On resolution — correct or wrong — all six cards of the set are **removed from every hand** and the set is marked resolved. Sections 20 and 21 say "set is removed/resolved" without stating that hands shrink; the server must do this or card counts drift and Section 47's arithmetic breaks.

**What becomes public?** After resolution, the true location of all six cards is revealed to every player, along with the declaration that was submitted. Without the reveal the losing team learns nothing, and half the game's information value is lost. The exact per-card result payload and reveal UI are specified in Section 61.

## 51.1 Declaration Payload

```ts
interface DeclarationRequest {
  roomId: string;
  setId: SetId;
  assignments: Array<{ cardId: string; playerId: string }>; // exactly 6, all cards of setId, no duplicates
}
```

Server validation, before evaluating correctness:

- Exactly 6 assignments, matching exactly the 6 card ids of `setId`
- Every `playerId` is a seated player in this room
- The set is not already resolved

A malformed declaration is rejected as an input error and does **not** cost the team the set. Only a well-formed, wrong declaration does.

## 51.2 Whose Turn After a Declaration?

> **Superseded by Section 62.5.** The turn now passes to the declaring team as a whole, not to the declaring player.

Section 22 leaves this open. Rule: **the turn stays with the declaring player** if they still hold cards, otherwise it passes per Section 50. A declaration is not a failed ask; losing the turn as well as the set would double-penalise the risk.

## 51.3 Concurrency

Because declarations are restricted to the current player, at most one can be in flight per room. The engine should still guard with a per-room action lock (a `processing` flag or a serial queue) — Socket.IO delivers events concurrently, and two rapid `game:ask-card` events from one client can otherwise interleave mid-mutation.

---

# 52. Asking Rule State — Concrete Model

> **Superseded by Section 62.3.** The derivation below is replaced: when opponents hold no cards the rule is `DECLARE_ONLY`, not `TEAMMATE_ALLOWED`.

Section 22's `AskingRule` is a single room-wide value, but the permission is naturally **per team**. Model it per team and derive it, never set it ad hoc from an event handler:

```ts
interface GameState {
  askingRule: Record<TeamId, "OPPONENT_ONLY" | "TEAMMATE_ALLOWED">;
}

function deriveAskingRule(room: GameRoom, teamId: TeamId) {
  const opponents = playersOfTeam(room, otherTeam(teamId));
  const opponentsHaveCards = opponents.some(p => p.hand.length > 0);
  return opponentsHaveCards ? "OPPONENT_ONLY" : "TEAMMATE_ALLOWED";
}
```

Recompute after **every** state mutation (transfer, declaration, disconnect) rather than toggling it at the site of a declaration. Derived state cannot drift; toggled state can. Section 22's post-declaration behaviour then falls out of the derivation instead of being a special case.

---

# 53. Public vs Private Information — Explicit Contract

Section 26 says "never broadcast every hand" but does not enumerate what *is* public. Ambiguity here is the most likely source of an accidental cheat vector, so the contract is fixed:

**Public to all players in the room:**

- Every ask: asker, target, exact card requested, and the result (given / not given)
- Every card transfer: which exact card moved, from whom, to whom
- Every hand's **card count**
- Declarations: the full submitted assignment, correctness, and the true locations after resolution
- Resolved sets, scores, turn, connection status, voice status

**Private to the owning player only:**

- The contents of their own hand

That is the whole list. Asks being fully public is not a leak — it *is* the game. The server should build the payload for each socket by projection, never by filtering on the client:

```ts
function projectFor(playerId: string, room: GameRoom): ClientGameState {
  return {
    ...publicState(room),
    myHand: room.players.find(p => p.id === playerId)!.hand,
    players: room.players.map(p => ({
      id: p.id, name: p.name, teamId: p.teamId,
      seatPosition: p.seatPosition, connected: p.connected,
      cardCount: p.hand.length,          // count only, never cards
    })),
  };
}
```

`ClientGameState` should have **no field capable of holding another player's cards**. Make the leak unrepresentable in the type rather than relying on remembering to strip it.

---

# 54. Contradiction — Room Deletion vs Reconnection

Section 31 deletes the room when `room.players.length === 0`; Section 34 keeps disconnected players in the room for a reconnection window. These are compatible only if disconnected players still count as members — but then a room where everyone closes the tab is never deleted and leaks memory.

Resolution:

```text
Player disconnects        -> connected = false, stays seated, session token stays valid
All players disconnected  -> start EMPTY_ROOM_TIMER (default 120s)
Any player reconnects     -> cancel timer
Timer fires               -> delete room, destroy voice resources, invalidate tokens
```

Additionally, every room carries an absolute **idle TTL** (default 2 hours since the last action) and a **max lifetime** (default 6 hours), swept by a single interval over the `rooms` map. Without a sweeper, an in-memory server accumulates abandoned rooms until it is restarted. All three durations belong in config, not inline constants.

Reconnection window for an individual player: default 120s while others remain. On expiry mid-game the host is prompted either to wait or to end the game — the MVP should not attempt bot substitution or hand redistribution.

---

# 55. Player Count

> **Superseded by Section 72.** The deck varies with the table size, so 4, 6 and 8 players are all supported. The analysis below holds only for a fixed 54-card deck.

Section 6 fixes 6 players. The deal only works when the count divides 54: **6 (9 cards each) or 9 (6 cards each)**. Nine players cannot form two even teams, so **6 is the only workable count for the two-team format** — 54 is not divisible by 4, 8, or 10.

This means "different player counts" (Section 42) is not a small future toggle: it requires either changing the deck or accepting an uneven deal. Recording the constraint now prevents building an abstraction that cannot deliver. If uneven deals are later acceptable, 8 players = 6×7 + 2×6, and the seat alternation in Section 6 still holds.

---

# 56. Determinism and Shuffling

Use a cryptographically seeded Fisher–Yates shuffle, not `Math.random()` and not `sort(() => Math.random() - 0.5)` (which is measurably biased):

```ts
import { randomInt } from "node:crypto";

function shuffle<T>(deck: T[]): T[] {
  const a = [...deck];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```

For tests, the engine should accept an injected RNG so a seed reproduces an exact deal. Keep the seed server-side only — exposing it lets a client reconstruct every hand.

---

# 57. Engine Purity and Testability

Section 43's structure is sound; one constraint makes it hold up. `game-engine.ts` should be a **pure reducer** with no Socket.IO, no timers, no I/O:

```ts
type Action =
  | { type: "ASK";     playerId: string; targetId: string; cardId: string }
  | { type: "DECLARE"; playerId: string; setId: SetId; assignments: Assignment[] }
  | { type: "PASS_TURN"; reason: TurnPassReason };

function reduce(state: GameState, action: Action):
  | { ok: true;  state: GameState; events: GameEvent[] }
  | { ok: false; error: ErrorCode };
```

The socket layer translates events into emissions; the engine never emits. This is what actually makes Section 42's "future features without changing the core engine" true, and it means the entire rule set in Sections 11–22 and 48–52 is unit-testable with no server running. The rules that most need tests: ask-with-no-set-card, ask-for-owned-card, empty-hand turn passing, declaring a set your team holds none of, and the last-set end condition.

---

# 58. Input Validation and Abuse Limits

Not covered in Sections 36–37, and all of it is reachable from a modified client:

- **Schema-validate every inbound socket payload** (zod or equivalent) before it reaches the engine. `cardId`, `targetPlayerId` and `setId` arriving as objects or arrays should be rejected at the boundary, not crash a handler.
- **Display names**: trim, 1–20 characters, strip control characters, reject empty-after-trim. Render as text — never `dangerouslySetInnerHTML`. Names are attacker-controlled and appear in every client's chat and player list.
- **Chat**: max 500 characters, per-socket rate limit (e.g. 5 messages / 5 seconds), server-assigned `id`, `playerId`, `playerName` and `timestamp` — never trust client-supplied values for any of those. Cap `chatMessages` at a few hundred per room so a long session cannot grow unbounded.
- **Actions**: rate-limit `game:ask-card` and `game:declare-set` per socket; the turn check already limits them, but a disconnect/reconnect loop should not be free.
- **Room codes**: 6 characters from an unambiguous alphabet (no `0`/`O`, `1`/`I`/`l`), generated with `crypto`, collision-checked against the live map. Sequential or `Math.random()` codes are guessable, and a guessed code joins a stranger's game.
- **Session tokens**: `crypto.randomUUID()` or 32 random bytes, sent only to the owning socket, never included in any broadcast or in `room:state`. A token in a public payload is a full seat takeover.
- **Room capacity**: enforce max 6 seated players server-side, and reject joins once `status !== "LOBBY"` unless the join presents a valid session token for an existing seat.

---

# 59. Protocol Ergonomics

> **Extended by Section 68.6.** Every action also carries an `actionId` for idempotent retries, and every broadcast a `seq` for gap detection and resync.

Section 27's event list needs three additions to be implementable as written:

**1. Acknowledgements.** Every client→server action should use a Socket.IO ack so the client can show a targeted error instead of silently doing nothing:

```ts
socket.emit("game:ask-card", payload, (res: { ok: true } | { ok: false; error: ErrorCode }) => {});
```

**2. A single authoritative error enum**, shared from `shared/`:

```ts
type ErrorCode =
  | "ROOM_NOT_FOUND" | "ROOM_FULL" | "GAME_ALREADY_STARTED"
  | "NOT_YOUR_TURN" | "INVALID_TARGET" | "TARGET_EMPTY" | "EMPTY_HAND"
  | "WRONG_TEAM" | "UNKNOWN_CARD" | "SET_RESOLVED" | "ILLEGAL_ASK_SET"
  | "ALREADY_OWNED" | "MALFORMED_DECLARATION" | "RATE_LIMITED"
  | "INVALID_SESSION" | "NOT_HOST";
```

**3. Missing events:**

| Event | Direction | Purpose |
|---|---|---|
| `room:reconnect` | C→S | Resume a seat with a session token (§35) |
| `room:rejoined` | S→C | Full authorized state after reconnect |
| `game:over` | S→C | Final scores and winner (§40) |
| `room:host-changed` | S→C | Host migration (§59.1) |
| `error` | S→C | Out-of-band failures with no originating ack |

Add a `protocolVersion` to the join handshake and reject mismatches with a clear message — otherwise a cached client after a deploy fails in confusing, hard-to-diagnose ways.

## 59.1 Host Migration

Not covered anywhere in Sections 1–45. If the host disconnects and never returns, the room has no one who can start a game or use host controls. Rule: on host disconnect, reassign `hostId` to the connected player with the lowest seat position and broadcast `room:host-changed`. If the original host reconnects they do **not** reclaim the role — reclaiming creates a flapping host on an unstable connection.

## 59.2 Scaling Note

In-memory rooms mean the server cannot be horizontally scaled without sticky sessions, and even then a room lives on exactly one instance. This is acceptable for the stated scope, but should be a conscious decision rather than a discovery at deploy time: run a single instance, or route by room id.

---

# 60. Revised Delivery Order

Sections 41–42 list features but not sequence. Building in this order keeps a testable system at every step, and deliberately defers voice — it is the single largest source of complexity and is not on the path to a playable game.

**Phase 1 — Engine, no network.** Deck and sets (§47), shuffle (§56), pure reducer (§57), the full rule set (§11–22, §48–52). Unit tests only. A complete game should be playable through function calls before a socket exists.

**Phase 2 — Server.** Room manager, socket layer, projections (§53), validation and limits (§58), lifecycle and sweeper (§54).

**Phase 3 — Client.** Name entry, create/join, lobby, game board, ask panel, declaration modal, activity log — built to the design system in §64, with the Last Ask panel (§65) treated as a core feature rather than polish. Motion (§66) lands with each component, not as a later pass. The declaration modal is the hardest screen — six assignments with a review step, all reversible before confirm, since a misclick costs a set.

**Phase 4 — Reconnection and text chat.** Session tokens (§34–35, §58), host migration (§59.1), room chat (§28).

**Phase 5 — Polish.** Rematch, kick, spectators, reactions, PWA (§42).

**Phase 6 — Voice. Built (§69.1), ahead of this ordering.** Every phase before this assumes voice does not exist, and nothing in them may depend on it. Packages, token scope, lifecycle teardown and hosting are in §69. This phase can be dropped entirely without touching the product definition (§45).

Cut candidates if scope needs to shrink: voice (Phase 6) is the largest and least load-bearing, and is already sequenced last for exactly that reason (§69.1). The two things that must not be cut are Section 48's set-membership rule and Section 53's projection contract — the first is the game, and the second is the anti-cheat.

---

# 61. Declaration Reveal — Per-Card Result

Section 51 states that the true locations become public after a declaration, and Sections 20–21 give the win/lose outcome. Neither specifies the piece players actually care about most: **a card-by-card comparison of what was claimed against what was true.**

A declaration is the highest-risk action in the game, and its result is the single largest information event — six card locations become common knowledge at once. If the result is reported only as "DECLARATION WRONG", the declaring team learns nothing about *which* deduction failed, and the opposing team learns nothing they can use. Both halves of the value are in the breakdown.

## 61.1 Declaration Flow (extends Section 19)

```text
Current player chooses DECLARE instead of ASK
        |
Select an unresolved set
        |
For each of the 6 cards: select a player       <- claim
        |
Review screen (all 6 assignments, all reversible)
        |
Confirm
        |
Server compares each claim against the actual holder
        |
Broadcast per-card result to every player in the room
```

The selection step is a **card -> player** assignment, exactly as Section 19 describes. All six must be assigned before Confirm is enabled; the server independently re-validates completeness per Section 51.1 and rejects a malformed declaration as an input error rather than a lost set.

## 61.2 Result Payload

```ts
interface CardRevealRow {
  cardId: string;
  cardLabel: string;          // "8♠", "Black Joker"

  claimedPlayerId: string;    // who the declarer said held it
  claimedPlayerName: string;

  actualPlayerId: string;     // who actually held it, per server state
  actualPlayerName: string;
  actualTeamId: TeamId;

  correct: boolean;           // claimedPlayerId === actualPlayerId
}

interface DeclarationResult {
  setId: SetId;
  setName: string;            // "Eights & Jokers"

  declaringPlayerId: string;
  declaringPlayerName: string;
  declaringTeamId: TeamId;

  reveal: CardRevealRow[];    // exactly 6, in fixed set order
  correctCount: number;       // 0..6
  overallCorrect: boolean;    // correctCount === 6

  awardedTeamId: TeamId;      // declaring team if correct, opponents if not (§20, §21)
  teamScores: { teamA: number; teamB: number };
}
```

Three points the implementation must get right:

- **`overallCorrect` is `correctCount === 6`, not a majority.** Section 21 is unambiguous: one wrong card loses the set. `correctCount` exists for display only — it must never feed the scoring decision.
- **`reveal` is ordered by the set's canonical card order** (Section 47), not by the order the declarer filled the form. A stable order means players can compare declarations across the game.
- **`actualPlayerId` is read *before* the six cards are removed from hands.** Resolve the reveal first, then mutate. Reversing this yields an empty or wrong reveal, and it is an easy mistake to make since both happen in the same handler.

This is emitted on `game:declaration-result` (Section 27) to **every** player in the room. It is public by definition — after resolution these six locations are no longer secret, so this is the one payload that legitimately contains other players' card locations. It remains a projection-free broadcast; §53's rule is untouched, because these cards have left play.

## 61.3 Reveal UI

The result screen shows all six rows with claim, truth, and a per-card verdict:

```text
+---------------------------------------------------------------+
|  DECLARATION — SET 9 (Eights & Jokers)                        |
|  Declared by Player A  ·  Team A                              |
+---------------------------------------------------------------+
|  CARD           DECLARED         ACTUALLY HELD BY             |
+---------------------------------------------------------------+
|  8♠             Player A         Player A            ✓        |
|  8♥             Player C         Player C            ✓        |
|  8♦             Player B         Player B            ✓        |
|  8♣             Player E         Player D            ✗        |
|  Black Joker    Player D         Player E            ✗        |
|  Colored Joker  Player F         Player F            ✓        |
+---------------------------------------------------------------+
|  4 of 6 correct                                               |
|                                                               |
|  DECLARATION WRONG — SET 9 GOES TO TEAM B                     |
|                                                               |
|  TEAM A: 2        TEAM B: 4                                   |
+---------------------------------------------------------------+
|                        [ Continue ]                           |
+---------------------------------------------------------------+
```

Design notes:

- **Show the truth column even when every card is correct.** On a correct declaration it confirms the team's reasoning; suppressing it makes the two outcomes feel inconsistent and hides information that is public either way.
- **Mark the whole result before the per-card detail is scanned.** The verdict banner is the headline; `4 of 6 correct` is context, and must never read as partial credit — keep the wording "4 of 6 correct" adjacent to "DECLARATION WRONG" so the all-or-nothing rule is visible in the same glance.
- **The swap case is the interesting one.** In the example, Player E and Player D's cards were transposed — a near-miss. Colour the two incorrect rows identically; do not attempt to detect or annotate transpositions, as the pattern is obvious in the table and special-casing it adds rule surface for no gain.
- **Every player sees the same screen**, including opponents. The result is modal for the declaring team and dismissible for everyone else, or auto-dismissed after a timeout — but the same content must remain reachable from the activity log afterwards (§61.4), since it is the game's most important reference material.
- Reuse the card visuals from `MY CARDS` so a card reads the same everywhere in the app.

## 61.4 Persistence in the Activity Log

Each `DeclarationResult` is appended to `gameHistory` and rendered as an expandable entry in the GAME ACTIVITY panel (Section 38):

```text
Player A declared SET 9 — WRONG (4/6) — Team B wins the set   [expand]
```

Expanding re-renders the full table from §61.3. Players will want to re-check a past reveal while reasoning about later sets, and reconstructing it from memory is exactly the burden the digital version should remove. Since it lives in `gameHistory`, it is included in the reconnect payload (`room:rejoined`, §59) — a player who dropped during a declaration must not lose the reveal.

---

# 62. Spectating, Team Turns, and the Race to 5

This section adds four rules that change the turn model and the end condition. Where it conflicts with an earlier section it **supersedes** it, and each conflict is named.

Summary of what changes:

| Rule | Earlier text | Now |
|---|---|---|
| Card-less player | Turn skips them (§50) | Turn skips them, and they enter a defined spectator state (§62.1) |
| Win condition | All 9 sets resolved, highest total (§40) | First team to **5 points** wins immediately (§62.2) |
| Opponents have no cards | Team may ask teammates (§52) | Team may **only declare** (§62.3) |
| Who declares | Only the current player (§51) | Turn holder opens the window; **any teammate** may declare (§62.4) |
| Turn after declaration | Stays with the declarer (§51.2) | Passes to the declaring **team**; any member may act (§62.5) |

---

## 62.1 Spectator State

A player whose hand reaches zero cards becomes a **spectator** for as long as they hold no cards. This is a state, not an exit: they remain a seated player on their team, and their seat, name, team and connection status stay in the player list.

A spectator:

- **Cannot ask** — Section 50, unchanged. The turn skips them.
- **Cannot declare.** *(Revised — this reverses the original rule in this section.)* Declaring requires holding at least one card, so a card-less player can neither open a declaration window (§62.4), claim one, nor submit one. All three are rejected with `EMPTY_HAND`.

  The earlier version of this section allowed it, on the reasoning that a player stripped of every card has watched every ask and may be the best informed at the table. That is true, but it is outweighed: a player with nothing at stake carries none of the risk their declaration imposes on the team, and it lets a team park its declarations with whoever happens to be empty. Holding a card is the cost of speaking.
- **Sees exactly what every other player sees** — the public state of §53. A spectator receives no additional visibility. Their `myHand` is simply empty, and no other player's cards enter their payload.
- **Keeps chat and voice** with no restriction.
- **Can return to play.** Zero cards is not terminal — a teammate's declaration cannot restore cards, but nothing in the model prevents a future rule from doing so. Derive the state, never latch it:

```ts
const isSpectating = player.hand.length === 0;
```

Never store `isSpectating` as a field. A stored flag will drift from `hand.length` on some path, and a stale `true` locks a player out of a game they can still play.

The UI should mark spectators plainly in the player list — dimmed, with a `SPECTATING` label — and replace the ask panel with the reason:

```text
+-----------------------------------------------+
|  You have no cards left.                      |
|  You are spectating.                          |
|                                               |
|  You can still declare for your team when     |
|  your team opens a declaration.               |
+-----------------------------------------------+
```

The second line is the important one. Without it, a card-less player reasonably concludes they are out of the game.

---

## 62.2 Winning — First Team to 5 Points

**This supersedes Section 40.** The game ends the moment either team reaches **5 won sets**, not when all 9 are resolved:

```text
After every declaration resolves:
        |
   teamScores[X] >= 5 ?
        |
        YES -> status = "FINISHED", emit game:over, Team X wins
        |
        NO  -> continue
```

With 9 sets, 5 is a clinch — the opposing team cannot exceed it with the 4 that remain — so ending early is equivalent to playing on, and avoids a stretch of play whose outcome is already decided. **Ties are impossible**, since 9 is odd and every set is awarded to exactly one team (§20, §21).

Consequences worth building for:

- A game can end with sets still unresolved. Any end-of-game screen must handle "Set 3, Set 7: not played" rather than assuming nine rows.
- The shortest possible game is 5 declarations. The end condition is reachable far earlier than the full-deck flow in Section 39 implies, so `game:over` must be checked after **every** declaration, not only when no sets remain.
- The target belongs in config (`WIN_SCORE`, default 5) alongside the set count, so a future variant does not require touching the reducer.

---

## 62.3 When the Opposing Team Has No Cards — Declare Only

**This supersedes the derivation in Section 52.** If every player on one team has an empty hand, the other team has no legal target to ask: asking an opponent is impossible, and no ask can bring cards back to a team that has none. That team must resolve the remaining sets by declaration alone.

The asking rule therefore has three states, not two:

```ts
type AskingRule =
  | "OPPONENT_ONLY"     // normal play (§12)
  | "TEAMMATE_ALLOWED"  // post-declaration variant (§22)
  | "DECLARE_ONLY";     // opponents hold no cards (§62.3)

function deriveAskingRule(room: GameRoom, teamId: TeamId): AskingRule {
  const opponentsHaveCards = playersOfTeam(room, otherTeam(teamId))
    .some(p => p.hand.length > 0);

  if (!opponentsHaveCards) return "DECLARE_ONLY";
  return room.game.postDeclarationRule[teamId] ?? "OPPONENT_ONLY";
}
```

`DECLARE_ONLY` takes precedence over everything, because it describes an absence of legal targets rather than a permission. It is still **derived after every mutation**, never latched — a team that regains cards leaves the state automatically.

Under `DECLARE_ONLY` the server rejects every `game:ask-card` with `NO_TARGETS_AVAILABLE`, and the UI hides the ask panel entirely rather than showing a disabled one:

```text
+-----------------------------------------------+
|  The other team has no cards left.            |
|  There is no one to ask.                      |
|                                               |
|  Your team must declare the remaining sets.   |
|                                               |
|              [ DECLARE A SET ]                |
+-----------------------------------------------+
```

Note that this is **not** a formality. All remaining cards sit inside one team, but the declaring player must still name which *teammate* holds each of the six — and getting one wrong hands the set to opponents who hold nothing (§21). A team can lose from this position.

---

## 62.4 Opening a Declaration — Any Teammate May Declare

**This supersedes the restriction in Section 51** ("the current player, in place of an ask"). The turn holder no longer declares personally; they **open a declaration window for their team**, and any member of that team — including a spectator (§62.1) — may then make the declaration.

```text
Turn holder clicks DECLARE
        |
Server opens a declaration window for that team
        |
All teammates see: "Your team can declare — [Declare]"
        |
First teammate to claim it takes control
        |
That player selects the set and assigns all 6 cards (§61.1)
        |
Confirm -> resolved (§61.2), window closes
```

```ts
interface DeclarationWindow {
  teamId: TeamId;
  openedBy: string;      // the turn holder
  openedAt: number;
  claimedBy?: string;    // first teammate to take control
  expiresAt: number;
}
```

Rules the server enforces:

- **The opener must hold cards** (`EMPTY_HAND`, §62.1).
- **One window per room.** Opening while a window is open is rejected (`DECLARATION_IN_PROGRESS`).
- **Only the turn holder may open one**, and only on their own turn (`NOT_YOUR_TURN`).
- **Only members of `teamId` may claim it** (`WRONG_TEAM`), and only while holding at least one card (`EMPTY_HAND`, §62.1). Opponents see that a declaration is underway but cannot touch it.
- **Claiming is first-writer-wins.** Two teammates clicking simultaneously is the normal case, not an edge case; the second receives `DECLARATION_TAKEN` and a clear message naming who took it. Guard this with the per-room action lock from §51.3 — this is the specific race that lock exists for.
- **The claimant may release** the window back to the team (`game:declaration-release`) if they change their mind. It returns to unclaimed, not to the opener.
- **The opener may cancel** the window outright (`game:declaration-cancel`), closing it with no penalty and returning the turn to them. This is what makes "opening is not a commitment" true: without it, an opener who changes their mind is trapped, because release only unclaims and every ask stays blocked until the timeout. A teammate who has claimed the window is mid-declaration, so only they may cancel from that point.
- **Windows expire** after `DECLARATION_WINDOW_MS` (default 90s, config). On expiry the window closes with no penalty and the turn returns to the opener, who may act again. Without a timeout, a team that opens a window and goes quiet stalls the room indefinitely — and the opener cannot cancel their way out, since they may not be the claimant.

Opening a window is **not** a commitment to declare. Only Confirm resolves a set, and closing the dialog cancels the window rather than merely unclaiming it. This distinction should be explicit in the UI, or players will avoid the button.

New events:

| Event | Direction | Purpose |
|---|---|---|
| `game:declaration-open` | C→S | Turn holder opens a window for their team |
| `game:declaration-claim` | C→S | A teammate takes control of the window |
| `game:declaration-release` | C→S | The claimant hands it back to the team |
| `game:declaration-cancel` | C→S | Close the window entirely; turn returns to the opener |
| `game:declaration-window` | S→C | Window opened / claimed / released / expired |

The last one goes to the whole room. Opponents must see that a declaration is in progress — it is public information and it explains why play has paused.

---

## 62.5 After a Declaration — The Team Holds the Turn

**This supersedes Section 51.2.** After a declaration resolves — correct or wrong — the turn passes to the **declaring team as a whole**. Any member of that team may act next, and the first to do so takes the turn.

The turn model becomes:

```ts
type Turn =
  | { kind: "PLAYER"; playerId: string }   // normal play
  | { kind: "TEAM_OPEN"; teamId: TeamId }; // after a declaration (§62.5)
```

Resolution rules:

- **`TEAM_OPEN` is claimed by acting**, not by a separate claim step. The first valid `game:ask-card` or `game:declaration-open` from any member of `teamId` both takes the turn and performs the action; the turn becomes `{ kind: "PLAYER" }` for that player. Concurrent attempts resolve under the same first-writer-wins lock as §62.4, and the loser gets `TURN_TAKEN`.
- **Only players with cards can claim it by asking.** A spectator (§62.1) may claim it by opening a declaration, but cannot ask.
- **If no member of the declaring team holds any cards**, the team cannot act at all: the turn passes to the opposing team (`TurnPassReason: "TEAM_EMPTY"`). Add this to the reason enum in §50 — it is now reachable through the declaration path as well as attrition, since a declaration can strip the last cards from a team.
- **`TEAM_OPEN` needs a timeout too** (`TEAM_TURN_MS`, default 60s). Six players all waiting for someone else to move is a real stall, and unlike a normal turn there is no single player to prompt. On expiry, fall back to the deterministic rule from §50: lowest seat position on that team holding cards.

The UI must make an open team turn unmistakable to the whole team, since no individual is named:

```text
+-----------------------------------------------+
|            YOUR TEAM'S TURN                   |
|      Anyone on Team A can play                |
|                                               |
|      [ ASK ]        [ DECLARE ]               |
+-----------------------------------------------+
```

and to the opposing team as `Waiting for Team A`, rather than naming a player who may not be the one to move.

---

## 62.6 Consolidated Turn Flow

```text
Declaration resolves (§61)
        |
Score updated -> either team at 5? -> YES -> GAME OVER (§62.2)
        |
        NO
        |
Turn -> TEAM_OPEN for the declaring team (§62.5)
        |
Declaring team has any cards?
        |
        NO -> turn passes to opponents (TEAM_EMPTY)
        |
        YES
        |
Any teammate acts:
        |
        +-- ASK      -> requires opponents to hold cards; else DECLARE_ONLY (§62.3)
        |
        +-- DECLARE  -> opens a window for the team (§62.4)
                            |
                     any teammate claims and declares
                            |
                     back to the top
```

Three states now sit between "a player has the turn" and "the game continues": `TEAM_OPEN`, an open `DeclarationWindow`, and `DECLARE_ONLY`. Each has a timeout and each is derived or explicitly stored on the room — none should be inferred by the client. The reducer in §57 gains `OPEN_DECLARATION`, `CLAIM_DECLARATION`, `RELEASE_DECLARATION`, and `CLAIM_TURN` actions; every one of them is a pure state transition and unit-testable without a socket.

New error codes for §59's enum:

```ts
| "NO_TARGETS_AVAILABLE"      // §62.3
| "DECLARATION_IN_PROGRESS"   // §62.4
| "DECLARATION_TAKEN"         // §62.4
| "TURN_TAKEN"                // §62.5
| "GAME_OVER"
```

---

## 62.7 Open Question

Section 62.5 assumes "the team" means the **declaring** team, following the sentence order of the rule as given and consistent with §51.2's reasoning that a declaration is not a failed ask. If the intent was that the turn goes to the **opposing** team after a wrong declaration, the change is one line in the reducer — but it materially alters risk, since a wrong declaration would then cost both the set and the tempo. Confirm before Phase 1 (§60) is built.

---

# 63. Decision Record — No Database, No State Recovery

**Decided.** The application stays database-less as described in Sections 32–33, and **no snapshot or state-recovery mechanism is in scope**. Losing all in-flight games on deploy or crash is an accepted cost, not an outstanding problem.

## Rationale

- Room data has no readers once the room dies. A game lasts on the order of half an hour; storing it would mean maintaining a schema, migrations and a connection pool for rows deleted within the hour.
- The absence of storage is what makes Section 2 credible. "We delete it" is a policy; "there is nowhere to write it" is an architecture.
- Capacity is not the binding constraint. A room is roughly 100–200 KB; a thousand concurrent rooms fit in a few hundred MB, and rooms shard cleanly by id (§59.2) if that ever changes.
- The decision is cheap to reverse. Section 57's pure reducer over plain state means persistence would be an outer layer, not a rule change.

## Consequences to build for

**Deploy during low activity.** With no recovery, deploy timing is the only mitigation available. This is a release-process constraint, not a code one, and it should be written down wherever the deploy runbook lives.

**Section 33's message is now load-bearing.** It is the entire user-facing response to a restart, so it must be unambiguous and must not look like a transient network error — a player who thinks they can reconnect will sit and wait. Distinguish the two states explicitly in the client:

```text
Connection lost — reconnecting…          (retrying, room may still exist)

The game server was restarted.           (terminal, no retry)
This room is no longer available.
[ Create or join a new room ]
```

The second must be a terminal state with an action, never a spinner.

**Keep `GameState` plain JSON anyway.** Hold timers, socket handles and voice-client references in a side table keyed by room id, outside the state object. This costs nothing now and is worth doing regardless of persistence: it is the same constraint that makes the reducer testable (§57) and keeps the option of adding recovery later open at low cost.

**Use aggregate metrics, not stored games,** for product questions (completion rate, declaration accuracy, game length). Counters via Prometheus/StatsD carry no room or player data and leave Section 2 intact.

## Status — Product Requirement, Not a Stage

No persistent data about a game or a player is required. All room, player, card, score, chat and history data is temporary by design and exists only while the room does.

This is a **product requirement**, not an interim position pending a database. It should be treated as a constraint on future features rather than a limitation to be engineered around: a proposed feature that requires storing game or player data across sessions is a change to the product's privacy model (Section 2) first, and an infrastructure question only after that has been decided deliberately.

Practical effect on the roadmap in Section 42: spectator mode, replay *while the room exists*, host controls, rematch, reactions and PWA all remain in scope, because none of them outlive the room. Anything implying accounts, ranked play, cross-session statistics or leaderboards falls outside the current product definition and should not be designed for speculatively.

---

# 64. Visual Design Language

Reference screenshots live in `design-reference/` (`image1.png`–`image5.png`) and show a shipped mobile Literature app. They are **directional, not a target to copy**: the palette, team encoding, layout regions and half-suit grouping below are worth keeping, while the card treatment and overall visual tone are ours to set (§67). This section extracts the system; Sections 65–66 cover the ask panel and motion.

## 64.1 Terminology Mapping

The reference app uses different words for the same concepts. **Keep this spec's vocabulary in code and the reference's clarity in the UI:**

| This spec | Reference UI | Use in our UI |
|---|---|---|
| Set (§7, §47) | "Half-Suit" | **Half-Suit** — it is self-explanatory and matches the §47 names ("Low Spades") |
| Declaration (§18) | "Claim Deck" | **Declare** — our events, errors and rules all say declaration (§61, §62.4); do not fork the vocabulary |
| `setId` | — | `setId` in code, "Half-Suit" in copy |

## 64.2 Palette

Dark theme only for v1. The reference's team encoding — **green = us, red = them** — carries through every surface and should be applied consistently, with the redundancy required by §64.8.

```css
--bg:            #12151F;  /* app background */
--surface:       #1B2237;  /* panels, cards, sheets */
--surface-raised:#232B42;  /* modals, elevated rows */
--border:        #2E3752;

--text:          #F3F4F6;
--text-muted:    #9CA3AF;

--team-us:       #4ADE80;  /* our team, success, ASK button */
--team-them:     #EF4444;  /* opponents, failure */
--accent:        #FBBF24;  /* turn state, declare action, headings */

--score-bar:     #1D3527;  /* dark green score band */
--turn-banner:   #3E362A;  /* warm band under the score bar */

--card-face:     #FFFFFF;
--card-red:      #E11D48;
--card-black:    #111827;
```

Avatar discs encode team by background: maroon `#4C1D24` for opponents, forest `#1E3A2A` for teammates. This is the fastest team read in the reference design and should be preserved.

> **Amended by Section 70.1.** The disc stays; the emoji inside it does not. Avatars are an in-repo SVG sprite and all UI icons come from `lucide-react`. No emoji anywhere.

## 64.3 Card Component

> **Superseded by Section 67.** Cards are dimensional and procedurally generated. The sizes and states below still apply; the flat treatment does not.

The single most reused element. One component, three sizes, driven by `Card` (§47):

- **Face:** white, radius 8px, rank top-left in bold, large centred pip. Red for ♥♦, near-black for ♠♣. Jokers get a distinct face — the reference uses a joker glyph; ours needs two (black and coloured) that are unmistakably different at `sm`.
- **Sizes:** `sm` 44×60 (hand rows, ask strip), `md` 56×78 (declaration modal), `lg` 72×100 (reveal, celebrations).
- **Back:** patterned, used only where a card is genuinely unknown — never as a stand-in for another player's hand, which is represented by a **count**, not by fanned card backs (§26, §53). Showing nine card backs for a nine-card hand is honest; showing them for a hand whose size is unknown is not, and the count is the information players actually track.
- **States:** default, `selected` (accent ring + 4px lift), `disabled` (55% opacity), `highlighted` (accent glow, used when a card is the subject of the ask strip).

## 64.4 Hand Grouped by Half-Suit

Image 4 groups the player's hand into labelled half-suit rows rather than one flat fan. **Adopt this exactly.** It is not only tidier — it is the UI expression of Section 48: you may only ask within a half-suit you already hold, so a hand grouped by half-suit shows your legal ask surface directly. A flat hand forces every player to re-derive that mentally on every turn.

```text
Low Spades     [5♠]
High Spades    [9♠]
High Hearts    [A♥] [J♥]
Low Diamonds   [5♦]
```

Rows with no cards are omitted. When the ask flow is open, rows you hold are actionable and everything else is visibly inert — the illegal move should be unreachable, not merely rejected.

## 64.5 Layout Regions

Fixed top, scrolling middle, fixed bottom — as in every reference screen:

```text
+-----------------------------------------------+
|  Your Team  0      VS      0  Opponents       |  score bar, fixed
+-----------------------------------------------+
|         * Your Turn!                     (?)  |  turn banner, fixed
+-----------------------------------------------+
|  [ LAST ASK PANEL — §65 ]                     |  fixed, below banner
+-----------------------------------------------+
|  OPPONENTS   (avatars + card counts)          |
|  TEAMMATES   (avatars + card counts)          |  scrolls
|  HALF-SUITS  (3x3 grid — see §64.6)           |
+-----------------------------------------------+
|         [ Table ]        [ Hand ]             |  view toggle
+-----------------------------------------------+
|   [ ASK CARD ]        [ DECLARE ]             |  actions, fixed
+-----------------------------------------------+
```

The `(?)` in the turn banner opens rules help. Keep it: this game has non-obvious rules (§48, §62.3) and a persistent, low-cost explainer prevents most confusion.

**Responsive:**

- **Phone portrait** — as above; Table/Hand is a tab toggle.
- **Tablet / landscape** (image 3) — two columns: left rail holds players and half-suits, right holds the hand. No toggle needed; both are visible.
- **Desktop** — three columns: players + half-suits, hand + actions, and a right rail for chat and voice (§28–29). The reference has no chat, so this column is ours to design; it must never occupy space the game board needs on smaller screens — collapse it to a sheet below 1100px.

## 64.6 Half-Suit Tiles

The reference shows 8 tiles. **We have 9** (§47), which fits a 3×3 grid cleanly — a better layout than the reference's 4×2 and worth the deviation. The ninth tile is `Eights & Jokers` and should carry its own icon rather than a suit pip.

States: `Open` (neutral border, muted label), `Ours` (green border + ✓), `Theirs` (red border + ✗), `Declaring` (accent border, pulsing — active while a declaration window is open, §62.4).

Image 2's `⚡ Stolen on a failed claim` marker is a good detail: a set won because the *opponents* declared wrongly reads differently from one earned outright, and players want to know which is which. Carry it into both the tile and the end screen.

## 64.7 What Not to Adopt

- **Achievements** (image 2) require cross-session player records and are out of scope under §63. Do not build a placeholder for them.
- **Bot difficulty** (image 5) — *superseded by §73: bots are implemented.* The setup modal's shape remains the right pattern for the lobby: segmented chips, one primary action, text Cancel.
- **Share** is fine only if it shares an ephemeral result image or a room link, never a stored game record (§63).
- The reference is 4- or 6-player with a 48-card deck. Ours is fixed at 6 players and 54 cards (§55) — the setup screen should state the requirement rather than offer a choice it cannot honour.

## 64.8 Accessibility

The reference leans hard on red/green to encode team, which fails for a significant share of players. **Colour must never be the only channel:**

- Pair every `Ours`/`Theirs` colour with a glyph (✓ / ✗) and a text label.
- Team membership on avatars: disc colour **plus** a position in a labelled `OPPONENTS` / `TEAMMATES` group — the reference already does this, so keep the grouping even when space is tight.
- Contrast: body text ≥ 4.5:1, large/heading ≥ 3:1. `--text-muted` on `--surface` passes; do not push it darker for the "12 cards" sublabels.
- Every action reachable by keyboard with a visible accent focus ring; the ask flow must be completable without a pointer.
- Card faces need accessible names ("Five of Hearts"), not just glyphs.
- The ask panel is a live region — see §65.5.

---

# 65. The Last Ask Panel

A persistent panel showing the most recent ask — who asked, for which card, from whom, and the answer — held on screen **until the next ask replaces it**.

This is the highest-value screen element in the game. Section 53 makes every ask public, and asks are how players build the deduction that Sections 48 and 61 are built on. A transient toast forces players to watch continuously or lose information they are entitled to; a persistent panel means a player who looks away, joins the tab late, or reconnects still sees the current state of play. It is a fixed region directly under the turn banner (§64.5), not a notification.

## 65.1 State — Server-Owned

`lastAsk` is **part of authoritative game state**, not a client-side listener artefact. Deriving it from a socket event on the client loses it on reconnect, which is exactly when a player most needs it.

```ts
interface LastAsk {
  askerId: string;
  askerName: string;
  askerTeamId: TeamId;

  targetId: string;
  targetName: string;

  card: Card;              // full card — public per §53

  result: "SUCCESS" | "FAIL";
  turnPassedToId?: string; // set when result === "FAIL" (§15)

  askIndex: number;        // monotonic; the animation key (§65.4)
  timestamp: number;
}
```

Add `lastAsk?: LastAsk` to `GameState` and include it in `ClientGameState` (§53) and in the `room:rejoined` payload (§59). It is identical for every player — there is nothing to project.

Lifecycle:

- **Set** on every resolved ask, replacing the previous value.
- **Retained** across turn changes. It is not cleared when the turn moves.
- **Retained** across a declaration; the declaration result renders in its own surface (§61.3) and does not overwrite the ask.
- **Cleared** only on a new deal.

Rejected illegal asks (§49) never set it — they are not game events.

## 65.2 Anatomy

```text
+-------------------------------------------------------------+
|  (fox) Alice   ---- asked ---->   (turtle) Bob              |
|                                                             |
|                    +-------+                                |
|                    |  8    |          [ v ] GOT IT          |
|                    |  <3   |                                |
|                    +-------+                                |
+-------------------------------------------------------------+
```

and on a failed ask:

```text
+-------------------------------------------------------------+
|  (fox) Alice   ---- asked ---->   (owl) Charlie             |
|                                                             |
|                    +-------+                                |
|                    |  8    |          [ x ] NO — turn       |
|                    |  <3   |               passes to Charlie|
|                    +-------+                                |
+-------------------------------------------------------------+
```

Composition rules:

- **Real card art**, size `sm` (§64.3) — never a text string like "8H". The card is the subject; players should recognise it the same way they recognise it in their hand.
- **Avatars, not names alone.** The reference's emoji-on-disc avatars are recognisable at a glance and already encode team by disc colour (§64.2). Names sit beneath.
- **Direction is explicit.** An arrow from asker to target, because "Alice asked Bob" and "Bob asked Alice" are opposite facts and a comma-separated line is easy to misread under time pressure.
- **The outcome badge is the loudest element**: ✓ `GOT IT` in `--team-us` green, ✗ `NO` in `--team-them` red. Icon plus text, never colour alone (§64.8).
- **On failure, name where the turn went.** "No — turn passes to Charlie" folds §15's consequence into the same glance and removes the most common source of "whose turn is it?" confusion.
- **Colour the frame by the asker's team relative to the viewer**, not by outcome: a subtle green left border when a teammate asked, red when an opponent did. Outcome is already carried by the badge, and doubling it on the frame makes an opponent's failure look like your success.

The panel is tappable and opens the full activity log (§61.4) scrolled to that entry.

## 65.3 Empty State

Before the first ask of a game, the panel keeps its space and explains the game instead of collapsing — layout that shifts on first use is worse than a reserved region:

```text
+-------------------------------------------------------------+
|   No asks yet — the last ask will stay here                 |
+-------------------------------------------------------------+
```

## 65.4 Animation

Full timing tokens are in §66. The sequence, driven by `askIndex` as the React key so a repeat ask of the same card still re-animates:

1. **Ask submitted** — the panel enters `PENDING` immediately on local intent: avatars and the arrow slide in, the card sits **face-down**, and a soft pulse travels along the arrow. This is the one moment the client may move ahead of the server, because it shows intent, not outcome.
2. **Server responds** — the card **flips face-up** (`base`, spring). The flip is the reveal beat; everything else waits for it.
3. **Outcome** —
   - **SUCCESS:** badge scales in from 0.8 with a slight overshoot; the card lifts and travels along the arrow from target to asker; both card counts tick (§66.4); the asker's avatar ring flashes green.
   - **FAIL:** the card shakes horizontally (2 cycles, `fast`); the ✗ badge stamps in scaling *down* from 1.15 to settle; the turn indicator then slides to the new player (`base`, after a 120ms beat so the two events read as cause and effect, not simultaneous).
4. **Settle** — the panel holds this state indefinitely until the next ask, at which point the old content exits left and the new enters right, so the replacement reads as a sequence rather than a redraw.

**The outcome animation must never run before the server ack.** Section 44 is the rule: the client shows intent, the server decides. Playing a success animation optimistically means occasionally animating a lie and then reversing it, which is worse than a 200ms wait.

**Reconnect and catch-up:** on `room:rejoined`, render `lastAsk` in its final settled state with animation **disabled**. Replaying it would show a stale event as though it just happened. Gate this with a `hydrating` flag that suppresses all entrance animation for one frame.

**Rapid asks:** if a new ask arrives mid-sequence, cancel and jump to the new one's settled state rather than queueing. The panel shows the *last* ask; a backlog of animations is never the truth.

## 65.5 Screen Reader Behaviour

The panel is the game's primary information channel, so it must be announced:

```html
<section aria-live="polite" aria-atomic="true">
  Alice asked Charlie for the eight of hearts. Charlie did not have it.
  The turn passes to Charlie.
</section>
```

Use `polite`, not `assertive` — asks are frequent and interrupting on each one makes the game unusable. Announce once, on the settled state, not on `PENDING`.

## 65.6 Table Echo

The panel is the record; the table is the theatre. On a successful ask, also fly a card ghost from the target avatar to the asker avatar on the player layout, arriving as the counts tick. It is the same event told twice — once durably, once spatially — and the spatial telling is what builds players' memory of who holds what.

Keep the two in sync: one event source, one timeline, no independent timers.

---

# 66. Motion System

Animation here is functional, not decorative: cards move between hands, turns move between players, and sets resolve. Each of those is a state change a player must notice and remember. Motion's job is to show *what changed and where it went* — a game whose state teleports forces players to re-read the whole screen after every action.

## 66.1 Tokens

```css
--dur-instant: 100ms;  /* hover, press, focus */
--dur-fast:    180ms;  /* badges, chips, shakes */
--dur-base:    260ms;  /* panel swaps, card flips, turn moves */
--dur-slow:    420ms;  /* card travel across the board */
--dur-event:   700ms;  /* declaration reveal, game over */

--ease-standard:   cubic-bezier(0.2, 0, 0, 1);
--ease-enter:      cubic-bezier(0.05, 0.7, 0.1, 1);   /* decelerate in */
--ease-exit:       cubic-bezier(0.3, 0, 0.8, 0.15);   /* accelerate out */
--ease-overshoot:  cubic-bezier(0.34, 1.56, 0.64, 1); /* badges, wins */
```

Entrances decelerate, exits accelerate, and only celebratory elements overshoot. Anything above `--dur-slow` needs a reason — during play, motion competes with thinking.

## 66.2 Choreography by Action

| Action | Motion |
|---|---|
| Ask submitted | Ask panel `PENDING` enters, card face-down, arrow pulse (§65.4) |
| Ask succeeds | Card flips, travels target → asker, counts tick, asker ring flashes green |
| Ask fails | Card flips, shakes 2× , ✗ stamps, turn indicator slides after a 120ms beat |
| Turn changes | Accent ring travels between avatars (`base`); banner text cross-fades |
| Team turn open (§62.5) | Both teammates' rings pulse in a slow loop until someone claims it |
| Declaration window opens (§62.4) | Half-suit tiles lift slightly; the team's action bar swaps in with a slide |
| Declaration reveal (§61.3) | Rows stagger in 90ms apart; each ✓/✗ stamps as its row lands |
| Set resolved | The six cards sweep to the winning team's side; the tile flips to Ours/Theirs |
| Player runs out (§62.1) | Avatar desaturates over `slow`; `SPECTATING` label fades in |
| Game over (§62.2) | Score counts up from 0; half-suit grid staggers in; banner overshoots |

The declaration reveal is the one place to spend the full `--dur-event`. Six rows landing one at a time, each stamping correct or wrong, is the dramatic peak of a game — and the stagger is also functional, since it gives players time to actually read each row instead of absorbing six simultaneous verdicts.

## 66.3 Rules

- **Animate transforms and opacity only.** No animating `width`, `height`, `top`, `left`, or anything that triggers layout. Card travel is `translate` + `scale` on an absolutely positioned layer above the board.
- **Server events drive motion.** The only permitted optimistic animation is `PENDING` intent (§65.4). Everything that asserts an outcome waits for the ack.
- **Every animation is interruptible.** A new event cancels the running one and snaps to its end state. Never queue gameplay animations — the queue drifts from the truth, and the truth is what players are memorising.
- **One timeline per event.** The ask panel and the table echo (§65.6) are two views of one event and share a timeline. Two independent timers will desync on a slow frame and show a card arriving before it left.
- **Nothing blocks input.** A player must be able to act during any animation; the action interrupts it. The sole exception is a modal declaration reveal, which is dismissible immediately.
- **Card identity persists.** Use the card id as the layout-animation key so a card that moves between hands is the same element moving, not one removed and another added.

## 66.4 Counting

Card counts (`12 cards`) tick rather than jump — a single-step count-up over `fast`, synchronised to the card's arrival. The tick is what makes a transfer *felt*; a number that silently changes while attention is on the panel is a change most players miss, and card counts are load-bearing information in this game.

## 66.5 Reduced Motion

Honour `prefers-reduced-motion: reduce` everywhere:

- Replace travel and slides with cross-fades at `--dur-fast`.
- Drop shakes, pulses, stamps and overshoot entirely.
- Keep count ticks — they are information, not decoration; set them instantly.
- **Remove no information.** The declaration reveal still shows all six rows and both verdicts; only the stagger goes.

Implement as a token swap at the root, not per-component `if` branches, so it cannot be forgotten in one place.

## 66.6 Implementation

Framer Motion (`motion/react`) is the pragmatic choice: `AnimatePresence` for the ask panel swap, `layoutId` for card travel between hands, and variants for the reveal stagger. Its layout animations solve the hardest problem here — a card moving between two separately mounted containers — with far less code than hand-rolled FLIP.

Constraints:

- Target 60fps on a mid-range phone. Fewer than ~20 simultaneously animating elements; the reveal stagger and card sweep are the two places to check this.
- Keep animation state out of `GameState` (§63). The reducer emits events; the view layer decides how they look. A reducer that knows about durations is no longer testable without a renderer.
- `will-change` only on the card-travel layer, and only while it is moving.

## 66.7 Optional Polish

Off by default, user-toggleable, and never load-bearing:

- **Haptics** on mobile — a light tap on a successful transfer, a sharper one on a wrong declaration.
- **Sound** — card flip, shuffle, declaration sting. Default off; many players are in voice chat (§29), where game audio competes with teammates.

---

# 67. Card Rendering and 3D Asset Strategy

Cards should read as physical objects — thickness, light, a real flip — rather than flat chips. This section defines how they are built. It **supersedes §64.3's flat card component** and relaxes §64's dependence on the reference screenshots: the palette, team encoding, layout regions and half-suit grouping stand, but the card treatment and general visual tone are ours.

## 67.1 The Asset Unit Is Not "54 Objects"

A 3D card game does not model 54 objects. It uses **one** geometry — a rounded rectangle with slight thickness — plus a shared back and 54 face designs applied per instance. Nobody models the 5♥ separately from the 6♥.

```text
1 card geometry (shared)
1 back design (shared)
54 face designs   <- the only per-card part
```

And a card face is pure vector: a rank glyph, a suit pip, a layout. **Generate the faces procedurally rather than shipping artwork.** Benefits that matter here:

- Crisp at every size, from the `sm` chip in the ask panel (§65.2) to the `lg` card in a declaration reveal (§61.3) — one source, no asset variants.
- A few KB of code instead of a texture atlas, which matters on the constrained connections §68 targets.
- Theming is free: the §64.2 palette applies to card faces directly, so a light theme or a colour-blind-safe suit palette is a token change, not a re-export.
- No asset pipeline. A card design change is a code change with a diff.

```ts
// One generator, all 54 faces. No binary assets.
function renderCardFace(card: Card): string /* SVG */;
```

## 67.2 CSS 3D, Not WebGL

Cards use `transform-style: preserve-3d` with a perspective ancestor — real depth, real flips, tilt on hover — rendered as DOM elements. **Three.js / React Three Fiber is explicitly rejected for gameplay.** The reasons are specific to this application:

- **§66 is built on Framer Motion layout animations**, which operate on DOM nodes. WebGL would require rewriting the entire motion system, including §65.4's flip beat and §65.6's table echo.
- **A canvas is opaque to assistive technology.** §64.8 requires accessible names on cards and §65.5 requires a live region; both need real DOM, and maintaining a parallel DOM tree purely for screen readers is a standing source of drift.
- **This is a dense information UI** — player lists, chat, half-suit grids, an activity log — with cards in it, not a 3D scene with UI attached.
- **Cost.** R3F is several hundred KB before any scene, against §68's budget and §66's 60fps mid-range target.
- The 3D value in a card game is almost entirely **the flip and the travel**, which CSS handles natively and which §65.4 already specifies.

WebGL earns its cost only if cards should tumble with physics or respond to a moving light. If the deal sequence is ever meant to be a signature moment, the viable path is a hybrid — R3F for the deal and the §61 reveal, DOM for play — and it should be scoped as its own piece of work, not slipped in.

## 67.3 Card Structure

```html
<div class="card" style="--rot: 0deg">   <!-- perspective ancestor above -->
  <div class="card__inner">              <!-- preserve-3d, rotateY(var(--rot)) -->
    <div class="card__face">…SVG…</div>  <!-- backface-hidden -->
    <div class="card__back">…SVG…</div>  <!-- rotateY(180deg), backface-hidden -->
    <div class="card__edge"></div>       <!-- thin translateZ slab: thickness -->
  </div>
</div>
```

- **Thickness** comes from a thin edge element offset on Z, not from a box-shadow. It is what separates a dimensional card from a flat one.
- **Lighting** is a static gradient overlay plus a specular sheen that shifts with rotation, driven by the same custom property as the transform. No light source, no per-frame JS.
- **Shadow** is a separate, sibling element that scales and fades as the card lifts. Never animate `box-shadow` itself (§68.2).
- **Flip** is `rotateY` on `.card__inner` — the §65.4 reveal beat, at `--dur-base` with a spring.
- **Rest state** carries a 1–2° tilt so cards never look like stickers.

## 67.4 Accessibility and Fallback

- Every card exposes an accessible name ("Five of Hearts"); the SVG is `aria-hidden` and the name lives on the container.
- Suits are distinguished by **shape**, not only colour — the pip glyphs already do this, and it must survive any restyling.
- Under `prefers-reduced-motion` (§66.5) the flip becomes a cross-fade between faces. The card keeps its depth; only the motion goes.
- Depth is progressive enhancement. If `preserve-3d` is unavailable, cards render flat and every rule remains playable.

## 67.5 Open Item — Joker Artwork

> **See also Section 70.2** for the court-card decision and the requirements for any supplied artwork.

Ranks and pips are geometry; a joker is a drawing. The two jokers in Set 9 (§47) cannot be generated procedurally in any satisfying way, and Set 9 is the most memorable set in the game — the worst one to ship with a placeholder.

Options, to decide before Phase 3 (§60): a glyph-based treatment consistent with the generated deck; a licensed card-art asset; or commissioned artwork. The black and coloured jokers must be **unmistakably different at `sm` size**, since they are two distinct cards in the same set and will appear side by side in declaration assignments.

---

# 68. Performance and Network Budget

Two budgets, frequently conflated, that must be reasoned about separately:

- **Rendering** costs GPU and CPU on the player's device. Card animation lives here. It consumes no bandwidth.
- **Network** costs bandwidth, and is dominated almost entirely by voice.

Dimensional cards (§67) do not compete with voice chat. They are different resources.

## 68.1 Rendering Budget

`rotateY`, `translate3d`, `scale` and `opacity` are handled by the compositor: no per-frame JavaScript, no layout, no paint. This is the same path the flat animations in §66 already use, so **§67's 3D cards cost approximately what the flat design would have cost** — a flip and a slide are both one transform.

Targets: 60fps on a mid-range phone, with fewer than ~20 elements animating simultaneously. The two places to verify are the declaration reveal stagger (§66.2) and a full deal.

## 68.2 The Actual Cost Drivers

Rendering cost comes from a short, specific list — not from "3D":

| Avoid | Instead |
|---|---|
| Animating `width`, `height`, `top`, `left` | `transform: translate3d()` |
| Animating `box-shadow` | Transform a separate shadow element (§67.3) |
| `filter`, `backdrop-filter`, `blur` on animated elements | Static gradient overlays; blur only on idle surfaces |
| `will-change` left on permanently | Apply on animation start, remove on completion |
| Every card as its own compositor layer | Promote only what is currently moving |

§66.3 already bans the first category; this table names the specific traps for card UI.

## 68.3 Device Tiering

Weak devices should degrade, not stutter. Measure dropped frames over the first few seconds of play and, past a threshold, fall back to the **reduced-motion token set** (§66.5) — cross-fades instead of travel, no stagger, no sheen. Reuse that path rather than writing a second one, and expose it as a manual setting too, since detection will sometimes be wrong.

The card stays dimensional in this mode. Depth is static; only motion is reduced.

## 68.4 Network Budget

Approximate figures; the ratio is the point:

| Traffic | Typical |
|---|---|
| One ask, both directions | a few hundred bytes |
| Full authoritative state broadcast | a few KB |
| **Game traffic, averaged over play** | **well under 1 kbps** |
| Voice: one Opus stream | ~24–32 kbps |
| Voice: 6-player room via SFU | ~120–160 kbps down, ~32 kbps up |

**Voice is roughly 99% of the bandwidth.** Game traffic is rounding error, and no card action will disturb a call. Optimising game payload size for the sake of voice quality would be effort spent on the wrong resource.

## 68.5 What Low-Quality Networks Actually Break

Not bandwidth — **latency and packet loss**. This game is well placed for both, because it is turn-based: nothing must arrive within 50ms, it must arrive *reliably* and *feel* immediate. Five measures deliver that.

**1. Optimistic `PENDING` (already in §65.4).** The single biggest perceived-latency lever. It makes a 400ms round trip feel instant while never asserting an outcome the server has not confirmed.

**2. Idempotency keys — a gap in §59 as written.** Acks time out on poor connections and clients retry; without a key, a retried ask becomes two asks. Every client→server action carries a client-generated id, and the server caches recent results per player:

```ts
interface ActionEnvelope<T> {
  actionId: string;   // crypto.randomUUID() on the client
  payload: T;
}
```

A repeated `actionId` returns the **original stored result** and mutates nothing. Cache per room for a few minutes — well past any realistic retry — and clear it with the room. This applies to `game:ask-card`, `game:declare-set`, and every action in §62.4–62.5, where a duplicate `declaration-claim` or `CLAIM_TURN` under a retry would otherwise race with itself.

**3. Sequence numbers and resync.** Every broadcast carries a monotonic `seq` per room. A client detecting a gap requests a full state resync rather than applying updates to a state it knows is stale:

```text
Client sees seq jump 41 -> 43
        |
Emit room:resync
        |
Server returns full projected state (§53) at current seq
        |
Client replaces state wholesale, hydrating without animation (§65.4)
```

Full-state replacement is cheap here (a few KB) and removes an entire class of desync bugs. Do not build delta reconciliation for this payload size.

**4. Independent transports.** Voice runs over WebRTC/UDP through the SFU; the game runs over the Socket.IO WebSocket. Neither failure should touch the other, and **the game must remain fully playable with voice off or failed** — §60 already defers voice to Phase 5, which keeps this honest. Note that Socket.IO rides TCP: under packet loss, events arrive late and bursty rather than lost. §65's panel absorbs this naturally, since it only ever renders the latest state.

**5. Honest connection status.** Distinguish three states in the UI, never collapsing them into one spinner: connected, reconnecting (retrying, room may still exist), and server-restarted (terminal — §33, §63). A player who cannot tell "slow" from "gone" will wait indefinitely for a room that no longer exists.

## 68.6 Protocol Additions

Folding §68.5 into the §59 contract:

| Addition | Applies to |
|---|---|
| `actionId` on the envelope | every client→server action |
| Server-side dedupe cache, per room | replayed `actionId` returns the stored result |
| `seq` on every broadcast | every server→client state event |
| `room:resync` (C→S) / `room:state-full` (S→C) | gap recovery |

Both `actionId` and `seq` are protocol-level concerns and belong in the socket layer, **not** in the reducer. §57's engine stays pure: it neither knows nor cares that a message was retried, because the socket layer never delivers a duplicate to it.

---

# 69. Voice Infrastructure and Hosting

## 69.1 Voice — Implemented

> **Status changed.** This section previously deferred voice to the final phase. It has now been built, ahead of that ordering, at the project owner's direction. The deferral did its job in the meantime: nothing in phases 1–5 depends on voice, so adding it required no changes to the rules engine, the projection, or any existing screen.

The constraints below still hold, and are now enforced in code and tests:

- **Voice is optional.** With no LiveKit credentials, `voice.available` is `false`, the control is absent, and the game is unaffected. `voice:token` returns `VOICE_UNAVAILABLE`.
- **The engine never learns voice exists.** Presence lives on `GameRoom.voiceParticipants`, outside `GameState`, and §57's reducer neither reads nor receives it.
- **No rule gates on it.** A player with a broken microphone, a failed SFU connection, or voice switched off is a full participant.


This is a firm sequencing decision, not a preference:

- Voice is the largest source of infrastructure complexity in the project and the only part that cannot run on ordinary application hosting (§69.5).
- Nothing in the game depends on it. The rules engine (§48–52), the ask panel (§65), declarations (§61) and the whole turn model (§62) are complete and playable in silence.
- It is the one feature that can be cut entirely without touching the product definition (§45).

Practical instructions for phases 1–5:

- **Build and test with no voice at all.** Do not stub it, do not reserve UI space for it, do not add a voice column to the layout "for later."
- `voiceParticipants` in §23 stays an empty array. It is already advisory-only (§69.4), so nothing reads it.
- **The game must never gate on voice state.** §57's reducer must not know voice exists. If a rule, a turn transition or a UI state ever consults voice, that is a bug introduced in the wrong phase.
- Section 17's communication policy applies to text chat in the meantime; the voice half activates when voice does.

The remainder of this section is the implementation contract.

---

## 69.2 Package Choice — LiveKit

```
livekit-server-sdk          # Express: mint tokens, delete rooms, receive webhooks
livekit-client              # Browser: connect, publish audio, subscribe to events
@livekit/components-react   # Optional — take the hooks, skip the prebuilt UI
```

Use the hooks (`useParticipants`, `useIsSpeaking`, `useLocalParticipant`) but not the prebuilt components: they are designed around video-conference layouts, while §29's voice UI is a compact participant list beside a game board.

**Why LiveKit over the alternatives:**

| Option | Verdict |
|---|---|
| **LiveKit** | Open-source SFU with a managed cloud. Start managed, self-host later without re-integrating — the same server either way |
| mediasoup | More control, but all signalling is yours to build. Weeks of work for six people talking |
| Daily / Agora | Good SDKs, proprietary. Self-hosting later means starting over |
| Twilio Video | On a deprecation path — do not build on it |
| Jitsi | Free and capable, but iframe-oriented and opinionated; awkward inside a custom board |
| PeerJS / mesh | No media server, but each player encodes and uploads **5 streams** — ~160 kbps up and five encoders on a phone. Exactly what an SFU exists to avoid |

The migration path is the deciding factor. For an application positioned on privacy and no persistence (§2, §63), keeping self-hosting available without a rewrite is worth more than a marginally simpler SDK.

## 69.3 Integration Contract

**Token minting** (Express, final phase):

- Room name = the game room id; identity = `playerId`; display name = the player's name.
- Grant **only** `roomJoin`, `canPublish`, `canSubscribe`. Never `roomCreate` or `roomAdmin` from a client-facing endpoint.
- Short TTL, re-minted on reconnect (§35). This satisfies §30 directly: a token admits its holder to exactly one room.

**Audio only.** Never publish video — it is not in the product and would dominate §68.4's budget. Enable **Opus DTX**, so silence costs almost nothing on the weak connections §68.5 targets.

**Lifecycle.** Call `RoomServiceClient.deleteRoom()` when the game room is destroyed (§31, §54). Without it, LiveKit rooms outlive the in-memory ones and quietly accrue cost. Mirror participant join/leave into §23's `voiceParticipants` via LiveKit webhooks.

**§17 compliance — read this before building.** LiveKit makes a teammate-only channel trivial: a second room, or selective subscription. That is precisely the hidden communication channel §17 exists to prevent. Voice stays room-wide, and the constraint deserves a comment in the code so it is not added later as a "feature."

**Push-to-talk** (§42) becomes `setMicrophoneEnabled(bool)` on keydown/keyup.

**Mic permission UX.** The prompt must follow a user gesture, and iOS Safari is strict. Joining voice is an explicit button, never automatic on room entry — which also preserves §69.1's rule that the game is fully playable before voice exists.

## 69.4 Voice State Is Advisory

`voiceParticipants` mirrors a separate system that can desync from the game. Nothing in the engine may gate on it. A player with a broken microphone, a failed SFU connection or voice switched off is a full participant in the game. This is the same separation §68.5 requires of the transports, expressed in state.

## 69.5 Self-Hosting Load

For six players, audio-only, Opus ~32 kbps:

| | Rate |
|---|---|
| Ingress (6 × 1 stream) | ~192 kbps |
| Egress, theoretical (6 × 5 streams) | ~960 kbps |
| **Egress, realistic** | **~150–350 kbps** |

Realistic egress is far below theoretical because DTX makes silence nearly free and LiveKit forwards only active speakers (typically top 3). In a card game one or two people talk at a time. That is roughly **135 MB of egress per room-hour**.

An SFU forwards RTP without decoding or re-encoding, so per-packet cost is essentially SRTP plus routing. A **4 vCPU / 8 GB VM** handles on the order of several hundred concurrent audio participants — roughly 80 simultaneous rooms, sustaining ~25 Mbps egress. Treat that as an order of magnitude to load-test, not a guarantee.

Compute and bandwidth are not the constraint. These are:

1. **No managed platform can host it.** An SFU needs a wide UDP port range (~50000–60000) and a public IP, with TCP/443 fallback. That rules out Render, Railway, Heroku, Vercel and Cloud Run. It needs a VM or bare metal.
2. **TURN.** Roughly 10–20% of users need relay, and relayed traffic passes through the server in both directions. coturn is a second service to run, secure, monitor and TLS-terminate. This is the cost people underestimate — not the SFU.
3. **Geography.** One region serves one country well. Spread players across continents and multi-region routing becomes necessary.
4. **Ops.** Certificates, upgrades, capacity monitoring, and Redis once more than one LiveKit node runs.

## 69.6 Hosting Stack

| Piece | Where | Notes |
|---|---|---|
| React client | **Cloudflare Pages** or Vercel | Free, no spin-down, fast globally. Static build — no reason to serve it from the app host |
| Socket.IO server | **Render free** | WebSockets supported; a single instance suits §59.2 |
| Voice SFU | **LiveKit Cloud free tier** | The only realistic free option; managed TURN included. Final phase only (§69.1) |

Splitting the client off the app host is worth doing regardless: it keeps a cold start from being the first thing a player loads, so a waking server is a brief "connecting" state rather than a blank page.

### Render free tier — verified September 2026

- Spins down after **15 minutes with no inbound traffic**. Since **24 February 2026**, an incoming **WebSocket message** from an existing connection also counts, not only HTTP requests. Socket.IO's Engine.IO heartbeat produces client→server traffic roughly every 25 seconds, so **an active game keeps the service awake**. Verify this holds with the deployed configuration during Phase 2 — if it does not, games would die mid-session.
- Spin-up takes **about one minute** — worse than it sounds for a first visitor, which is the main argument for hosting the client separately.
- 512 MB RAM is ample for in-memory rooms at ~100–200 KB each (§63).

**Restarts stop being rare.** §63 accepts losing in-flight games on restart, but that assumed occasional deploys. On free hosting, spin-downs make it routine, so §33's terminal "server was restarted" screen becomes something players actually encounter. Build it properly the first time rather than treating it as an edge case.

Keep-warm pinging works but consumes the monthly instance-hour allowance to avoid a one-minute wait. Accept the cold start; upgrade when real players make it matter.

### LiveKit Cloud free tier — verified September 2026

The Build plan includes **5,000 WebRTC participant-minutes/month**, **100 concurrent connections**, and **50 GB of data transfer**. The allowance is a **hard cap**: once exceeded, new connections fail rather than incurring charges. It resets monthly and does not roll over.

**What that buys, concretely:** a 6-player, 30-minute game with everyone in voice costs 6 × 30 = **180 participant-minutes**. The monthly allowance is therefore **roughly 27 full games** — comfortable for development and playtesting, and exhausted quickly by real use. The 100-connection limit (~16 concurrent rooms) and the 50 GB transfer are not the binding constraints; **minutes are**.

Plan for this before launch rather than discovering it as failed connections mid-game: either budget for a paid tier, or self-host per §69.5.

### Free self-hosted voice, later

**Oracle Cloud Always Free** is the only genuinely free option with a public IP and full port control, and is large enough for LiveKit plus coturn. The catch is real: capacity for those shapes is frequently unavailable and account approval can be awkward. Treat it as a bonus, not a plan. The 12-month AWS/GCP free tiers are too small once TURN relay is included.

> Free-tier terms change often. The figures above were verified in September 2026 and should be re-checked before the voice phase begins — which, per §69.1, is a long way off.

---

# 70. Iconography and Card Artwork

Two decisions that supersede the emoji-based treatment inherited from the reference screenshots (§64.2).

## 70.1 No Emoji Anywhere

The reference uses emoji for avatars and status. **We do not.** Emoji render differently on every platform and font stack, are inconsistently sized, cannot be recoloured to match a palette, and carry a tone that works against a card game meant to look physical.

Everything that reads as an icon is an **SVG icon**:

- **UI icons — `lucide-react`.** MIT, tree-shakeable, consistent 24px grid, and it covers everything §29 and §65 need: microphone on/off, check, x, arrow-right, users, crown, wifi-off, eye (spectating), volume. Import per-icon so the bundle only carries what is used.
- **Suit pips — our own SVG paths**, never Unicode characters. `♥` and `♦` can take emoji presentation on some platforms and vary by font everywhere else, which would make identical cards look different per device. `SUIT_SYMBOL` in `shared` is retained **for text contexts only** — activity log, chat, debugging — and is explicitly banned from card faces.
- **Player avatars — an in-repo SVG sprite**, one mark per seat position (1–6), deterministic so a player looks the same to everyone. Rendered inside the team-coloured disc from §64.2, which keeps the reference's fastest team read while dropping the emoji. Six marks, drawn on one grid, is a small amount of art and gives full control over stroke weight and palette.

Colour still never carries meaning alone (§64.8): mic state is an icon shape as well as a colour, and team is disc colour plus group placement.

## 70.2 Card Faces — What CSS and SVG Can and Cannot Do

Per §67.1 the deck is generated, not shipped as artwork. Precisely how far that reaches:

| Card | Approach | Assets needed |
|---|---|---|
| Number cards 2–10 | SVG pip layouts on the traditional grid | None |
| Aces | Single large ornamental pip, drawn | None |
| Court cards J, Q, K (12) | See below | Depends on style |
| Jokers (2) | Illustration (§67.5) | Yes |

Number cards and aces are entirely procedural and will look genuinely like playing cards — the traditional pip grid is geometry, and geometry is what SVG is for.

**Court cards are the fork. Decided: procedural now, with a pluggable asset slot.** The card component renders faces through a `CardFace` interface with swappable `CourtFace` and `JokerFace` implementations. A geometric court design ships as the default; supplied artwork drops in later without touching the card component, its geometry, or its motion. Nothing is blocked on art.

The two directions the slot accommodates:

- **Modern/minimal courts** — a drawn monogram or geometric figure per court card, generated from the same system as the rest of the deck. Fully procedural, no assets, coherent with a dimensional card (§67.3), but it will read as a contemporary deck rather than a traditional one.
- **Traditional illustrated courts** — the familiar figures. These cannot be generated procedurally in any convincing way and require **12 image assets** (J/Q/K × 4 suits), plus the 2 jokers from §67.5, for 14 total. Supply them as SVG if at all possible: they scale to every size in §64.3 without variants and stay crisp on the dimensional card.

If image assets are supplied, they are the **only** raster/vector artwork in the deck; ranks, pips, backs, edges and lighting remain generated. Requirements for supplied assets:

- SVG strongly preferred. If raster, provide at 3× the `lg` size (§64.3) for retina, on a transparent background.
- Artwork must sit inside the card's inner margin, not bleed to the edge — the card border, corner indices and thickness (§67.3) are drawn by our component, not by the asset.
- Consistent visual weight across all 12, since courts from different sources side by side in a declaration reveal (§61.3) look broken.
- The two jokers must be unmistakably different at `sm` size (§67.5), as they are separate cards within the same set.

---

# 71. Lobby Team Selection

Section 6 fixes teams by alternating seats and forbids changing them **after** the game starts. This section defines what happens before it: **players pick their own team in the lobby, and the host starts once everyone is in.**

## 71.1 Rules

- A player may choose team A or B at any time while `status === "LOBBY"`, and may switch freely.
- A team is capped at **three** players (`PLAYER_COUNT / 2`). A fourth attempt is rejected with `TEAM_FULL` — the cap is what keeps §6's 3v3 invariant reachable.
- Choosing is **optional**. Players who never pick are auto-filled at start into whichever team has room, so an indecisive table can still play.
- Re-picking the same team is a no-op, not an error. Clients fire this on every tap; a double-tap must not surface a failure.
- After the game starts, `room:select-team` is rejected with `NOT_IN_LOBBY` (§6).

## 71.2 Seats Are Derived From Teams, Not the Reverse

Join order assigns a provisional seat. **Final seats are assigned at game start**, from team membership:

```text
Team A, in join order  ->  seats 1, 3, 5
Team B, in join order  ->  seats 2, 4, 6
```

This preserves §6's alternating seating no matter what order players joined or picked in. The engine still derives `teamId` from seat parity (§57's `createGameState`), so the rules layer is untouched by this feature — team choice is entirely a lobby concern that resolves into a seating arrangement before the first deal.

If the table cannot be split evenly, start is refused with `TEAMS_UNBALANCED` rather than dealing a broken game.

## 71.3 Projection

`PublicPlayer.teamId` is `TeamId | null`. It is `null` only in the lobby, for a player who has not yet picked; once the game starts every player has a team. Clients must render the unassigned state rather than defaulting it to a team, or players will believe they are already on a side and never choose.

## 71.4 Starting

The host alone may start (`NOT_HOST`), and only with all six seats filled (`ROOM_FULL` otherwise). The lobby should show the host a disabled start control with the reason — waiting for players, or teams unbalanced — rather than a button that fails on click.

## 71.5 The Unassigned Pool — Stepping Out

Team choice alone deadlocks. Once both teams are full, every `select-team` is rejected with `TEAM_FULL`, and two players who want to swap have no legal move — the only escape is for someone to leave the room entirely, which loses their seat.

The lobby therefore has a **third, neutral box**: *No team*. Sending `room:select-team` with `teamId: null` steps a player out of their team and into the unassigned pool, freeing their slot.

A swap between two full teams becomes three ordinary moves:

```text
A: [x, y, z]   B: [p, q, r]        both full, nobody can move
        |
x steps out ->  A: [y, z]  none: [x]
        |
p joins A    ->  A: [y, z, p]  B: [q, r]  none: [x]
        |
x joins B    ->  A: [y, z, p]  B: [q, r, x]
```

Rules:

- Stepping out is legal at any time in the lobby, and rejected with `NOT_IN_LOBBY` once the game starts (§6).
- The pool has no capacity limit — it is not a team.
- Players left in the pool at start are auto-assigned exactly as §71.2 describes; stepping out is not a way to avoid playing.
- The neutral box is disabled, not hidden, for a player already in it. Hiding it would make the option invisible precisely when a player is looking for it.

When both teams are full, the full teams' status lines should point at the neutral box ("Full — step out below") rather than simply reading "Full". A dead end that explains its own exit is not a dead end.

---

# 72. Table Size — 4, 6 or 8 Players

Section 55 concluded that six was the only workable count, because 54 cards divide only by 6. That conclusion was correct **for a fixed 54-card deck** and wrong as a general limit: the deck can vary with the table size. The reference app in `design-reference/` demonstrates this — image 1 shows four players holding 12 cards each, image 3 shows six players holding 8 — which is a **48-card deck**, and 48 divides by 4, 6 and 8 alike.

**This supersedes Section 55.**

## 72.1 The Deck Follows the Table

**Revised.** An earlier version of this section dropped set 9 at 4 and 8 players so that every deal came out even. That was the wrong trade: it silently removed the most distinctive set in the deck to buy a tidiness nobody asked for. **All nine sets are in play at every table size.**

| Players | Teams | Deck | Sets | Cards each | Eights & Jokers |
|---|---|---|---|---|---|
| 4 | 2v2 | 54 | 9 | 13–14 | **Yes** |
| 6 | 3v3 | 54 | 9 | 9 | **Yes** |
| 8 | 4v4 | 54 | 9 | 6–7 | **Yes** |

54 divides evenly only by 6, so at 4 and 8 players the deal is uneven: dealing round-robin leaves some players holding exactly one card more than others. A one-card difference is a far smaller cost than losing a whole set, and it is normal in many card games.

`isUnevenDeal(players)` reports this, and the lobby states the range ("13–14 cards each") rather than a single number, so nobody reads their shorter hand as a bug.

Only 4, 6 and 8 are offered. Odd counts cannot form two equal teams, and 10 or 12 would deal fewer than five cards each, which leaves too little to deduce from.

`GameState.activeSetIds` records which sets are in play. **Nothing may assume nine.** A card from an inactive set is rejected as `UNKNOWN_CARD` — it is not in this game at all — and declaring one is `MALFORMED_DECLARATION`.

## 72.2 Chosen at Creation, Fixed Thereafter

The table size is chosen **before the room is created**, because it determines the deck, the join capacity and the team size. It cannot change afterwards: a room mid-lobby cannot resize without invalidating team choices (§71), and a room mid-game obviously cannot.

Join capacity, the §71 team cap (`playerCount / 2`) and seat alternation all derive from it rather than from a constant.

## 72.3 Winning, and the Possibility of a Draw

The win score is a majority of the nine sets: **5**, at every table size. Because nine is odd and every set is awarded to exactly one team, a winner is always reached and **ties are impossible** — §62.2 holds universally now that the set count no longer varies.

The engine still carries a draw path (`drawn: true`, no `winningTeamId`) for the case where every set resolves without a majority. With nine sets that is unreachable, but it is cheap insurance against a future variant with an even set count, and the end screen renders it correctly.

---

# 73. Bots

**Reverses §64.7**, which excluded bots on the grounds that the game was six humans. Bots fill empty seats at any table size and are chosen per team in the lobby.

## 73.1 The Rule That Makes Bots Worth Having

**A bot reasons from `ClientGameState` — the same projection a human at that seat receives (§53) — and from nothing else.**

`chooseMove` takes a projection and returns an intent. It has no access to `GameState`, so it cannot see another player's hand even by accident. Fairness is structural, not policed.

The alternative — letting a "hard" bot read server state — produces an omniscient opponent that is both unbeatable and pointless to play against. It is also the easy mistake to make, because the server has the full state right there.

Every bot intent goes through `reduce` (§57), so a bug in the strategy produces a **rejected action**, never an illegal game state. Bots need no privileged code path and cannot desync the game.

## 73.2 Difficulty Is Memory, Not Information

| | Remembers | Plays |
|---|---|---|
| **Easy** | Its own hand | Random legal ask. Declares only a set it holds entirely itself. |
| **Medium** | The public record — who asked for what, who denied what | Targets players it has reason to suspect. Declares when deduction shows the set sits entirely with its own team. |
| **Hard** | Full constraint propagation, negative inference, card counting | Declares the moment a set collapses to one arrangement, whoever holds it. Occasionally asks for a card it already holds as a bluff (§13). |

A hard bot is hard because it deduces well — the same skill the game asks of a human.

## 73.3 What the Public Record Supports

Knowledge is rebuilt from scratch each turn by replaying `history`. That costs more than an incremental cache and is far harder to get wrong: there is no stale state to drift.

- A **successful** ask pins the card to the asker, overriding every earlier inference.
- A **failed** ask proves only that the *target* lacked it. §13 means nothing can be concluded about the asker.
- **Any** ask proves the asker held at least one card of that set (§48).
- A player with `cardCount === 0` holds nothing.
- Your own hand is exact — which also proves every card you do *not* hold is not yours.

Negative facts stay valid because every transfer is public (§53): a card can only move through an observed ask, and a successful ask replaces the candidate set outright.

**Constraint propagation** is where a hard bot earns its name: once a player's certain cards equal their card count, they can hold nothing else, so they drop out of every other card's candidates — which may pin further cards, and so on.

## 73.4 Seats

A bot occupies a real seat with a real hand and no socket. `broadcastState` skips players without a `socketId`, so bots simply receive nothing.

- **Host only, lobby only.** Adding or removing a bot after the game starts is rejected with `NOT_IN_LOBBY` (§6).
- Bots may be added **to a specific team** or left unassigned for the §71.2 auto-fill.
- **A bot is never made host** (§59.1) — host migration skips them.
- **Bots do not keep a room alive.** They are permanently "connected", so §54's empty-room timer ignores them; a room of nothing but bots is abandoned and closes.
- On an open team turn (§62.5), a bot acts only if **no human on that team could** — humans are never robbed of a turn they are still deciding.

Moves are delayed 0.9–2.2s so play is followable rather than instantaneous.

## 73.5 Practical Effect

Filling a table previously needed 4–8 browser tabs. One tab plus three bots is now a complete game, which makes manual testing of every later feature dramatically cheaper.
