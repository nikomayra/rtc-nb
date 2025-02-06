import { useState, useMemo, useEffect, useContext, useCallback, useRef } from "react";
import { SketchContext, SketchContextState } from "../../contexts/sketchContext";
import { AuthContext } from "../../contexts/authContext";
import { ChatContext } from "../../contexts/chatContext";
import { axiosInstance, isAxiosError } from "../../api/axiosInstance";
import { BASE_URL } from "../../utils/constants";
import { z } from "zod";
import { RegionlessSketch, RegionlessSketchSchema, Sketch } from "../../types/interfaces";

const initialState: SketchContextState = {
  drawing: true,
  strokeWidth: 2,
  currentSketch: null,
  sketches: [],
};

export const SketchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SketchContextState>(initialState);
  const stateRef = useRef(state);
  const authContext = useContext(AuthContext);
  const chatContext = useContext(ChatContext);

  // Keep ref in sync with state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Fetch sketches when channel changes
  useEffect(() => {
    if (!authContext?.state.token || !chatContext?.state.currentChannel) return;

    const getSketches = async () => {
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
          const validatedSketches = z.array(RegionlessSketchSchema).parse(response.data.data);
          setState((prev) => ({ ...prev, sketches: validatedSketches }));
          console.log("📋 Sketches Loaded:", { count: validatedSketches.length });
        } else {
          console.error("Failed to get sketches:", response.data.error);
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.error("Invalid sketch data:", error.errors);
        }
        if (isAxiosError(error)) {
          console.error("Failed to get sketches:", error.response?.data?.message);
        }
        throw error;
      }
    };
    getSketches();
  }, [chatContext?.state.currentChannel, authContext?.state.token]);

  // Create stable action functions using ref instead of state
  const setDrawing = useCallback((value: boolean) => {
    setState((prev) => {
      if (prev.drawing === value) return prev; // Skip update if value hasn't changed

      console.log("🎨 Setting Drawing Mode:", {
        previousValue: prev.drawing,
        newValue: value,
        currentSketchId: prev.currentSketch?.id,
      });

      return {
        ...prev,
        drawing: value,
      };
    });
  }, []);

  const setStrokeWidth = useCallback((value: number) => {
    console.log("✏️ Setting Stroke Width:", {
      previousWidth: stateRef.current.strokeWidth,
      newWidth: value,
    });
    setState((prev) => ({ ...prev, strokeWidth: value }));
  }, []);

  const setCurrentSketch = useCallback((sketch: Sketch | null) => {
    console.log("📝 Setting Current Sketch:", {
      previousId: stateRef.current.currentSketch?.id,
      newId: sketch?.id,
      regions: sketch ? Object.keys(sketch.regions).length : 0,
    });
    setState((prev) => ({ ...prev, currentSketch: sketch }));
  }, []);

  const setSketches = useCallback((sketches: RegionlessSketch[]) => {
    console.log("📋 Setting Sketches:", { count: sketches.length });
    setState((prev) => ({ ...prev, sketches }));
  }, []);

  const addSketch = useCallback((sketch: RegionlessSketch) => {
    console.log("➕ Adding New Sketch:", { id: sketch.id });
    setState((prev) => ({ ...prev, sketches: [...prev.sketches, sketch] }));
  }, []);

  const removeSketch = useCallback((id: string) => {
    console.log("🗑️ Removing Sketch:", {
      id,
      isCurrentSketch: stateRef.current.currentSketch?.id === id,
    });
    setState((prev) => ({
      ...prev,
      sketches: prev.sketches.filter((s) => s.id !== id),
      currentSketch: prev.currentSketch?.id === id ? null : prev.currentSketch,
    }));
  }, []);

  // Memoize actions object with stable function references
  const actions = useMemo(
    () => ({
      setDrawing,
      setStrokeWidth,
      setCurrentSketch,
      setSketches,
      addSketch,
      removeSketch,
    }),
    [setDrawing, setStrokeWidth, setCurrentSketch, setSketches, addSketch, removeSketch]
  );

  const value = useMemo(() => ({ state, actions }), [state, actions]);

  return <SketchContext.Provider value={value}>{children}</SketchContext.Provider>;
};
