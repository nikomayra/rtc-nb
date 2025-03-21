import { useState, useMemo, useEffect, useContext, useRef, useCallback } from "react";
import { initialState, SketchContext, SketchContextState } from "../../contexts/sketchContext";
import { AuthContext } from "../../contexts/authContext";
import { ChatContext } from "../../contexts/chatContext";
import { axiosInstance, isAxiosError } from "../../api/axiosInstance";
import { BASE_URL } from "../../utils/constants";
import { z } from "zod";
import { Sketch, SketchSchema, Region } from "../../types/interfaces";
import { NotificationContext } from "../../contexts/notificationContext";

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
        const response = await axiosInstance.get(
          `${BASE_URL}/channels/${encodeURIComponent(chatContext.state.currentChannel!)}/sketches`,
          {
            headers: {
              Authorization: `Bearer ${authContext.state.token}`,
            },
          }
        );

        if (response.data.success) {
          console.log("Raw sketches data:", JSON.stringify(response.data.data));

          // Attempt to fix regions if they're null
          const fixedSketches = response.data.data.map((sketch: unknown) => {
            const typedSketch = sketch as Partial<Sketch> & { regions: Record<string, Region> | null };
            if (typedSketch.regions === null) {
              console.log(`Fixing null regions for sketch ${typedSketch.id}`);
              return { ...typedSketch, regions: {} };
            }
            return sketch;
          });

          try {
            const validatedSketches = z.array(SketchSchema).parse(fixedSketches);
            setState((prev) => ({
              ...prev,
              sketches: validatedSketches,
              isLoading: false,
            }));
            console.log("📋 Sketches Loaded:", { count: validatedSketches.length });
          } catch (zodError) {
            console.error("Zod validation error:", zodError);
            throw zodError;
          }
        } else {
          const errorMsg = `Failed to get sketches: ${response.data.error}`;
          setState((prev) => ({
            ...prev,
            error: response.data.error,
            isLoading: false,
          }));
          console.error(errorMsg);
          notifyError(errorMsg);
        }
      } catch (error) {
        let errorMessage = "Failed to load sketches";
        if (error instanceof z.ZodError) {
          console.error("Invalid sketch data:", error.errors);
          errorMessage = "Invalid sketch data received";
        }
        if (isAxiosError(error)) {
          if (error.response?.status === 401) {
            errorMessage = "Not authorized to view sketches in this channel";
          } else if (
            error.response?.status === 500 &&
            error.response?.data?.error?.message === "Failed to get user channel"
          ) {
            // This error occurs when user hasn't joined a channel yet
            console.log("User hasn't joined a channel yet, skipping sketch loading");
            setState((prev) => ({
              ...prev,
              sketches: [],
              isLoading: false,
              error: null,
            }));

            // Remember that we've tried this channel and got a 500 error to avoid retrying
            attemptedChannelsRef.current.add(channelKey);
            return; // Exit early without setting error
          } else if (error.response?.status === 500) {
            // Handle other 500 errors to prevent continuous retry loops
            console.log(`Server error (500) when fetching sketches for ${channelKey}, will not retry`);
            errorMessage = "Server error while loading sketches";

            // Remember that we've tried this channel and got a 500 error to avoid retrying
            attemptedChannelsRef.current.add(channelKey);
          } else {
            errorMessage = error.response?.data?.message || error.response?.data?.error?.message || errorMessage;
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
