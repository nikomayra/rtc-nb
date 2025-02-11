import { useState, useMemo, useEffect, useContext, useRef } from "react";
import { initialState, SketchContext, SketchContextState } from "../../contexts/sketchContext";
import { AuthContext } from "../../contexts/authContext";
import { ChatContext } from "../../contexts/chatContext";
import { axiosInstance, isAxiosError } from "../../api/axiosInstance";
import { BASE_URL } from "../../utils/constants";
import { z } from "zod";
import { Sketch, SketchSchema } from "../../types/interfaces";

export const SketchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SketchContextState>(initialState);
  const stateRef = useRef(state);
  const authContext = useContext(AuthContext);
  const chatContext = useContext(ChatContext);

  if (!authContext || !chatContext) throw new Error("Context not found");

  // Keep ref in sync with state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Fetch sketches when channel changes
  useEffect(() => {
    if (!authContext?.state.token || !chatContext?.state.currentChannel) return;

    const getSketches = async () => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        const response = await axiosInstance.get(
          `${BASE_URL}/getSketches/${encodeURIComponent(chatContext.state.currentChannel!)}`,
          {
            headers: {
              Authorization: `Bearer ${authContext.state.token}`,
            },
          }
        );
        if (response.data.success) {
          const validatedSketches = z.array(SketchSchema).parse(response.data.data);
          setState((prev) => ({
            ...prev,
            sketches: validatedSketches,
            isLoading: false,
          }));
          console.log("📋 Sketches Loaded:", { count: validatedSketches.length });
        } else {
          setState((prev) => ({
            ...prev,
            error: response.data.error,
            isLoading: false,
          }));
          console.error("Failed to get sketches:", response.data.error);
        }
      } catch (error) {
        let errorMessage = "Failed to load sketches";
        if (error instanceof z.ZodError) {
          errorMessage = "Invalid sketch data received";
        }
        if (isAxiosError(error)) {
          errorMessage = error.response?.data?.message || errorMessage;
        }
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isLoading: false,
        }));
      }
    };
    getSketches();
  }, [chatContext?.state.currentChannel, authContext?.state.token]);

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
        }
        setState((prev) => ({ ...prev, error }));
      },
    }),
    []
  );

  const value = useMemo(() => ({ state, actions }), [state, actions]);

  return <SketchContext.Provider value={value}>{children}</SketchContext.Provider>;
};
