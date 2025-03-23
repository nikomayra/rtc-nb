import { useContext } from "react";
import { WebSocketContext, WebSocketContextType } from "../contexts/webSocketContext";

// Custom hook for using the WebSocket context
export const useWebSocketContext = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocketContext must be used within a WebSocketProvider");
  }
  return context;
};
