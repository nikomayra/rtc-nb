import { useCallback, useContext, useEffect, useRef } from "react";
import { WebSocketContext } from "../contexts/webSocketContext";
import { SketchContext } from "../contexts/sketchContext";
import { AuthContext } from "../contexts/authContext";
import { DrawPath, IncomingMessage, MessageType, Region, SketchCommandType } from "../types/interfaces";
import { BASE_URL } from "../utils/constants";
import { axiosInstance } from "../api/axiosInstance";

// Debug flag for logging control
const DEBUG = true;

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

  // Refs to track current state
  const currentSketchIdRef = useRef(sketchId);
  const isProcessingMessage = useRef(false);
  const messageQueue = useRef<IncomingMessage[]>([]);

  // Update ref when sketch ID changes
  useEffect(() => {
    currentSketchIdRef.current = sketchId;
  }, [sketchId]);

  // Send a sketch update to the server
  const sendUpdate = useCallback(
    (path: DrawPath) => {
      if (!channelName || !sketchId || !path.points.length) {
        if (DEBUG) console.warn("[useSketchSync] Cannot send update: missing data");
        return;
      }

      try {
        // Calculate bounds for the region
        const points = path.points;
        const minX = Math.min(...points.map((p) => p.x));
        const minY = Math.min(...points.map((p) => p.y));
        const maxX = Math.max(...points.map((p) => p.x));
        const maxY = Math.max(...points.map((p) => p.y));

        if (DEBUG) console.log(`📤 [useSketchSync] Sending path with ${path.points.length} points`);

        // Create the region object
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

        // Send the update via WebSocket
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
        console.error("[useSketchSync] Failed to send update:", error);
      }
    },
    [wsService, channelName, sketchId]
  );

  // Send a clear command to the server
  const sendClear = useCallback(() => {
    if (!channelName || !sketchId) {
      if (DEBUG) console.warn("[useSketchSync] Cannot send clear: missing data");
      return;
    }

    if (DEBUG) console.log(`🧹 [useSketchSync] Sending clear command`);

    // Send WebSocket message for real-time update
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

    // Also make HTTP request to persist the clear operation
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
      .catch((error) => {
        console.error(`❌ [useSketchSync] Failed to clear sketch in database:`, error);
      });
  }, [wsService, channelName, sketchId, authContext.state.token]);

  // Handle incoming messages
  const handleMessage = useCallback(
    async (message: IncomingMessage) => {
      if (message.type !== MessageType.Sketch || !message.content.sketchCmd) return;

      // Skip if we're already processing a message - will be handled by the queue
      if (isProcessingMessage.current) {
        if (DEBUG) console.log(`⏳ [useSketchSync] Queue message (${messageQueue.current.length + 1} pending)`);
        messageQueue.current.push(message);
        return;
      }

      try {
        isProcessingMessage.current = true;
        const cmd = message.content.sketchCmd;

        // Skip our own messages - handled locally already
        if (message.username === authContext.state.username) {
          if (DEBUG) console.log(`🔄 [useSketchSync] Ignoring own message`);
          return;
        }

        // Process based on command type
        switch (cmd.commandType) {
          case SketchCommandType.Update:
            if (cmd.region && currentSketchIdRef.current === cmd.sketchId) {
              if (DEBUG) console.log(`🔄 [useSketchSync] Update: ${cmd.region.paths?.length || 0} paths`);
              onUpdateFromServer(cmd.region);
            }
            break;

          case SketchCommandType.Clear:
            if (currentSketchIdRef.current === cmd.sketchId) {
              if (DEBUG) console.log(`🧹 [useSketchSync] Clear from ${message.username}`);
              onClearFromServer();
            }
            break;

          case SketchCommandType.Delete:
            if (DEBUG) console.log(`🗑️ [useSketchSync] Delete sketch: ${cmd.sketchId}`);
            sketchContext.actions.deleteSketch(cmd.sketchId, authContext.state.token);
            if (currentSketchIdRef.current === cmd.sketchId) {
              sketchContext.actions.setCurrentSketch(null);
            }
            break;

          case SketchCommandType.New:
            if (cmd.sketchData) {
              if (DEBUG) console.log(`📝 [useSketchSync] New sketch: ${cmd.sketchData.id}`);
              sketchContext.actions.createSketch(
                channelName,
                cmd.sketchData.displayName,
                cmd.sketchData.width,
                cmd.sketchData.height,
                authContext.state.token
              );
            }
            break;
        }
      } catch (error) {
        console.error("❌ [useSketchSync] Error:", error);
      } finally {
        isProcessingMessage.current = false;

        // Process the next message if any are queued
        if (messageQueue.current.length > 0 && !isProcessingMessage.current) {
          const nextMessage = messageQueue.current.shift();
          if (nextMessage) {
            handleMessage(nextMessage); // Process the next message
          }
        }
      }
    },
    [authContext, sketchContext.actions, onUpdateFromServer, onClearFromServer, channelName]
  );

  // Set up WebSocket handler
  useEffect(() => {
    wsService.actions.setMessageHandlers({
      onSketchMessage: handleMessage,
    });

    // Clean up on unmount
    return () => {
      wsService.actions.setMessageHandlers({});
    };
  }, [wsService, handleMessage]);

  return {
    sendUpdate,
    sendClear,
  };
};
