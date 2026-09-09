/**
 * Boundary validation. Spec §58.
 *
 * Every inbound payload is schema-validated here before it reaches the engine.
 * A cardId arriving as an object or an array is rejected at the edge, not
 * somewhere inside a handler.
 */

import { z } from "zod";
import {
  ALL_SET_IDS,
  PLAYER_COUNTS,
  MAX_CHAT_LENGTH,
  MAX_NAME_LENGTH,
  PROTOCOL_VERSION,
  ROOM_CODE_LENGTH,
  isValidCardId,
} from "@memory-game/shared";

/** Control characters, including DEL and the C1 range. */
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;

/** Strips control characters, collapses whitespace, trims (§58). */
export function sanitizeName(raw: string): string {
  return raw
    .replace(CONTROL_CHARS, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

export function sanitizeChat(raw: string): string {
  return raw
    .replace(CONTROL_CHARS, "")
    .trim()
    .slice(0, MAX_CHAT_LENGTH);
}

const nameSchema = z
  .string()
  .transform(sanitizeName)
  .refine((n) => n.length >= 1, { message: "name is empty after trimming" });

const roomIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(ROOM_CODE_LENGTH);

const cardIdSchema = z.string().refine(isValidCardId, { message: "unknown card" });

const setIdSchema = z
  .number()
  .int()
  .refine((n): n is (typeof ALL_SET_IDS)[number] => (ALL_SET_IDS as readonly number[]).includes(n));

const actionIdSchema = z.string().min(8).max(64);

export const envelope = <T extends z.ZodTypeAny>(payload: T) =>
  z.object({ actionId: actionIdSchema, payload });

export const createRoomSchema = z.object({
  protocolVersion: z.literal(PROTOCOL_VERSION),
  name: nameSchema,
  // §72: only 4, 6 or 8 divide their decks evenly into two equal teams.
  playerCount: z
    .number()
    .int()
    .refine((n): n is (typeof PLAYER_COUNTS)[number] =>
      (PLAYER_COUNTS as readonly number[]).includes(n),
    ),
});

export const joinRoomSchema = z.object({
  protocolVersion: z.literal(PROTOCOL_VERSION),
  roomId: roomIdSchema,
  name: nameSchema,
  sessionToken: z.string().min(8).max(128).optional(),
});

export const askCardSchema = envelope(
  z.object({
    targetPlayerId: z.string().min(1).max(64),
    cardId: cardIdSchema,
  }),
);

export const declareSchema = envelope(
  z.object({
    setId: setIdSchema,
    assignments: z
      .array(z.object({ cardId: cardIdSchema, playerId: z.string().min(1).max(64) }))
      .length(6),
  }),
);

export const selectTeamSchema = z.object({
  // §71.5: null steps the player out to the unassigned pool.
  teamId: z.enum(["A", "B"]).nullable(),
});

export const voiceStateSchema = z.object({ connected: z.boolean() });

export const emptyEnvelopeSchema = envelope(z.object({}).strict());

export const chatSendSchema = envelope(
  z.object({
    message: z
      .string()
      .transform(sanitizeChat)
      .refine((m) => m.length >= 1, { message: "empty message" }),
  }),
);

/** Parses and returns the value, or undefined if invalid. */
export function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> | undefined {
  const result = schema.safeParse(input);
  return result.success ? result.data : undefined;
}
