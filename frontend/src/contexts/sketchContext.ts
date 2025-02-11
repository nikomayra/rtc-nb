import { createContext } from "react";
import { Sketch } from "../types/interfaces";

export interface SketchContextState {
  currentSketch: Sketch | null;
  sketches: Sketch[];
  isLoading: boolean;
  error: string | null;
}

export const initialState: SketchContextState = {
  currentSketch: null,
  sketches: [],
  isLoading: false,
  error: null,
};

interface SketchContextValue {
  state: SketchContextState;
  actions: {
    setCurrentSketch: (sketch: Sketch | null) => void;
    setSketches: (sketches: Sketch[]) => void;
    addSketch: (sketch: Sketch) => void;
    removeSketch: (id: string) => void;
    setLoading: (value: boolean) => void;
    setError: (error: string | null) => void;
  };
}

export const SketchContext = createContext<SketchContextValue | null>(null);
