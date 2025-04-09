import { createContext } from "react";
import { Sketch, DrawPath } from "../types/interfaces";

/**
 * Sketch context handles the global state for sketches, including:
 * - A list of available sketches
 * - The currently selected sketch
 * - Loading and error states
 * - Actions to modify the state
 */
export interface SketchState {
  sketches: Sketch[];
  currentSketch: Sketch | null;
  paths: DrawPath[]; // All completed paths for current sketch
  isLoading: boolean;
  // error: string | null;
}

// Pure state operations (synchronous)
export interface SketchStateActions {
  setCurrentSketch: (sketch: Sketch | null) => void;
  addPath: (path: DrawPath) => void;
  clearPaths: () => void;
  setLoading: (isLoading: boolean) => void;
  // setError: (error: string | null) => void;
}

// Service operations (asynchronous)
export interface SketchServiceActions {
  createSketch: (channelName: string, displayName: string, width: number, height: number) => Promise<Sketch>;
  deleteSketch: (sketchId: string) => Promise<void>;
  loadSketch: (channelName: string, sketchId: string) => Promise<Sketch | null>;
  loadSketches: (channelName: string) => Promise<Sketch[]>;
  clearSketch: (channelName: string, sketchId: string) => Promise<void>;
}

// Combined actions interface
export interface SketchActions extends SketchStateActions, SketchServiceActions {}

export interface SketchContextType {
  state: SketchState;
  actions: SketchActions;
}

export const initialState: SketchState = {
  sketches: [],
  currentSketch: null,
  paths: [],
  isLoading: false,
  // error: null,
};

export const SketchContext = createContext<SketchContextType | null>(null);
