/**
 * Server entry point. Spec §3, §54, §59.2.
 *
 * Single process, in-memory rooms (§63). Horizontal scaling would require
 * sticky routing by room id; that is a deliberate limit, not an oversight.
 */

import { createGameApp } from "./app.js";
import { config } from "./config.js";

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

httpServer.listen(config.port, () => {
  console.log(`[server] listening on :${config.port}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`[server] ${signal} received, shutting down`);
  await close();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
