/**
 * Server factory. Kept separate from `index.ts` so tests can boot an instance
 * on an ephemeral port without the module listening as a side effect.
 */

import { createServer, type Server as HttpServer } from "node:http";
import express from "express";
import { Server } from "socket.io";
import { config } from "./config.js";
import { RoomManager } from "./rooms/room-manager.js";
import { registerHandlers, type GameServer } from "./socket/handlers.js";

export interface GameApp {
  httpServer: HttpServer;
  io: GameServer;
  rooms: RoomManager;
  close: () => Promise<void>;
}

export function createGameApp(): GameApp {
  const app = express();
  const httpServer = createServer(app);

  let io: GameServer;

  const rooms = new RoomManager({
    onRoomClosed: (roomId, reason) => {
      io.to(roomId).emit("room:closed", reason);
      // §30/§69: destroy the room's voice resources here once voice exists.
    },
  });

  io = new Server(httpServer, {
    cors: { origin: config.corsOrigins, methods: ["GET", "POST"] },
    // §68.5: the client heartbeat also keeps free-tier hosts awake (§69.6).
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true, rooms: rooms.size, uptime: process.uptime() });
  });

  registerHandlers(io, rooms);

  const close = async (): Promise<void> => {
    rooms.clear();
    await new Promise<void>((resolve) => io.close(() => resolve()));
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  };

  return { httpServer, io, rooms, close };
}
