import { useCallback, useEffect, useRef } from "react";
import { useWebSocketContext } from "./useWebSocketContext";
import { useAuthContext } from "./useAuthContext";
import { IncomingMessage, MessageType, SketchCommandType, SketchCommand, Region } from "../types/interfaces";
import { ChannelMessageHandler } from "../contexts/webSocketContext";

// Define the structure for sketch update data passed to callbacks
export interface SketchUpdateData {
  region: Region;
  isPartial: boolean;
  sketchId: string;
  username: string;
}

// Callbacks provided by the consuming hook (useSketchManager)
// Only needs to handle incoming drawing updates.
interface SketchSyncCallbacks {
  onUpdateFromServer: (data: SketchUpdateData) => void;
}

// Props for the useSketchSync hook
interface UseSketchSyncProps {
  channelName: string | undefined;
  sketchId: string | undefined; // The specific sketch ID this hook synchronizes
  callbacks: SketchSyncCallbacks;
}

// Return value: Only provides the ability to send drawing updates.
interface UseSketchSyncReturn {
  sendUpdate: (region: Region, isPartial: boolean) => void;
}

/**
 * Hook responsible ONLY for real-time synchronization of SKETCH DRAWING updates (partial/complete)
 * via WebSockets for a specific, active sketch.
 * Handles sending local drawing updates and processing incoming drawing updates from others.
 * Other sketch lifecycle events (create, delete, clear) are handled by SketchProvider.
 */
export const useSketchSync = ({ channelName, sketchId, callbacks }: UseSketchSyncProps): UseSketchSyncReturn => {
  const wsService = useWebSocketContext();
  const { state: authState } = useAuthContext();

  // Use refs to store current values to avoid stale closures in callbacks
  const currentSketchIdRef = useRef(sketchId);
  const channelNameRef = useRef(channelName);
  const callbacksRef = useRef(callbacks);

  // Update refs when props change
  useEffect(() => {
    currentSketchIdRef.current = sketchId;
  }, [sketchId]);

  useEffect(() => {
    channelNameRef.current = channelName;
  }, [channelName]);

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  // --- Send Operations ---

  // Helper to send any sketch command
  const sendSketchCommand = useCallback(
    (commandPayload: SketchCommand) => {
      const currentChannel = channelNameRef.current;
      const currentWsSketchId = currentSketchIdRef.current; // Use the sketchId managed by this hook instance

      // Ensure we have a channel, a sketch ID for this hook, and are connected
      if (!currentChannel || !currentWsSketchId) {
        if (import.meta.env.DEV)
          console.warn("[useSketchSync] Cannot send command: Missing channel or sketchId for this sync instance.");
        return;
      }
      if (!wsService.state.channelConnected) {
        if (import.meta.env.DEV)
          console.warn("[useSketchSync] Cannot send command: WebSocket not connected/channel not joined.");
        return;
      }

      // Ensure the command payload targets the correct sketch ID for this hook
      if (commandPayload.sketchId !== currentWsSketchId) {
        console.error(
          `[useSketchSync] Mismatch: Command targets sketch ${commandPayload.sketchId}, but hook is for ${currentWsSketchId}. Aborting send.`
        );
        return;
      }

      wsService.actions.send({
        channelName: currentChannel,
        type: MessageType.Sketch,
        content: {
          sketchCmd: commandPayload,
        },
      });
    },
    [wsService] // wsService actions are stable
  );

  // Send a drawing update (partial or complete) containing a region
  const sendUpdate = useCallback(
    (region: Region, isPartial: boolean) => {
      const currentWsSketchId = currentSketchIdRef.current;
      if (!currentWsSketchId || !region) {
        if (import.meta.env.DEV)
          console.warn("[useSketchSync] Cannot send update: Missing sketchId or region data for this sync instance.");
        return;
      }

      if (import.meta.env.DEV)
        console.log(
          `📤 [useSketchSync] Sending ${isPartial ? "PARTIAL" : "COMPLETE"} update for sketch ${currentWsSketchId}`
        );

      sendSketchCommand({
        commandType: SketchCommandType.Update,
        sketchId: currentWsSketchId, // Use the hook's sketchId
        region: region,
        isPartial: isPartial,
      });
    },
    [sendSketchCommand]
  );

  // --- Incoming Message Handler --- // Focuses ONLY on UPDATE commands

  const handleIncomingSketchMessage = useCallback(
    (message: IncomingMessage) => {
      // Basic validation
      if (message.type !== MessageType.Sketch || !message.content.sketchCmd) {
        return;
      }

      const cmd = message.content.sketchCmd;
      const senderUsername = message.username;
      const currentWsSketchId = currentSketchIdRef.current;

      // Ignore own messages
      if (senderUsername === authState.username) {
        return;
      }

      // Ignore messages for sketches other than the one this hook instance is managing
      if (cmd.sketchId !== currentWsSketchId) {
        return;
      }

      // Process only UPDATE commands relevant to this hook
      if (cmd.commandType === SketchCommandType.Update) {
        if (import.meta.env.DEV)
          console.log(
            `📥 [useSketchSync] Received ${
              cmd.isPartial ? "PARTIAL" : "COMPLETE"
            } update from ${senderUsername} for sketch ${cmd.sketchId}`
          );

        // Validate required fields for an update
        if (cmd.region && typeof cmd.isPartial === "boolean") {
          // Call the callback provided by useSketchManager
          callbacksRef.current.onUpdateFromServer?.({
            region: cmd.region,
            isPartial: cmd.isPartial,
            sketchId: cmd.sketchId,
            username: senderUsername,
          });
        } else {
          console.warn("[useSketchSync] Received invalid sketch update message (missing region/isPartial):", cmd);
        }
      } else {
        // Ignore NEW, DELETE, CLEAR commands in this hook
        if (import.meta.env.DEV) console.log(`[useSketchSync] Ignoring non-UPDATE command: ${cmd.commandType}`);
      }
    },
    [authState.username] // Dependency: authState to check against sender
  );

  // --- Effect to Register WebSocket Handlers --- // Specific to this hook's concerns
  useEffect(() => {
    const handlerKey = `sketchSync_${sketchId}`;

    const handlerConfig: ChannelMessageHandler = {
      onSketchMessage: handleIncomingSketchMessage,
    };
    // Add handler with unique key
    wsService.actions.addChannelHandlers(handlerKey, handlerConfig);
    if (import.meta.env.DEV) console.log(`[useSketchSync] Added sketch message handler (Key: ${handlerKey})`);

    return () => {
      // Remove handler with the same unique key
      wsService.actions.removeChannelHandlers(handlerKey);
      if (import.meta.env.DEV) console.log(`[useSketchSync] Removed sketch message handler (Key: ${handlerKey})`);
    };
  }, [wsService, handleIncomingSketchMessage, sketchId]);

  return {
    sendUpdate,
  };
};
