import { createContext } from "react";
import { Sketch, RegionlessSketch } from "../types/interfaces";

export interface SketchContextState {
  drawing: boolean;
  strokeWidth: number;
  currentSketch: Sketch | null;
  sketches: RegionlessSketch[];
}

interface SketchContextValue {
  state: SketchContextState;
  actions: {
    setDrawing: (value: boolean) => void;
    setStrokeWidth: (value: number) => void;
    setCurrentSketch: (sketch: Sketch | null) => void;
    setSketches: (sketches: RegionlessSketch[]) => void;
    addSketch: (sketch: RegionlessSketch) => void;
    removeSketch: (id: string) => void;
  };
}

export const SketchContext = createContext<SketchContextValue | null>(null);
