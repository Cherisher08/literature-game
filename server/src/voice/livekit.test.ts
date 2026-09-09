/**
 * Voice token scope. Spec §30, §58, §69.3.
 *
 * These assert the security properties of a token, not that LiveKit works. A
 * regression here would hand clients room-admin rights or admit a player to a
 * room they are not in.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL = { ...process.env };

async function loadWithCreds(creds: Record<string, string>) {
  vi.resetModules();
  Object.assign(process.env, creds);
  return import("./livekit.js");
}

/** Decodes a JWT payload without verifying it — enough to inspect the grant. */
function payloadOf(token: string): Record<string, unknown> {
  const part = token.split(".")[1]!;
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
}

beforeEach(() => {
  delete process.env["LIVEKIT_URL"];
  delete process.env["LIVEKIT_API_KEY"];
  delete process.env["LIVEKIT_API_SECRET"];
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.resetModules();
});

describe("voice availability (§69.4)", () => {
  it("is unconfigured when credentials are absent", async () => {
    const { isVoiceConfigured, mintVoiceToken } = await loadWithCreds({});
    expect(isVoiceConfigured()).toBe(false);
    await expect(mintVoiceToken("ABC123", "p1", "Alice")).resolves.toBeUndefined();
  });

  it("is available once credentials are present", async () => {
    const { isVoiceConfigured } = await loadWithCreds({
      LIVEKIT_URL: "wss://example.livekit.cloud",
      LIVEKIT_API_KEY: "devkey",
      LIVEKIT_API_SECRET: "devsecretdevsecretdevsecret012345",
    });
    expect(isVoiceConfigured()).toBe(true);
  });

  it("destroying a room is a no-op when unconfigured", async () => {
    const { destroyVoiceRoom } = await loadWithCreds({});
    await expect(destroyVoiceRoom("ABC123")).resolves.toBeUndefined();
  });
});

describe("token scope (§69.3)", () => {
  const creds = {
    LIVEKIT_URL: "wss://example.livekit.cloud",
    LIVEKIT_API_KEY: "devkey",
    LIVEKIT_API_SECRET: "devsecretdevsecretdevsecret012345",
  };

  it("grants join, publish and subscribe for exactly one room (§30)", async () => {
    const { mintVoiceToken } = await loadWithCreds(creds);
    const result = await mintVoiceToken("ABC123", "player-1", "Alice");
    expect(result).toBeDefined();

    const grant = payloadOf(result!.token)["video"] as Record<string, unknown>;
    expect(grant["room"]).toBe("ABC123");
    expect(grant["roomJoin"]).toBe(true);
    expect(grant["canPublish"]).toBe(true);
    expect(grant["canSubscribe"]).toBe(true);
  });

  it("never grants room administration to a client", async () => {
    const { mintVoiceToken } = await loadWithCreds(creds);
    const result = await mintVoiceToken("ABC123", "player-1", "Alice");
    const grant = payloadOf(result!.token)["video"] as Record<string, unknown>;

    expect(grant["roomCreate"]).toBeFalsy();
    expect(grant["roomAdmin"]).toBeFalsy();
    expect(grant["roomList"]).toBeFalsy();
  });

  it("denies the data channel — game state travels over the socket (§17, §44)", async () => {
    const { mintVoiceToken } = await loadWithCreds(creds);
    const result = await mintVoiceToken("ABC123", "player-1", "Alice");
    const grant = payloadOf(result!.token)["video"] as Record<string, unknown>;
    expect(grant["canPublishData"]).toBeFalsy();
  });

  it("identifies the holder by playerId, so speakers map onto the board", async () => {
    const { mintVoiceToken } = await loadWithCreds(creds);
    const result = await mintVoiceToken("ABC123", "player-1", "Alice");
    const payload = payloadOf(result!.token);
    expect(payload["sub"]).toBe("player-1");
    expect(payload["name"]).toBe("Alice");
  });

  it("issues an expiring token (§69.3)", async () => {
    const { mintVoiceToken } = await loadWithCreds(creds);
    const result = await mintVoiceToken("ABC123", "player-1", "Alice");
    const payload = payloadOf(result!.token);
    expect(typeof payload["exp"]).toBe("number");
    expect(payload["exp"] as number).toBeGreaterThan(Date.now() / 1000);
  });

  it("scopes separate rooms to separate tokens", async () => {
    const { mintVoiceToken } = await loadWithCreds(creds);
    const a = await mintVoiceToken("ROOMAA", "p1", "Alice");
    const b = await mintVoiceToken("ROOMBB", "p1", "Alice");
    const ga = payloadOf(a!.token)["video"] as Record<string, unknown>;
    const gb = payloadOf(b!.token)["video"] as Record<string, unknown>;
    expect(ga["room"]).toBe("ROOMAA");
    expect(gb["room"]).toBe("ROOMBB");
    expect(a!.token).not.toBe(b!.token);
  });
});
