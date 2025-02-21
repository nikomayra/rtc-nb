import { useCallback, useContext, useEffect, useRef } from "react";
import { WebSocketContext } from "../contexts/webSocketContext";
import { SketchContext } from "../contexts/sketchContext";
import { IncomingMessage, MessageType, SketchCommandType, Region } from "../types/interfaces";
import { AuthContext } from "../contexts/authContext";

export const useSketchWebSocket = (
  currentSketchId: string | undefined,
  onUpdate: (update: Region) => void,
  onClear: () => void
) => {
  const wsService = useContext(WebSocketContext);
  const sketchContext = useContext(SketchContext);
  const authContext = useContext(AuthContext);
  if (!sketchContext || !wsService || !authContext) throw new Error("Context not found");

  const currentSketchIdRef = useRef(currentSketchId);
  const isProcessingMessage = useRef(false);
  const messageQueue = useRef<IncomingMessage[]>([]);
  const processMessageRef = useRef<(message: IncomingMessage) => void>();

  useEffect(() => {
    currentSketchIdRef.current = currentSketchId;
  }, [currentSketchId]);

  const handleMessage = useCallback(
    async (message: IncomingMessage) => {
      if (message.type !== MessageType.Sketch || !message.content.sketchCmd) return;

      if (isProcessingMessage.current) {
        messageQueue.current.push(message);
        return;
      }

      try {
        isProcessingMessage.current = true;
        const cmd = message.content.sketchCmd;

        switch (cmd.commandType) {
          case SketchCommandType.Update:
            if (cmd.region && currentSketchIdRef.current === cmd.sketchId) {
              onUpdate(cmd.region);
            }
            break;
          case SketchCommandType.Clear:
            if (currentSketchIdRef.current === cmd.sketchId) {
              onClear();
            }
            break;
          case SketchCommandType.Delete:
            sketchContext.actions.removeSketch(cmd.sketchId);
            if (currentSketchIdRef.current === cmd.sketchId) {
              sketchContext.actions.setCurrentSketch(null);
            }
            break;
          case SketchCommandType.New:
            if (cmd.sketchData) {
              sketchContext.actions.addSketch(cmd.sketchData);
            }
            break;
        }
      } catch (error) {
        console.error("Error processing sketch message:", error);
      } finally {
        isProcessingMessage.current = false;
        // Process next message if any
        if (messageQueue.current.length > 0) {
          const nextMessage = messageQueue.current.shift();
          if (nextMessage) {
            processMessageRef.current?.(nextMessage);
          }
        }
      }
    },
    [onUpdate, onClear, sketchContext.actions]
  );

  useEffect(() => {
    if (!wsService) return;

    // console.log("🔌 Setting up sketch message handler");
    processMessageRef.current = handleMessage;
    wsService.actions.setMessageHandlers({
      onSketchMessage: handleMessage,
    });

    return () => {
      // console.log("🔌 Cleaning up sketch message handler");
      wsService.actions.setMessageHandlers({});
    };
  }, [wsService, handleMessage]);
};
