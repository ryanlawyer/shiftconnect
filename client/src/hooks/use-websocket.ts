import { useEffect, useRef, useCallback } from "react";
import { queryClient } from "@/lib/queryClient";

interface ShiftUpdateMessage {
  type: "shift_update";
  shiftId: string;
  updateType: "interest_added" | "interest_removed" | "shift_assigned" | "shift_updated";
  timestamp: string;
}

export function useShiftWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log("WebSocket connected for shift updates");
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: ShiftUpdateMessage = JSON.parse(event.data);
          
          if (message.type === "shift_update") {
            queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
            queryClient.invalidateQueries({ queryKey: ["/api/shifts", message.shiftId] });
            queryClient.invalidateQueries({ queryKey: [`/api/shifts/${message.shiftId}/interests`] });
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      wsRef.current.onclose = () => {
        console.log("WebSocket disconnected, reconnecting in 3s...");
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      wsRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);
}
