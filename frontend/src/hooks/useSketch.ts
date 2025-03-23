import { useState, useCallback, useEffect, useRef } from "react";
import { Sketch, DrawPath, Point, Region } from "../types/interfaces";
import { useSketchState } from "./useSketchState";
import useCanvasDrawing from "./useCanvasDrawing";
import { useSketchSync } from "./useSketchSync";
import { useApi } from "./useApi";
import { sketchApi } from "../api/sketchApi";
import { useAuthContext } from "./useAuthContext";
import { useContext } from "react";
import { NotificationContext } from "../contexts/notificationContext";

interface UseSketchProps {
  channelName: string;
  currentSketch: Sketch | null;
}

export const useSketch = ({ channelName, currentSketch }: UseSketchProps) => {
  const {
    state: { token },
  } = useAuthContext();
  const [sketches, setSketches] = useState<Sketch[]>([]);

  const notificationContext = useContext(NotificationContext);

  // Track channels we've already attempted to fetch sketches for
  const [attemptedChannels] = useState<Set<string>>(new Set());

  // Notification helpers
  const notifyError = useCallback(
    (message: string) => {
      notificationContext?.actions.addNotification({
        type: "error",
        message,
        duration: 5000,
      });
    },
    [notificationContext]
  );

  const notifyInfo = useCallback(
    (message: string) => {
      notificationContext?.actions.addNotification({
        type: "info",
        message,
        duration: 5000,
      });
    },
    [notificationContext]
  );

  const createSketchApi = useApi<void, [string, string, number, number, string]>(
    async (channelName: string, displayName: string, width: number, height: number, token: string) => {
      await sketchApi.createSketch(channelName, displayName, width, height, token);
    },
    "Failed to create sketch"
  );

  // API hooks
  const getSketchApi = useApi<Sketch | null, [string, string, string]>(
    async (channelName: string, sketchId: string, token: string) => {
      return sketchApi.getSketch(channelName, sketchId, token);
    },
    "Failed to load sketch"
  );

  const getSketchesApi = useApi<Sketch[], [string, string]>(async (channelName: string, token: string) => {
    return sketchApi.getSketches(channelName, token);
  }, "Failed to get sketches");

  const deleteSketchApi = useApi<void, [string, string, string]>(
    async (channelName: string, sketchId: string, token: string) => {
      await sketchApi.deleteSketch(channelName, sketchId, token);
    },
    "Failed to delete sketch"
  );

  const clearSketchApi = useApi<void, [string, string]>(async (channelName: string, token: string) => {
    await sketchApi.clearSketch(channelName, token);
  }, "Failed to clear sketch");

  // Get dimensions from sketch or use defaults
  const width = currentSketch?.width ?? 800;
  const height = currentSketch?.height ?? 600;

  // Setup the three layers
  const sketchState = useSketchState();
  const canvasDrawing = useCanvasDrawing(width, height);

  // Current path tracking for drawing operations
  const currentPathRef = useRef<DrawPath | null>(null);

  // Track previous sketch ID to avoid unnecessary resets
  const prevSketchIdRef = useRef<string | null>(null);

  // Update sketch state when sketch changes
  useEffect(() => {
    const currentSketchId = currentSketch?.id || null;

    // Only proceed if the sketch ID has changed
    if (prevSketchIdRef.current === currentSketchId) {
      return;
    }

    console.log(`📝 [useSketch] Setting sketch: ${currentSketchId || "null"}`);
    prevSketchIdRef.current = currentSketchId;

    sketchState.setSketch(currentSketch);

    // Clear canvas
    canvasDrawing.clear();

    // If we have a sketch with existing paths, draw them
    if (sketchState.state.existingPaths.length > 0) {
      console.log(`📊 [useSketch] Drawing ${sketchState.state.existingPaths.length} existing paths`);

      // Redraw everything with a small delay to ensure canvas is ready
      setTimeout(() => {
        console.log(`🔄 [useSketch] Delayed initial redraw with ${sketchState.state.existingPaths.length} paths`);
        canvasDrawing.redrawCanvas([...sketchState.state.existingPaths, ...sketchState.state.paths]);
      }, 50);
    }
    // Limit dependencies to only what is needed for the sketch ID check
  }, [sketchState, canvasDrawing, currentSketch]);

  // Handle updates received from server
  const handleUpdateFromServer = useCallback(
    (update: Region) => {
      if (!update.paths || update.paths.length === 0) {
        console.log(`ℹ️ [useSketch] Update from server with no paths, skipping`);
        return;
      }

      console.log(`📥 [useSketch] Update from server with ${update.paths.length} paths`);

      // Process each path in the region
      update.paths.forEach((path) => {
        console.log(`📊 [useSketch] Processing path with ${path.points.length} points, isDrawing=${path.isDrawing}`);

        // Add remote paths to existingPaths
        sketchState.addRemotePath(path);

        // Draw on canvas immediately for responsive feedback
        canvasDrawing.drawFullPath(path);
      });

      // Ensure full redraw to maintain visual consistency with a small delay
      setTimeout(() => {
        console.log(`🔄 [useSketch] Delayed redraw after server update`);
        canvasDrawing.redrawCanvas([...sketchState.state.existingPaths, ...sketchState.state.paths]);
      }, 10);
    },
    [sketchState, canvasDrawing]
  );

  // Handle clear command from server
  const handleClearFromServer = useCallback(() => {
    console.log(`🧹 [useSketch] Clear command from server`);
    // Clear state
    sketchState.clearPaths();

    // Clear canvas
    canvasDrawing.clear();
  }, [sketchState, canvasDrawing]);

  // Setup the sync layer
  const sketchSync = useSketchSync({
    channelName,
    sketchId: currentSketch?.id,
    onUpdateFromServer: handleUpdateFromServer,
    onClearFromServer: handleClearFromServer,
  });

  // Start a new path
  const startPath = useCallback(
    (point: Point, isDrawing: boolean, strokeWidth: number) => {
      if (!point) return;

      console.log(`👇 [useSketch] Starting new path at (${point.x},${point.y}), isDrawing=${isDrawing}`);
      currentPathRef.current = {
        points: [point],
        isDrawing,
        strokeWidth,
      };

      sketchState.markAsDrawing(true);
    },
    [sketchState]
  );

  // Continue a path
  const continuePath = useCallback(
    (point: Point) => {
      if (!currentPathRef.current || !point) return;

      const prevPoint = currentPathRef.current.points[currentPathRef.current.points.length - 1];

      // Add point to current path
      currentPathRef.current.points.push(point);

      // Draw the line segment
      canvasDrawing.drawPath(prevPoint, point, currentPathRef.current.isDrawing, currentPathRef.current.strokeWidth);
    },
    [canvasDrawing]
  );

  // Complete a path
  const completePath = useCallback(() => {
    if (!currentPathRef.current || currentPathRef.current.points.length < 2) {
      console.log(`👆 [useSketch] Ignoring empty or single-point path`);
      sketchState.markAsDrawing(false);
      currentPathRef.current = null;
      return;
    }

    const completedPath = { ...currentPathRef.current };
    console.log(`👆 [useSketch] Completing path with ${completedPath.points.length} points`);

    // Add to state
    sketchState.addPath(completedPath);

    // Send to server
    sketchSync.sendUpdate(completedPath);

    // Ensure the path stays visible by explicitly redrawing after a short delay
    // This helps prevent race conditions where the canvas is cleared immediately after drawing
    setTimeout(() => {
      console.log(`🔄 [useSketch] Delayed redraw of canvas with ${sketchState.state.paths.length} paths`);
      // Draw both existing and new paths
      canvasDrawing.redrawCanvas([...sketchState.state.existingPaths, ...sketchState.state.paths]);
    }, 10);

    // Reset current path
    sketchState.markAsDrawing(false);
    currentPathRef.current = null;
  }, [sketchState, sketchSync, canvasDrawing]);

  // Clear the canvas
  const clear = useCallback(() => {
    console.log(`🧹 [useSketch] Clearing canvas`);

    // Clear state and canvas
    sketchState.clearPaths();

    // Clear visual canvas with a small delay to ensure complete clearing
    setTimeout(() => {
      canvasDrawing.clear();
      console.log(`🧹 [useSketch] Delayed canvas clear complete`);
    }, 10);

    // Send clear command to server
    sketchSync.sendClear();
  }, [sketchState, canvasDrawing, sketchSync]);

  // Load sketches when channel changes
  useEffect(() => {
    if (!token || !channelName) {
      // Clear sketches if no channel is selected
      setSketches([]);
      return;
    }

    // Don't try to fetch again for channels we've already attempted
    if (attemptedChannels.has(channelName)) {
      return;
    }

    const loadSketches = async () => {
      // Add a short delay to ensure websocket connection is established
      await new Promise((resolve) => setTimeout(resolve, 500));

      try {
        const sketches = await getSketchesApi.execute(channelName, token);
        if (sketches) {
          setSketches(sketches);
        } else {
          setSketches([]);
        }
      } catch (error) {
        // If we get an error, mark this channel as attempted to avoid retrying
        attemptedChannels.add(channelName);

        if (error instanceof Error) {
          if (error.message.includes("Failed to get user channel")) {
            // User hasn't joined the channel yet
            console.log("User hasn't joined the channel yet, skipping sketch loading");
          } else if (error.message.includes("Server error")) {
            console.log(`Server error when fetching sketches for ${channelName}, will not retry`);
          }
        }
      }
    };

    loadSketches();
  }, [token, channelName, attemptedChannels, getSketchesApi]);

  const loadSketch = useCallback(
    async (sketchId: string): Promise<Sketch | null> => {
      if (!token || !channelName) {
        notifyError("Cannot load sketch: no channel selected");
        return null;
      }

      const sketch = await getSketchApi.execute(channelName, sketchId, token);
      if (sketch) {
        return sketch;
      }
      return null;
    },
    [token, channelName, getSketchApi, notifyError]
  );

  const createSketch = useCallback(
    async (displayName: string, width: number, height: number): Promise<boolean> => {
      if (!token || !channelName) {
        notifyError("Cannot save sketch: no channel selected");
        return false;
      }

      const result = await createSketchApi.execute(channelName, displayName, width, height, token);
      if (result !== null) {
        notifyInfo("Sketch saved successfully");
        return true;
      }
      return false;
    },
    [token, channelName, createSketchApi, notifyInfo, notifyError]
  );

  const deleteSketch = useCallback(
    async (sketchId: string): Promise<boolean> => {
      if (!token || !channelName) {
        notifyError("Cannot delete sketch: no channel selected");
        return false;
      }

      const result = await deleteSketchApi.execute(channelName, sketchId, token);
      if (result !== null) {
        notifyInfo("Sketch deleted successfully");
        return true;
      }
      return false;
    },
    [token, channelName, deleteSketchApi, notifyInfo, notifyError]
  );

  const clearSketch = useCallback(async (): Promise<boolean> => {
    if (!token || !channelName) {
      notifyError("Cannot clear sketch: no channel selected");
      return false;
    }

    const result = await clearSketchApi.execute(channelName, token);
    if (result !== null) {
      // Update local state
      setSketches([]);
      notifyInfo("Sketch cleared successfully");
      return true;
    }
    return false;
  }, [token, channelName, clearSketchApi, notifyInfo, notifyError]);

  return {
    // Canvas ref for drawing
    canvasRef: canvasDrawing.canvasRef,

    // Drawing operations
    startPath,
    continuePath,
    completePath,

    // Editor actions
    clear,

    // Utilities
    calculateBounds: canvasDrawing.calculateBounds,
    isValidPoint: canvasDrawing.isValidPoint,
    getCanvasPoint: canvasDrawing.getCanvasPoint,

    // Status
    isPending: sketchState.state.isPending,
    isDrawing: sketchState.state.isDrawing,

    // Canvas dimensions
    width: canvasDrawing.width,
    height: canvasDrawing.height,

    // State
    currentSketch,
    sketches,
    isLoading:
      getSketchesApi.isLoading ||
      getSketchApi.isLoading ||
      createSketchApi.isLoading ||
      deleteSketchApi.isLoading ||
      clearSketchApi.isLoading,
    errors: {
      getSketches: getSketchesApi.error,
      getSketch: getSketchApi.error,
      createSketch: createSketchApi.error,
      deleteSketch: deleteSketchApi.error,
      clearSketch: clearSketchApi.error,
    },

    // Actions
    setCurrentSketch,
    addSketch: useCallback((sketch: Sketch) => {
      setSketches((prev) => {
        // Check if sketch already exists
        if (prev.some((s) => s.id === sketch.id)) {
          return prev;
        }
        return [...prev, sketch];
      });
    }, []),
    createSketch,
    deleteSketch,
    clearSketch,
    setLoading:
      getSketchesApi.isLoading ||
      getSketchApi.isLoading ||
      createSketchApi.isLoading ||
      deleteSketchApi.isLoading ||
      clearSketchApi.isLoading,
  };
};
