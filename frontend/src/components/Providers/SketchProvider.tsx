import { useState, useMemo, useEffect, useContext, useRef, useCallback } from "react";
import { initialState, SketchContext, SketchContextState } from "../../contexts/sketchContext";
import { AuthContext } from "../../contexts/authContext";
import { ChatContext } from "../../contexts/chatContext";
import { z } from "zod";
import { Sketch, SketchSchema } from "../../types/interfaces";
import { NotificationContext } from "../../contexts/notificationContext";
import { sketchApi } from "../../api/sketchApi";

export const SketchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authContext = useContext(AuthContext);
  const chatContext = useContext(ChatContext);
  const notificationContext = useContext(NotificationContext);

  // Track if we've already tried to fetch sketches for channels in this session
  const attemptedChannelsRef = useRef(new Set<string>());

  const [state, setState] = useState<SketchContextState>(initialState);
  const stateRef = useRef(state);
  const previousChannelRef = useRef<string | null>(null);

  if (!authContext || !chatContext) throw new Error("Context not found");

  // Create stable notification function
  const notifyError = useCallback(
    (message: string) => {
      if (!notificationContext) {
        console.error(message);
        return;
      }
      notificationContext.actions.addNotification({
        type: "error",
        message,
        duration: 5000,
      });
    },
    [notificationContext]
  );

  // Keep ref in sync with state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Reset sketch state when changing channels
  useEffect(() => {
    const currentChannel = chatContext?.state.currentChannel;

    // If channel has changed, reset current sketch
    if (currentChannel !== previousChannelRef.current) {
      console.log(`Channel changed from ${previousChannelRef.current} to ${currentChannel}, resetting current sketch`);
      setState((prev) => ({
        ...prev,
        currentSketch: null,
        sketches: [],
        error: null,
      }));
      previousChannelRef.current = currentChannel;
    }
  }, [chatContext?.state.currentChannel]);

  // Fetch sketches when channel changes
  useEffect(() => {
    // Only attempt to fetch sketches if both token and channel are available
    if (!authContext?.state.token || !chatContext?.state.currentChannel) {
      console.log("Skipping GET Sketches - missing token or channel");
      return;
    }

    // If we've already attempted to fetch sketches for this channel and got a 500 error, don't try again
    const channelKey = chatContext.state.currentChannel;
    if (attemptedChannelsRef.current.has(channelKey)) {
      console.log(`Already attempted to fetch sketches for ${channelKey} and failed, skipping`);
      return;
    }

    const getSketches = async () => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Add a short delay to ensure websocket connection is established
      await new Promise((resolve) => setTimeout(resolve, 500));

      try {
        console.log(`Fetching sketches for channel: ${chatContext.state.currentChannel}`);

        const sketchData = await sketchApi.getSketches(chatContext.state.currentChannel!, authContext.state.token);

        if (sketchData && sketchData.length > 0) {
          // Get the first sketch (or could implement UI to choose)
          const firstSketch = sketchData[0];

          // Attempt to fix regions if they're null
          const fixedSketch = firstSketch.regions === null ? { ...firstSketch, regions: {} } : firstSketch;

          try {
            const validatedSketch = SketchSchema.parse(fixedSketch);
            setState((prev) => ({
              ...prev,
              sketches: sketchData,
              currentSketch: validatedSketch,
              isLoading: false,
            }));
            console.log("📋 Sketch Loaded:", { id: validatedSketch.id });
          } catch (zodError) {
            console.error("Zod validation error:", zodError);
            throw zodError;
          }
        } else {
          console.log("No sketches found for channel");
          setState((prev) => ({
            ...prev,
            sketches: [],
            isLoading: false,
          }));
        }
      } catch (error) {
        let errorMessage = "Failed to load sketches";
        if (error instanceof z.ZodError) {
          console.error("Invalid sketch data:", error.errors);
          errorMessage = "Invalid sketch data received";
        } else if (error instanceof Error) {
          if (error.message.includes("Failed to get user channel")) {
            // This error occurs when user hasn't joined a channel yet
            console.log("User hasn't joined a channel yet, skipping sketch loading");
            setState((prev) => ({
              ...prev,
              sketches: [],
              isLoading: false,
              error: null,
            }));

            // Remember that we've tried this channel and got an error to avoid retrying
            attemptedChannelsRef.current.add(channelKey);
            return; // Exit early without setting error
          } else if (error.message.includes("Server error")) {
            // Handle server errors to prevent continuous retry loops
            console.log(`Server error when fetching sketches for ${channelKey}, will not retry`);
            errorMessage = "Server error while loading sketches";

            // Remember that we've tried this channel and got an error to avoid retrying
            attemptedChannelsRef.current.add(channelKey);
          } else {
            errorMessage = error.message;
          }
        }

        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isLoading: false,
        }));
        notifyError(errorMessage);
      }
    };
    getSketches();
  }, [chatContext.state.currentChannel, authContext.state.token, notifyError]);

  const actions = useMemo(
    () => ({
      setCurrentSketch: (sketch: Sketch | null) => {
        console.log("📝 Setting Current Sketch:", {
          previousId: stateRef.current.currentSketch?.id,
          newId: sketch?.id,
          regions: sketch ? Object.keys(sketch.regions).length : 0,
        });
        setState((prev) => ({ ...prev, currentSketch: sketch }));
      },
      setSketches: (sketches: Sketch[]) => {
        console.log("📋 Setting Sketches:", { count: sketches.length });
        setState((prev) => ({ ...prev, sketches }));
      },
      addSketch: (sketch: Sketch) => {
        console.log("➕ Adding New Sketch:", { id: sketch.id });
        setState((prev) => {
          // Check if sketch already exists
          if (prev.sketches.some((s) => s.id === sketch.id)) {
            return prev;
          }
          return { ...prev, sketches: [...prev.sketches, sketch] };
        });
      },
      removeSketch: (id: string) => {
        console.log("🗑️ Removing Sketch:", {
          id,
          isCurrentSketch: stateRef.current.currentSketch?.id === id,
        });
        setState((prev) => ({ ...prev, sketches: prev.sketches.filter((s) => s.id !== id) }));
      },
      setLoading: (value: boolean) => {
        console.log("♻️ Loading Sketch:", { value: value });
        setState((prev) => ({ ...prev, isLoading: value }));
      },
      setError: (error: string | null) => {
        if (error) {
          console.log("💥 Sketch Error:", { error });
          notifyError(error);
        }
        setState((prev) => ({ ...prev, error }));
      },
    }),
    [notifyError]
  );

  const value = useMemo(() => ({ state, actions }), [state, actions]);

  return <SketchContext.Provider value={value}>{children}</SketchContext.Provider>;
};
