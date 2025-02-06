import { useCallback, useContext, useEffect, useRef } from "react";
import { WebSocketContext } from "../contexts/webSocketContext";
import { IncomingMessage, MessageType, SketchUpdate } from "../types/interfaces";

export const useSketchWebSocket = (
  currentSketchId: string | undefined,
  onUpdate: (update: SketchUpdate) => void,
  onClear: () => void
) => {
  const wsService = useContext(WebSocketContext);
  const currentSketchIdRef = useRef(currentSketchId);

  useEffect(() => {
    currentSketchIdRef.current = currentSketchId;
  }, [currentSketchId]);

  const handleMessage = useCallback(
    (message: IncomingMessage) => {
      if (!currentSketchIdRef.current) return;

      if (message.type === MessageType.SketchUpdate) {
        const update = message.content.sketchUpdate;
        if (update && update.sketchId !== currentSketchIdRef.current) return;
        console.log("📡 WebSocket Message:", {
          type: message.type,
          sketchId: currentSketchIdRef.current,
          updateSketchId: message.type === MessageType.SketchUpdate ? message.content.sketchUpdate?.sketchId : null,
        });
        onUpdate(update!);
      } else if (message.type === MessageType.ClearSketch) {
        if (message.content.clearSketch === currentSketchIdRef.current) {
          onClear();
        }
      }
    },
    [onUpdate, onClear]
  );

  useEffect(() => {
    if (!wsService) return;
    wsService.actions.setMessageHandlers({ onSketchMessage: handleMessage });
  }, [wsService, handleMessage]);

  return wsService;
};
