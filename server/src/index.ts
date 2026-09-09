/**
 * Server entry point. Spec §3, §54, §59.2.
 *
 * Single process, in-memory rooms (§63). Horizontal scaling would require
 * sticky routing by room id; that is a deliberate limit, not an oversight.
 */

import { networkInterfaces } from "node:os";
import { createGameApp } from "./app.js";
import { config } from "./config.js";
import { isVoiceConfigured } from "./voice/livekit.js";

const { httpServer, rooms, close } = createGameApp();

rooms.startSweeper(config.sweepIntervalMs);

// A port clash is the commonest local failure; say what to do about it rather
// than crashing with an unhandled 'error' event and a stack trace.
httpServer.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `
[server] Port ${config.port} is already in use.
` +
        `         Another instance is probably still running.

` +
        `  Windows:  netstat -ano | findstr :${config.port}
` +
        `            taskkill /F /PID <pid>
` +
        `  macOS/Linux:  lsof -ti:${config.port} | xargs kill -9

` +
        `  Or start on a different port:  PORT=3002 npm run dev
`,
    );
    process.exit(1);
  }
  throw err;
});

/** First non-internal IPv4 address, for the "open this on your phone" line. */
function lanAddress(): string | undefined {
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === "IPv4" && !a.internal) return a.address;
    }
  }
  return undefined;
}

// 0.0.0.0 so other devices on the network can reach it.
httpServer.listen(config.port, "0.0.0.0", () => {
  const lan = lanAddress();
  console.log(`[server] listening on http://localhost:${config.port}`);
  if (lan) console.log(`[server] network:   http://${lan}:${config.port}`);
  console.log(
    isVoiceConfigured()
      ? `[server] voice:     enabled (${config.livekit.url})`
      : "[server] voice:     disabled — set LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET in .env",
  );
});

async function shutdown(signal: string): Promise<void> {
  console.log(`[server] ${signal} received, shutting down`);
  await close();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
