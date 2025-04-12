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
import { isAxiosError } from "axios";

export const SketchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showError } = useNotification();
  const authContext = useAuthContext();
  const systemContext = useSystemContext();
  const webSocketContext = useWebSocketContext();

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

  // Service actions with error handling refactored
  const serviceActions = useMemo(() => {
    return {
      // --- Load Sketches ---
      loadSketches: async (channelName: string): Promise<Sketch[]> => {
        if (!authState.token) throw new Error("Not authenticated for loading sketches");
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
          // Clean up state on any error
          stateActions.setSketches([]);
          console.error("Load sketches error:", error);

          // --- Retry Logic for 401 ---
          let shouldRetry = false;
          let finalError: unknown = error; // Use a separate variable for the final error

          if (isAxiosError(error) && error.response?.status === 401) {
            shouldRetry = true;
          }

          if (shouldRetry) {
            if (import.meta.env.DEV)
              console.warn(
                "[SketchProvider] Received 401 on loadSketches, likely due to connection timing. Retrying once..."
              );
            try {
              await new Promise((resolve) => setTimeout(resolve, 250)); // Wait 250ms
              const retryResponse = await sketchApi.getSketches(channelName, authState.token);
              if (!retryResponse.success) {
                // If retry also fails, throw the original error
                throw new Error(
                  (retryResponse as APIErrorResponse).error.message || "Failed to load sketches on retry"
                );
              }
              const retrySketches = z.array(SketchSchema).parse(retryResponse.data);
              console.log("[SketchProvider] Retry successful.");
              stateActions.setSketches(retrySketches);
              // Need to set loading false here as well if retry succeeds before returning
              stateActions.setLoading(false);
              return retrySketches; // Return the successfully retried sketches
            } catch (retryError) {
              console.error("[SketchProvider] Retry failed:", retryError);
              // If retry fails, fall through to throw the original error's message (or retry error if preferred)
              finalError = retryError; // Update finalError with the retry error
            }
          }
          // --- End Retry Logic ---

          // Re-throw a user-friendly error (using original or retry error)
          if (isAxiosError(finalError)) {
            throw new Error(finalError.response?.data?.error?.message || "Failed to load sketches.");
          } else if (finalError instanceof Error) {
            throw new Error(finalError.message);
          } else {
            throw new Error("Failed to load sketches due to an unexpected error.");
          }
        } finally {
          stateActions.setLoading(false);
        }
      },

      // --- Create Sketch ---
      createSketch: async (
        channelName: string,
        displayName: string,
        width: number,
        height: number
      ): Promise<Sketch> => {
        if (!authState.token) throw new Error("Not authenticated for creating sketch");
        stateActions.setLoading(true);
        try {
          const response = await sketchApi.createSketch(channelName, displayName, width, height, authState.token);
          if (!response.success) {
            throw new Error((response as APIErrorResponse).error.message || "Failed to create sketch");
          }
          const newSketch = SketchSchema.parse(response.data);
          setState((prev) => ({
            ...prev,
            sketches: [...prev.sketches, newSketch],
            currentSketch: newSketch,
            paths: [],
          }));
          return newSketch;
        } catch (error) {
          // Don't update state on error
          console.error("Create sketch error:", error);
          // Re-throw a user-friendly error
          if (isAxiosError(error)) {
            throw new Error(error.response?.data?.error?.message || "Failed to create sketch.");
          } else if (error instanceof Error) {
            throw new Error(error.message);
          } else {
            throw new Error("Failed to create sketch due to an unexpected error.");
          }
        } finally {
          stateActions.setLoading(false);
        }
      },

      // --- Load Sketch ---
      loadSketch: async (channelName: string, sketchId: string): Promise<Sketch | null> => {
        if (!authState.token) throw new Error("Not authenticated for loading sketch");
        stateActions.setLoading(true);
        try {
          const response = await sketchApi.getSketch(channelName, sketchId, authState.token);

          if (!response.success && (response as APIErrorResponse).error.code === 404) {
            setState((prev) => {
              const sketchExists = prev.sketches.some((s) => s.id === sketchId);
              if (!sketchExists) return prev;
              const newSketches = prev.sketches.filter((s) => s.id !== sketchId);
              const newCurrentSketch = prev.currentSketch?.id === sketchId ? null : prev.currentSketch;
              return { ...prev, sketches: newSketches, currentSketch: newCurrentSketch };
            });
            return null;
          }

          if (!response.success) {
            throw new Error((response as APIErrorResponse).error.message || "Failed to load sketch");
          }

          const sketch = SketchSchema.parse(response.data);
          stateActions.setCurrentSketch(sketch);
          return sketch;
        } catch (error) {
          // Clean up state on any error
          stateActions.setCurrentSketch(null);
          console.error("Load sketch error:", error);
          // Re-throw a user-friendly error
          if (isAxiosError(error)) {
            // Handle 404 specifically if needed based on axios error structure
            if (error.response?.status === 404) {
              // If the 404 comes from axios, handle it similar to the API 404 response
              setState((prev) => {
                const sketchExists = prev.sketches.some((s) => s.id === sketchId);
                if (!sketchExists) return prev; // No local sketch to remove
                const newSketches = prev.sketches.filter((s) => s.id !== sketchId);
                const newCurrentSketch = prev.currentSketch?.id === sketchId ? null : prev.currentSketch;
                console.warn(
                  `[SketchProvider] Sketch ${sketchId} not found on server (via network error), removing locally.`
                );
                return { ...prev, sketches: newSketches, currentSketch: newCurrentSketch };
              });
              return null; // Indicate sketch not found
            }
            throw new Error(error.response?.data?.error?.message || "Failed to load sketch.");
          } else if (error instanceof Error) {
            throw new Error(error.message);
          } else {
            throw new Error("Failed to load sketch due to an unexpected error.");
          }
        } finally {
          stateActions.setLoading(false);
        }
      },

      // --- Delete Sketch ---
      deleteSketch: async (sketchId: string): Promise<void> => {
        if (!authState.token) throw new Error("Not authenticated for deleting sketch");
        stateActions.setLoading(true);
        try {
          const response = await sketchApi.deleteSketch(sketchId, authState.token);
          if (!response.success) {
            throw new Error((response as APIErrorResponse).error.message || "Failed to delete sketch");
          }
          // Update local state AFTER successful API call
          setState((prev) => {
            const sketchExists = prev.sketches.some((s) => s.id === sketchId);
            if (!sketchExists) return prev;

            const newSketches = prev.sketches.filter((s) => s.id !== sketchId);
            const newCurrentSketch = prev.currentSketch?.id === sketchId ? null : prev.currentSketch;
            if (import.meta.env.DEV) console.log(`[SketchProvider] Local delete: Removing sketch ${sketchId}`);
            return { ...prev, sketches: newSketches, currentSketch: newCurrentSketch };
          });
        } catch (error) {
          // Don't update state on error
          console.error("Delete sketch error:", error);
          // Re-throw a user-friendly error
          if (isAxiosError(error)) {
            throw new Error(error.response?.data?.error?.message || "Failed to delete sketch.");
          } else if (error instanceof Error) {
            throw new Error(error.message);
          } else {
            throw new Error("Failed to delete sketch due to an unexpected error.");
          }
        } finally {
          stateActions.setLoading(false);
        }
      },

      // --- Clear Sketch ---
      clearSketch: async (channelName: string, sketchId: string): Promise<void> => {
        if (!authState.token) throw new Error("Not authenticated for clearing sketch");
        const currentChannel = systemContext.state.currentChannel?.name;
        if (!currentChannel || channelName !== currentChannel) {
          throw new Error("Client-side check: Cannot clear sketch for a different channel.");
        }

        stateActions.setLoading(true);
        try {
          const response = await sketchApi.clearSketch(channelName, sketchId, authState.token);
          if (!response.success) {
            throw new Error((response as APIErrorResponse).error.message || "Failed to clear sketch");
          }
        } catch (error) {
          // No local state change needed here on error either
          console.error("Clear sketch error:", error);
          // Re-throw a user-friendly error
          if (isAxiosError(error)) {
            throw new Error(error.response?.data?.error?.message || "Failed to clear sketch.");
          } else if (error instanceof Error) {
            throw new Error(error.message);
          } else {
            throw new Error("Failed to clear sketch due to an unexpected error.");
          }
        } finally {
          stateActions.setLoading(false);
        }
      },
    };
  }, [authState.token, stateActions, systemContext.state.currentChannel?.name]);

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
              // We might want to show an error here specifically for WS failures
              showError(
                `Error reloading sketches after WS update: ${err instanceof Error ? err.message : "Unknown error"}`
              );
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
              // Similarly, handle potential error from WS-triggered load
              showError(
                `Error reloading sketch after WS update: ${err instanceof Error ? err.message : "Unknown error"}`
              );
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
    // Add showError back as a dependency ONLY for the WS handler part
    [actions, systemContext.state.currentChannel?.name, authState.username, state.currentSketch?.id, showError]
  );

  // --- Effects ---
  useEffect(() => {
    const channel = systemState.currentChannel;
    const token = authState.token;
    const connected = webSocketState.channelConnected;

    if (channel && token && connected) {
      if (import.meta.env.DEV)
        console.log(`🔄 [SketchProvider] Channel/Auth ready (${channel.name}). Loading sketches.`);
      actions.loadSketches(channel.name).catch((err: unknown) => {
        // Error is thrown by loadSketches, but notification is NOT shown there.
        // Show the error here for the initial load failure.
        const message = err instanceof Error ? err.message : "Initial sketch load failed";
        console.error("[SketchProvider] Initial loadSketches failed in effect:", err);
        showError(message);
      });
    } else {
      if (import.meta.env.DEV) console.log("⏭ [SketchProvider] Conditions not met, clearing sketch state.");
      stateActions.setSketches([]);
      stateActions.setCurrentSketch(null);
      stateActions.clearPaths();
    }

    return () => {
      if (import.meta.env.DEV) console.log("🧹 [SketchProvider] Cleaning up sketch state on effect change/unmount.");
      stateActions.setSketches([]);
      stateActions.setCurrentSketch(null);
      stateActions.clearPaths();
    };
  }, [systemState.currentChannel, authState.token, webSocketState.channelConnected, actions, stateActions, showError]);

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
