import { useState, useMemo, useEffect, useRef } from "react";
import { initialState, SketchContext } from "../contexts/sketchContext";
import { Sketch, DrawPath } from "../types/interfaces";
import { SketchService } from "../services/SketchService";
import { useNotification } from "../hooks/useNotification";
import { useAuthContext } from "../hooks/useAuthContext";
import { useSystemContext } from "../hooks/useSystemContext";
const DEBUG = true;

export const SketchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authContext = useAuthContext();
  const systemContext = useSystemContext();
  const { showError, showSuccess } = useNotification();

  const [state, setState] = useState(initialState);
  const { state: systemState } = systemContext;
  const { state: authState } = authContext;

  // Keep track of the last loaded channel to prevent unnecessary reloads
  const lastLoadedChannelRef = useRef<string | null>(null);

  // Initialize sketch service - stable reference
  const sketchService = useMemo(() => SketchService.getInstance(), []);
  const sketchServiceRef = useRef(sketchService);
  // Stable state actions
  const stateActions = useMemo(
    () => ({
      setCurrentSketch: (sketch: Sketch | null) => {
        if (DEBUG) console.log(`📝 [SketchProvider] Setting current sketch: ${sketch?.id || "null"}`);
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
      setError: (error: string | null) => {
        setState((prev) => ({ ...prev, error }));
        if (error) showError(error);
      },
      setSketches: (sketches: Sketch[]) => {
        setState((prev) => ({
          ...prev,
          sketches,
          error: null,
        }));
      },
    }),
    [showError]
  );

  // Move loadSketches to its own useCallback
  // const loadSketches = useCallback(
  //   async (channelName: string) => {
  //     if (!authContext?.state.token) throw new Error("Not authenticated");

  //     // Skip if we've already loaded this channel's sketches
  //     if (lastLoadedChannelRef.current === channelName && state.sketches.length > 0) {
  //       if (DEBUG) console.log(`📝 [SketchProvider] Sketches already loaded for channel: ${channelName}`);
  //       return state.sketches;
  //     }

  //     stateActions.setLoading(true);
  //     try {
  //       const sketches = await sketchService.getSketches(channelName, authContext.state.token);
  //       stateActions.setSketches(sketches);
  //       lastLoadedChannelRef.current = channelName;
  //       return sketches;
  //     } catch (error) {
  //       const message = error instanceof Error ? error.message : "Failed to load sketches";
  //       stateActions.setError(message);
  //       throw error;
  //     } finally {
  //       stateActions.setLoading(false);
  //     }
  //   },
  //   [authContext?.state.token, sketchService, state.sketches, stateActions]
  // );

  // Stable service actions with proper error handling

  const memoizedServiceActions = useMemo(() => {
    const sketchService = sketchServiceRef.current;

    return {
      createSketch: async (channelName: string, displayName: string, width: number, height: number) => {
        if (!authContext?.state.token) throw new Error("Not authenticated");

        stateActions.setLoading(true);
        try {
          const sketch = await sketchService.createSketch(
            channelName,
            displayName,
            width,
            height,
            authContext.state.token
          );
          if (!sketch) throw new Error("Failed to create sketch");

          const sketches = await sketchService.getSketches(channelName, authContext.state.token);
          stateActions.setSketches(sketches);
          stateActions.setCurrentSketch(sketch);
          showSuccess("Sketch created successfully");
          return sketch;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to create sketch";
          stateActions.setError(
            message.includes("maximum limit") ? "Maximum sketches per channel limit reached" : message
          );
          throw error;
        } finally {
          stateActions.setLoading(false);
        }
      },

      loadSketch: async (channelName: string, sketchId: string) => {
        if (!authContext?.state.token) throw new Error("Not authenticated");

        stateActions.setLoading(true);
        try {
          const sketch = await sketchService.getSketch(channelName, sketchId, authContext.state.token);
          if (!sketch) throw new Error("Sketch not found");
          stateActions.setCurrentSketch(sketch);
          return sketch;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to load sketch";
          stateActions.setError(message);
          throw error;
        } finally {
          stateActions.setLoading(false);
        }
      },

      loadSketches: async (channelName: string) => {
        if (!authContext?.state.token) throw new Error("Not authenticated");

        // Skip if we've already loaded this channel's sketches
        // if (lastLoadedChannelRef.current === channelName && state.sketches.length > 0) {
        //   if (DEBUG) console.log(`📝 [SketchProvider] Sketches already loaded for channel: ${channelName}`);
        //   return state.sketches;
        // }

        stateActions.setLoading(true);
        try {
          const sketches = await sketchService.getSketches(channelName, authContext.state.token);
          stateActions.setSketches(sketches);
          lastLoadedChannelRef.current = channelName;
          return sketches;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to load sketches";
          stateActions.setError(message);
          throw error;
        } finally {
          stateActions.setLoading(false);
        }
      },

      deleteSketch: async (sketchId: string) => {
        if (!authContext?.state.token) throw new Error("Not authenticated");

        stateActions.setLoading(true);
        try {
          await sketchService.deleteSketch(sketchId, authContext.state.token);
          // Update sketches list after deletion
          // if (chatContext?.state.currentChannel) {
          //   const sketches = await sketchService.getSketches(chatContext.state.currentChannel, authContext.state.token);
          //   stateActions.setSketches(sketches);
          // }
          showSuccess("Sketch deleted successfully");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to delete sketch";
          stateActions.setError(message);
          throw error;
        } finally {
          stateActions.setLoading(false);
        }
      },
    };
  }, [authContext?.state.token, stateActions, showSuccess]);

  // Combined actions with stable reference
  const actions = useMemo(
    () => ({
      ...stateActions,
      ...memoizedServiceActions,
    }),
    [stateActions, memoizedServiceActions]
  );

  // Load sketches when channel is ready
  useEffect(() => {
    const channel = systemState.currentChannel;
    // const connected = systemState.channelConnected;
    const token = authState.token;

    if (!channel || !token) {
      if (DEBUG) console.log("⏭ [SketchProvider] Channel not ready");
      return;
    }

    // Load sketches for the new channel
    actions.loadSketches(channel.name).catch((err) => {
      if (DEBUG) console.error("[SketchProvider] Error loading sketches:", err);
    });
  }, [systemState.currentChannel, authState.token, actions]);

  // Clear last loaded channel when disconnecting
  // useEffect(() => {
  //   if (!systemState.channelConnected) {
  //     lastLoadedChannelRef.current = null;
  //   }
  // }, [systemState.channelConnected]);

  // Stable context value
  const value = useMemo(() => ({ state, actions }), [state, actions]);

  return <SketchContext.Provider value={value}>{children}</SketchContext.Provider>;
};
