import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

let wss: WebSocketServer | null = null;
let initialized = false;

export function setupWebSocket(server: Server): WebSocketServer {
  // Guard against re-initialization (hot reload safety)
  if (initialized && wss) {
    return wss;
  }

  wss = new WebSocketServer({ server, path: "/ws" });
  initialized = true;

  wss.on("connection", (ws) => {
    console.log("WebSocket client connected");

    ws.on("close", () => {
      console.log("WebSocket client disconnected");
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
  });

  return wss;
}

export function broadcastShiftUpdate(shiftId: string, type: "interest_added" | "interest_removed" | "shift_assigned" | "shift_updated") {
  if (!wss) return;

  const message = JSON.stringify({
    type: "shift_update",
    shiftId,
    updateType: type,
    timestamp: new Date().toISOString(),
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}
