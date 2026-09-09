/**
 * Bot runner. Spec §73, §62.4, §62.5.
 *
 * Drives bot seats after every state change. Two invariants:
 *
 *  1. A bot sees only its own projection (§53). `chooseMove` is handed
 *     `projectGameFor(room, game, botId)` — the identical payload a human at
 *     that seat would receive.
 *  2. Every bot action goes through `reduce` (§57), so a bug in the strategy
 *     produces a rejected action, never an illegal game state.
 *
 * Moves are delayed a beat so play is followable rather than instantaneous.
 */

import type { RoomManager } from "../rooms/room-manager.js";
import type { GameRoom } from "../rooms/types.js";
import { projectGameFor } from "../rooms/projection.js";
import { reduce } from "../game/engine.js";
import type { GameEvent } from "@memory-game/shared";
import { chooseMove } from "./strategy.js";

/**
 * Thinking time. Long enough that a human can read the last exchange and keep
 * track of which card moved before the next one happens — a bot chain that
 * fires instantly is unfollowable.
 */
const MIN_DELAY_MS = 4800;
const MAX_DELAY_MS = 5400;

export interface BotHooks {
  /** Broadcasts engine events and the resulting state, exactly as a human move does. */
  publish: (room: GameRoom, events: GameEvent[]) => void;
}

export class BotRunner {
  constructor(
    private rooms: RoomManager,
    private hooks: BotHooks,
  ) {}

  /**
   * Called after every mutation. Finds the bot whose turn it is and schedules
   * its move. Safe to call repeatedly: the per-room timer is replaced, not
   * stacked.
   */
  schedule(room: GameRoom): void {
    if (room.status !== "PLAYING" || !room.game) return;

    const botId = this.whoseTurn(room);
    if (!botId) return;

    const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
    const runtime = this.rooms.runtime(room.id);

    const existing = runtime.timers.get("bot");
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => this.act(room.id, botId), delay);
    timer.unref?.();
    runtime.timers.set("bot", timer);
  }

  /** The bot that may act now, if any. */
  private whoseTurn(room: GameRoom): string | undefined {
    const game = room.game;
    if (!game) return undefined;

    // Capture once so TypeScript keeps the narrowing inside the closure.
    const turn = game.turn;

    if (turn.kind === "PLAYER") {
      const seat = room.players.find((p) => p.id === turn.playerId);
      return seat?.bot ? seat.id : undefined;
    }

    // §62.5: an open team turn. The lowest-seated bot on that team with cards
    // takes it, but only if no human on the team could — humans get priority so
    // a bot never snatches a turn from a teammate who is deciding.
    const team = turn.teamId;
    const members = game.players.filter((p) => p.teamId === team && p.hand.length > 0);
    const seats = members
      .map((m) => room.players.find((p) => p.id === m.id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));

    if (seats.some((p) => !p.bot)) return undefined;
    return seats.sort((a, b) => a.seatPosition - b.seatPosition)[0]?.id;
  }

  private act(roomId: string, botId: string): void {
    const room = this.rooms.get(roomId);
    if (!room?.game || room.status !== "PLAYING") return;

    const seat = room.players.find((p) => p.id === botId);
    if (!seat?.bot) return;

    // §53: the bot reasons from the same projection a human would receive.
    const view = projectGameFor(room, room.game, botId);
    const move = chooseMove({ view, difficulty: seat.bot.difficulty });

    if (move.kind === "NONE") return;

    if (move.kind === "ASK") {
      const result = reduce(room.game, {
        type: "ASK",
        playerId: botId,
        targetId: move.targetId,
        cardId: move.cardId,
      });
      if (!result.ok) return;

      room.game = result.state;
      if (result.state.status === "FINISHED") room.status = "FINISHED";
      this.rooms.touch(room);
      this.hooks.publish(room, result.events);
      this.schedule(room);
      return;
    }

    // §62.4: declaring is open-then-declare, both from the same bot.
    const opened = reduce(room.game, {
      type: "OPEN_DECLARATION",
      playerId: botId,
      now: Date.now(),
    });
    if (!opened.ok) return;
    room.game = opened.state;

    const declared = reduce(room.game, {
      type: "DECLARE",
      playerId: botId,
      setId: move.setId,
      assignments: move.assignments,
    });

    if (!declared.ok) {
      // Leaving a window open would stall the room, so close it and move on.
      const expired = reduce(room.game, { type: "EXPIRE_DECLARATION", now: Date.now() + 1e9 });
      if (expired.ok) {
        room.game = expired.state;
        this.hooks.publish(room, [...opened.events, ...expired.events]);
      }
      return;
    }

    room.game = declared.state;
    if (declared.state.status === "FINISHED") room.status = "FINISHED";
    this.rooms.touch(room);
    this.hooks.publish(room, [...opened.events, ...declared.events]);
    this.schedule(room);
  }
}
