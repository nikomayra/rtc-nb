import { useContext } from "react";
import { WebSocketContext } from "../contexts/webSocketContext";

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocketContext must be used within a WebSocketProvider");
  }
  return context;
};
