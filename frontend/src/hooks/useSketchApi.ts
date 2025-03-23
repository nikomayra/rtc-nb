import { useState, useCallback, useEffect } from "react";
import { useApi } from "./useApi";
import { sketchApi } from "../api/sketchApi";
import { useAuthContext } from "./useAuthContext";
import { Sketch } from "../types/interfaces";
import { useContext } from "react";
import { NotificationContext } from "../contexts/notificationContext";

export function useSketchApi(channelName: string | null) {
  const {
    state: { token },
  } = useAuthContext();
  const [currentSketch, setCurrentSketch] = useState<Sketch | null>(null);
  const [sketches, setSketches] = useState<Sketch[]>([]);

  // Track channels we've already attempted to fetch sketches for
  const [attemptedChannels] = useState<Set<string>>(new Set());

  const notificationContext = useContext(NotificationContext);

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

  const createSketchApi = useApi<void, [string, string, number, number, string]>(
    async (channelName: string, displayName: string, width: number, height: number, token: string) => {
      await sketchApi.createSketch(channelName, displayName, width, height, token);
    },
    "Failed to create sketch"
  );

  const deleteSketchApi = useApi<void, [string, string, string]>(
    async (channelName: string, sketchId: string, token: string) => {
      await sketchApi.deleteSketch(channelName, sketchId, token);
    },
    "Failed to delete sketch"
  );

  const clearSketchApi = useApi<void, [string, string]>(async (channelName: string, token: string) => {
    await sketchApi.clearSketch(channelName, token);
  }, "Failed to clear sketch");

  // Load sketches when channel changes
  useEffect(() => {
    if (!token || !channelName) {
      // Clear sketches if no channel is selected
      setCurrentSketch(null);
      setSketches([]);
      return;
    }

    // Don't try to fetch again for channels we've already attempted
    if (attemptedChannels.has(channelName)) {
      return;
    }

    const loadSketches = async () => {
      try {
        const sketchesData = await getSketchesApi.execute(channelName, token);
        if (sketchesData) {
          setSketches(sketchesData);
        } else {
          setSketches([]);
          setCurrentSketch(null);
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

      try {
        const sketch = await getSketchApi.execute(channelName, sketchId, token);
        if (sketch) {
          setCurrentSketch(sketch);
          notifyInfo(`Sketch "${sketch.displayName}" loaded successfully`);
          return sketch;
        }
        return null;
      } catch {
        return null;
      }
    },
    [token, channelName, getSketchApi, notifyInfo, notifyError]
  );

  const createSketch = useCallback(
    async (displayName: string, width: number, height: number): Promise<boolean> => {
      if (!token || !channelName) {
        notifyError("Cannot create sketch: no channel selected");
        return false;
      }

      try {
        await createSketchApi.execute(channelName, displayName, width, height, token);
        notifyInfo(`Sketch "${displayName}" created successfully`);
        // Refresh sketches
        const sketches = await getSketchesApi.execute(channelName, token);
        if (sketches) {
          setSketches(sketches);
        }
        return true;
      } catch {
        return false;
      }
    },
    [token, channelName, createSketchApi, getSketchesApi, notifyInfo, notifyError]
  );

  const deleteSketch = useCallback(
    async (sketchId: string): Promise<boolean> => {
      if (!token || !channelName) {
        notifyError("Cannot delete sketch: no channel selected");
        return false;
      }

      try {
        await deleteSketchApi.execute(channelName, sketchId, token);
        // Update local state
        setSketches((prev) => prev.filter((s) => s.id !== sketchId));
        if (currentSketch?.id === sketchId) {
          setCurrentSketch(null);
        }
        notifyInfo("Sketch deleted successfully");
        return true;
      } catch {
        return false;
      }
    },
    [token, channelName, deleteSketchApi, currentSketch, notifyInfo, notifyError]
  );

  const clearSketch = useCallback(async (): Promise<boolean> => {
    if (!token || !channelName) {
      notifyError("Cannot clear sketch: no channel selected");
      return false;
    }

    try {
      await clearSketchApi.execute(channelName, token);
      // Update local state
      setCurrentSketch(null);
      setSketches([]);
      notifyInfo("Sketch cleared successfully");
      return true;
    } catch {
      return false;
    }
  }, [token, channelName, clearSketchApi, notifyInfo, notifyError]);

  return {
    // State
    currentSketch,
    sketches,
    isLoading:
      getSketchApi.isLoading ||
      getSketchesApi.isLoading ||
      createSketchApi.isLoading ||
      deleteSketchApi.isLoading ||
      clearSketchApi.isLoading,
    errors: {
      getSketch: getSketchApi.error,
      getSketches: getSketchesApi.error,
      createSketch: createSketchApi.error,
      deleteSketch: deleteSketchApi.error,
      clearSketch: clearSketchApi.error,
    },

    // Actions
    setCurrentSketch,
    loadSketch,
    createSketch,
    deleteSketch,
    clearSketch,
    addSketch: useCallback((sketch: Sketch) => {
      setSketches((prev) => {
        // Check if sketch already exists
        if (prev.some((s) => s.id === sketch.id)) {
          return prev;
        }
        return [...prev, sketch];
      });
    }, []),
  };
}
