/**
 * Runtime configuration. All durations live in constants (§54).
 *
 * Loads .env before anything reads process.env. Node 22 has this built in, so
 * there is no dotenv dependency. Both the repo root and server/ are checked,
 * because the server runs with its workspace as the cwd while .env is normally
 * kept at the root.
 */

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// server/src -> server -> repo root
const candidates = [
  resolve(here, "../../.env"),
  resolve(here, "../.env"),
  resolve(process.cwd(), ".env"),
];

// Tests set their own environment. Loading .env here would restore real
// credentials that a test had deliberately cleared, so skip it under Vitest.
if (!process.env["VITEST"]) {
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    try {
      process.loadEnvFile(file);
    } catch {
      // A malformed .env should not stop the server booting.
    }
  }
}

const num = (v: string | undefined, fallback: number): number => {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

export const config = {
  port: num(process.env["PORT"], 3001),
  /** Comma-separated allowed origins; "*" in development. */
  corsOrigins: (process.env["CORS_ORIGINS"] ?? "*").split(",").map((s) => s.trim()),
  sweepIntervalMs: num(process.env["SWEEP_INTERVAL_MS"], 60_000),
  isProduction: process.env["NODE_ENV"] === "production",

  /** §69: voice is optional. Absent credentials simply disable it. */
  livekit: {
    url: process.env["LIVEKIT_URL"] ?? "",
    apiKey: process.env["LIVEKIT_API_KEY"] ?? "",
    apiSecret: process.env["LIVEKIT_API_SECRET"] ?? "",
  },
};
