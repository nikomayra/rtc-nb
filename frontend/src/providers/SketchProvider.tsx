import { useState, useMemo, useEffect, useCallback } from "react";
import { initialState, SketchContext, SketchActions } from "../contexts/sketchContext";
import {
  Sketch,
  DrawPath,
  APIErrorResponse,
  SketchSchema,
  IncomingMessage,
  MessageType,
  SketchCommandType,
} from "../types/interfaces";
import { z } from "zod";
import { sketchApi } from "../api/sketchApi";
import { useNotification } from "../hooks/useNotification";
import { useAuthContext } from "../hooks/useAuthContext";
import { useSystemContext } from "../hooks/useSystemContext";
import { useWebSocketContext } from "../hooks/useWebSocketContext";
import { ChannelMessageHandler } from "../contexts/webSocketContext";

export const SketchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authContext = useAuthContext();
  const systemContext = useSystemContext();
  const webSocketContext = useWebSocketContext();
  const { showError, showSuccess } = useNotification();

  const [state, setState] = useState(initialState);
  const { state: systemState } = systemContext;
  const { state: authState } = authContext;
  const { state: webSocketState } = webSocketContext;

  // Stable state actions
  const stateActions = useMemo(
    () => ({
      setCurrentSketch: (sketch: Sketch | null) => {
        if (import.meta.env.DEV) console.log(`📝 [SketchProvider] Setting current sketch: ${sketch?.id || "null"}`);
        setState((prev) => ({
          ...prev,
          currentSketch: sketch,
          paths: sketch?.id !== prev.currentSketch?.id ? [] : prev.paths,
        }));
      },
      addPath: (path: DrawPath) => {
        setState((prev) => ({
          ...prev,
          paths: [...prev.paths, path],
        }));
      },
      clearPaths: () => setState((prev) => ({ ...prev, paths: [] })),
      setLoading: (isLoading: boolean) => setState((prev) => ({ ...prev, isLoading })),
      setSketches: (sketches: Sketch[]) => {
        if (import.meta.env.DEV) console.log(`📝 [SketchProvider] Setting sketches list (count: ${sketches.length})`);
        setState((prev) => ({
          ...prev,
          sketches,
        }));
      },
    }),
    []
  );

  // Service actions defined first
  const serviceActions = useMemo(() => {
    return {
      loadSketches: async (channelName: string): Promise<Sketch[]> => {
        if (!authState.token) throw new Error("Not authenticated");
        stateActions.setLoading(true);
        try {
          const response = await sketchApi.getSketches(channelName, authState.token);
          if (!response.success) {
            throw new Error((response as APIErrorResponse).error.message || "Failed to load sketches");
          }
          const sketches = z.array(SketchSchema).parse(response.data);
          stateActions.setSketches(sketches);
          return sketches;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to load sketches";
          console.error("[SketchProvider] Load Sketches Error:", error);
          showError(message);
          stateActions.setSketches([]); // Clear sketches on error
          throw error;
        } finally {
          stateActions.setLoading(false);
        }
      },

      createSketch: async (
        channelName: string,
        displayName: string,
        width: number,
        height: number
      ): Promise<Sketch> => {
        if (!authState.token) throw new Error("Not authenticated");
        stateActions.setLoading(true);
        try {
          const response = await sketchApi.createSketch(channelName, displayName, width, height, authState.token);
          if (!response.success) {
            throw new Error((response as APIErrorResponse).error.message || "Failed to create sketch");
          }
          const newSketch = SketchSchema.parse(response.data);
          setState((prev) => ({ ...prev, sketches: [...prev.sketches, newSketch] }));
          showSuccess("Sketch created successfully");
          return newSketch;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to create sketch";
          console.error("[SketchProvider] Create Sketch Error:", error);
          const finalMessage = message.includes("limit reached") ? "Channel sketch limit reached" : message;
          showError(finalMessage);
          throw error;
        } finally {
          stateActions.setLoading(false);
        }
      },

      loadSketch: async (channelName: string, sketchId: string): Promise<Sketch | null> => {
        if (!authState.token) throw new Error("Not authenticated");
        stateActions.setLoading(true);
        try {
          const response = await sketchApi.getSketch(channelName, sketchId, authState.token);

          if (!response.success && (response as APIErrorResponse).error.message?.includes("not found")) {
            // If sketch not found, ensure it's removed from local state if present
            setState((prev) => {
              const sketchExists = prev.sketches.some((s) => s.id === sketchId);
              const newSketches = sketchExists ? prev.sketches.filter((s) => s.id !== sketchId) : prev.sketches;
              const newCurrentSketch = prev.currentSketch?.id === sketchId ? null : prev.currentSketch;
              return { ...prev, sketches: newSketches, currentSketch: newCurrentSketch };
            });
            showError("Sketch not found.");
            return null;
          }

          if (!response.success) {
            throw new Error((response as APIErrorResponse).error.message || "Failed to load sketch");
          }

          const sketch = SketchSchema.parse(response.data);
          stateActions.setCurrentSketch(sketch);
          return sketch;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to load sketch";
          console.error("[SketchProvider] Load Sketch Error:", error);
          stateActions.setCurrentSketch(null);
          showError(message);
          throw error;
        } finally {
          stateActions.setLoading(false);
        }
      },

      deleteSketch: async (sketchId: string): Promise<void> => {
        if (!authState.token) throw new Error("Not authenticated");
        stateActions.setLoading(true);
        try {
          await sketchApi.deleteSketch(sketchId, authState.token);
          showSuccess("Sketch deleted successfully");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to delete sketch";
          console.error("[SketchProvider] Delete Sketch Error:", error);
          showError(message);
          throw error;
        } finally {
          stateActions.setLoading(false);
        }
      },

      clearSketch: async (channelName: string, sketchId: string): Promise<void> => {
        if (!authState.token) throw new Error("Not authenticated");
        // Ensure channelName matches current context channel if required by API (or remove if sketchId is globally unique)
        const currentChannel = systemContext.state.currentChannel?.name;
        if (!currentChannel || channelName !== currentChannel) {
          throw new Error("Cannot clear sketch for a different channel.");
        }

        stateActions.setLoading(true);
        try {
          await sketchApi.clearSketch(channelName, sketchId, authState.token);
          showSuccess("Sketch cleared successfully");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to clear sketch";
          console.error("[SketchProvider] Clear Sketch Error:", error);
          showError(message);
          throw error;
        } finally {
          stateActions.setLoading(false);
        }
      },
    };
  }, [authState.token, stateActions, showError, showSuccess, systemContext.state.currentChannel?.name]);

  // Combine state and service actions into the final actions object
  const actions: SketchActions = useMemo(
    () => ({
      ...stateActions,
      ...serviceActions,
    }),
    [stateActions, serviceActions]
  );

  // Define the context value using the combined actions
  const value = useMemo(() => ({ state, actions }), [state, actions]);

  // --- WebSocket Message Handling (for non-UPDATE events) --- //
  const SKETCH_PROVIDER_HANDLER_KEY = "sketchProvider";

  const handleIncomingSketchMessage = useCallback(
    (message: IncomingMessage) => {
      if (message.type !== MessageType.Sketch || !message.content.sketchCmd) return;

      const cmd = message.content.sketchCmd;
      const sender = message.username;
      const currentChannelName = systemContext.state.currentChannel?.name;

      if (message.channelName !== currentChannelName) return;
      if (sender === authState.username) return;

      if (import.meta.env.DEV)
        console.log(`[SketchProvider] WS Event from ${sender}: ${cmd.commandType} for sketch ${cmd.sketchId}`);

      switch (cmd.commandType) {
        case SketchCommandType.New:
          if (currentChannelName) {
            actions.loadSketches(currentChannelName).catch((err) => {
              console.error("[SketchProvider] WS: Failed to reload sketches on NEW command:", err);
            });
          }
          break;

        case SketchCommandType.Delete:
          setState((prev) => {
            const sketchExists = prev.sketches.some((s) => s.id === cmd.sketchId);
            if (!sketchExists) return prev;

            const newSketches = prev.sketches.filter((s) => s.id !== cmd.sketchId);
            const newCurrentSketch = prev.currentSketch?.id === cmd.sketchId ? null : prev.currentSketch;
            if (import.meta.env.DEV) console.log(`[SketchProvider] WS: Removing deleted sketch ${cmd.sketchId}`);
            return { ...prev, sketches: newSketches, currentSketch: newCurrentSketch };
          });
          break;

        case SketchCommandType.Clear:
          if (state.currentSketch?.id === cmd.sketchId && currentChannelName) {
            if (import.meta.env.DEV) console.log(`[SketchProvider] WS: Reloading cleared sketch ${cmd.sketchId}`);
            actions.loadSketch(currentChannelName, cmd.sketchId).catch((err) => {
              console.error("[SketchProvider] WS: Failed to reload sketch on CLEAR command:", err);
            });
          }
          break;

        // UPDATE messages are handled by useSketchSync -> useSketchManager
        case SketchCommandType.Update:
          break;

        default:
          console.warn(`[SketchProvider] Unhandled sketch command type via WS: ${cmd.commandType}`);
      }
    },
    [actions, systemContext.state.currentChannel?.name, authState.username, state.currentSketch?.id]
  );

  // --- Effects ---

  // Effect to load sketches when channel changes and user is authenticated/connected
  useEffect(() => {
    const channel = systemState.currentChannel;
    const token = authState.token;
    const connected = webSocketState.channelConnected; // Use channel connection status now

    if (channel && token && connected) {
      if (import.meta.env.DEV)
        console.log(`🔄 [SketchProvider] Channel/Auth ready (${channel.name}). Loading sketches.`);
      actions.loadSketches(channel.name).catch((err: unknown) => {
        // Error is handled and shown within loadSketches
        if (import.meta.env.DEV) console.error("[SketchProvider] Initial loadSketches failed in effect.", err);
      });
    } else {
      // Conditions not met, clear sketch state
      if (import.meta.env.DEV) console.log("⏭ [SketchProvider] Conditions not met, clearing sketch state.");
      stateActions.setSketches([]);
      stateActions.setCurrentSketch(null);
      stateActions.clearPaths();
    }

    // Cleanup function
    return () => {
      if (import.meta.env.DEV) console.log("🧹 [SketchProvider] Cleaning up sketch state on effect change/unmount.");
      // Clear state when effect dependencies change (e.g., channel switch, logout)
      stateActions.setSketches([]);
      stateActions.setCurrentSketch(null);
      stateActions.clearPaths();
    };
  }, [systemState.currentChannel, authState.token, webSocketState.channelConnected, actions, stateActions]); // Use channelConnected

  // Memoize the handlers object based on the callback functions
  const handlerConfig = useMemo<ChannelMessageHandler>(
    () => ({
      onSketchMessage: handleIncomingSketchMessage,
    }),
    [handleIncomingSketchMessage]
  );

  // Effect to register WebSocket handlers for sketch lifecycle events
  useEffect(() => {
    const currentChannelName = systemContext.state.currentChannel?.name;
    if (currentChannelName && webSocketContext.actions.addChannelHandlers) {
      if (import.meta.env.DEV)
        console.log(`[SketchProvider] Added WS sketch handler with key: ${SKETCH_PROVIDER_HANDLER_KEY}`);
      webSocketContext.actions.addChannelHandlers(SKETCH_PROVIDER_HANDLER_KEY, handlerConfig);
    }

    return () => {
      if (webSocketContext.actions.removeChannelHandlers) {
        if (import.meta.env.DEV)
          console.log(`[SketchProvider] Removed WS sketch handler with key: ${SKETCH_PROVIDER_HANDLER_KEY}`);
        webSocketContext.actions.removeChannelHandlers(SKETCH_PROVIDER_HANDLER_KEY);
      }
    };
  }, [webSocketContext.actions, systemContext.state.currentChannel?.name, handlerConfig]);

  return <SketchContext.Provider value={value}>{children}</SketchContext.Provider>;
};
