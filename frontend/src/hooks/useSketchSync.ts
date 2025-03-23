import { useCallback, useContext, useEffect, useRef } from "react";
import { WebSocketContext } from "../contexts/webSocketContext";
import { SketchContext } from "../contexts/sketchContext";
import { AuthContext } from "../contexts/authContext";
import { DrawPath, IncomingMessage, MessageType, Region, SketchCommandType } from "../types/interfaces";
import { BASE_URL } from "../utils/constants";
import { axiosInstance } from "../api/axiosInstance";

interface UseSketchSyncProps {
  channelName: string;
  sketchId: string | undefined;
  onUpdateFromServer: (update: Region) => void;
  onClearFromServer: () => void;
}

interface UseSketchSyncReturn {
  // Send methods
  sendUpdate: (path: DrawPath) => void;
  sendClear: () => void;
}

/**
 * Hook to handle all sketch synchronization with the server
 * This hook is responsible for sending updates to server
 * and processing incoming messages
 */
export const useSketchSync = ({
  channelName,
  sketchId,
  onUpdateFromServer,
  onClearFromServer,
}: UseSketchSyncProps): UseSketchSyncReturn => {
  const wsService = useContext(WebSocketContext);
  const sketchContext = useContext(SketchContext);
  const authContext = useContext(AuthContext);

  if (!sketchContext || !wsService || !authContext) {
    throw new Error("Required contexts not found");
  }

  const currentSketchIdRef = useRef(sketchId);
  const isProcessingMessage = useRef(false);
  const messageQueue = useRef<IncomingMessage[]>([]);
  const processMessageRef = useRef<(message: IncomingMessage) => void>();

  // Update ref when sketch ID changes
  useEffect(() => {
    currentSketchIdRef.current = sketchId;
  }, [sketchId]);

  // Send a sketch update to the server
  const sendUpdate = useCallback(
    (path: DrawPath) => {
      if (!channelName || !sketchId || !path.points.length) {
        console.warn("Cannot send update: missing data");
        return;
      }

      try {
        // Calculate bounds for the region
        const points = path.points;
        const minX = Math.min(...points.map((p) => p.x));
        const minY = Math.min(...points.map((p) => p.y));
        const maxX = Math.max(...points.map((p) => p.x));
        const maxY = Math.max(...points.map((p) => p.y));

        console.log(`📤 [useSketchSync] Sending path: ${path.points.length} points, isDrawing=${path.isDrawing}`);

        const updatedRegion = {
          start: { x: minX, y: minY },
          end: { x: maxX, y: maxY },
          paths: [
            {
              points: path.points,
              isDrawing: path.isDrawing,
              strokeWidth: path.strokeWidth,
            },
          ],
        };

        wsService.actions.send({
          channelName,
          type: MessageType.Sketch,
          content: {
            sketchCmd: {
              commandType: SketchCommandType.Update,
              sketchId,
              region: updatedRegion,
            },
          },
        });
      } catch (error) {
        console.error("Failed to send sketch update:", error);
      }
    },
    [wsService, channelName, sketchId]
  );

  // Send a clear command to the server
  const sendClear = useCallback(() => {
    if (!channelName || !sketchId) {
      console.warn("Cannot send clear: missing data");
      return;
    }

    console.log(`🧹 [useSketchSync] Sending clear command`);

    // Send websocket message to clear sketch for all clients
    wsService.actions.send({
      channelName,
      type: MessageType.Sketch,
      content: {
        sketchCmd: {
          commandType: SketchCommandType.Clear,
          sketchId,
        },
      },
    });

    // Make HTTP request to clear sketch in database
    axiosInstance
      .post(
        `${BASE_URL}/clearSketch`,
        {
          channel_name: channelName,
          sketch_id: sketchId,
        },
        {
          headers: {
            Authorization: `Bearer ${authContext.state.token}`,
          },
        }
      )
      .then(() => {
        console.log(`🧹 [useSketchSync] Sketch cleared in database`);
      })
      .catch((error) => {
        console.error(`❌ [useSketchSync] Failed to clear sketch in database:`, error);
      });
  }, [wsService, channelName, sketchId, authContext.state.token]);

  // Handle incoming messages
  const handleMessage = useCallback(
    async (message: IncomingMessage) => {
      if (message.type !== MessageType.Sketch || !message.content.sketchCmd) return;

      const cmd = message.content.sketchCmd;
      console.log(`📥 [useSketchSync] From ${message.username}, cmd: ${cmd.commandType}`);

      if (isProcessingMessage.current) {
        console.log(`⏳ [useSketchSync] Queue message (${messageQueue.current.length} pending)`);
        messageQueue.current.push(message);
        return;
      }

      try {
        isProcessingMessage.current = true;

        // Skip our own messages - we handle everything locally first
        if (message.username === authContext.state.username) {
          console.log(`🔄 [useSketchSync] Ignoring own message (already processed locally)`);
          return;
        }

        // Process messages from other users
        switch (cmd.commandType) {
          case SketchCommandType.Update:
            if (cmd.region && currentSketchIdRef.current === cmd.sketchId) {
              console.log(`🔄 [useSketchSync] Update from ${message.username}: ${cmd.region.paths.length} paths`);
              onUpdateFromServer(cmd.region);
            } else {
              console.log(`⚠️ [useSketchSync] Skipping update - ID mismatch`);
            }
            break;

          case SketchCommandType.Clear:
            if (currentSketchIdRef.current === cmd.sketchId) {
              console.log(`🧹 [useSketchSync] Clear from ${message.username}`);
              onClearFromServer();
            }
            break;

          case SketchCommandType.Delete:
            console.log(`🗑️ [useSketchSync] Delete sketch: ${cmd.sketchId}`);
            sketchContext.actions.removeSketch(cmd.sketchId);
            if (currentSketchIdRef.current === cmd.sketchId) {
              sketchContext.actions.setCurrentSketch(null);
            }
            break;

          case SketchCommandType.New:
            if (cmd.sketchData) {
              console.log(`📝 [useSketchSync] New sketch: ${cmd.sketchData.id}`);
              sketchContext.actions.addSketch(cmd.sketchData);
            }
            break;
        }
      } catch (error) {
        console.error("❌ [useSketchSync] Error:", error);
      } finally {
        isProcessingMessage.current = false;
        if (messageQueue.current.length > 0) {
          const nextMessage = messageQueue.current.shift();
          if (nextMessage) {
            console.log(`⏭️ [useSketchSync] Processing next queued message`);
            processMessageRef.current?.(nextMessage);
          }
        }
      }
    },
    [onUpdateFromServer, onClearFromServer, sketchContext.actions, authContext.state.username]
  );

  // Set up websocket handler
  useEffect(() => {
    if (!wsService) return;

    processMessageRef.current = handleMessage;
    wsService.actions.setMessageHandlers({
      onSketchMessage: handleMessage,
    });

    return () => {
      wsService.actions.setMessageHandlers({});
    };
  }, [wsService, handleMessage]);

  return {
    sendUpdate,
    sendClear,
  };
};
