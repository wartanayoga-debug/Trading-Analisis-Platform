/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import apiRouter from "./data/models/src/server/routes/api";

import { createServer } from "http";
import { Server } from "socket.io";
import { EventBus } from "./data/models/src/server/engines/event_bus";

// Configure local environment configuration keys
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT ?? 3000);

  const httpServer = createServer(app);

  // Phase 4: WebSocket Infra Setup
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);
    socket.emit("system_status", {
      status: "WS_CONNECTED",
      message: "QuantPrime Stream Ready",
    });

    socket.on("disconnect", () => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);
    });
  });

  // Pipe EventBus to WebSocket
  EventBus.getInstance().on("scan_requested", (evt) => {
    io.emit("live_event", { type: "SCAN_START", data: evt });
  });

  // Basic middleware configuration
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Mount clean modular API Routers
  app.use("/api", apiRouter);

  // Health endpoint checks
  app.get("/api/health", (req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      platform: "IDX & Crypto AI Trading Analysis Platform",
    });
  });

  // Dynamic asset routing setup depending on system environment mode
  if (process.env.NODE_ENV !== "production") {
    console.log("[Server] Active development mode. Initializing Vite developer middleware.");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("[Server] Active production mode. Configuring flat distribution file headers.");
    const distPath = path.join(process.cwd(), "dist");

    // Serve production builds directly
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Core node listening: http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("[Server] Failed to start", err);
  process.exit(1);
});
