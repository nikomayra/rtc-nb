import { useCallback, useRef } from "react";
import { DrawPath, Sketch } from "../types/interfaces";

export interface SketchState {
  // Core sketch data
  sketch: Sketch | null;
  // Paths storage
  existingPaths: DrawPath[]; // Paths that existed when sketch was loaded or received from server
  paths: DrawPath[]; // Local paths drawn in current session
  pendingPaths: DrawPath[]; // Local paths not yet synced
  // States
  isDrawing: boolean;
  isPending: boolean;
}

interface UseSketchStateReturn {
  // State
  state: SketchState;
  // Path management
  addPath: (path: DrawPath) => void;
  addRemotePath: (path: DrawPath) => void;
  removePath: (index: number) => void;
  clearPaths: () => void;
  // Initialize/reset
  setSketch: (sketch: Sketch | null) => void;
  markAsDrawing: (isDrawing: boolean) => void;
  markAsPending: (isPending: boolean) => void;
}

export const useSketchState = (): UseSketchStateReturn => {
  // Use refs for the actual data to avoid unnecessary renders
  const stateRef = useRef<SketchState>({
    sketch: null,
    existingPaths: [],
    paths: [],
    pendingPaths: [],
    isDrawing: false,
    isPending: false,
  });

  const setSketch = useCallback((sketch: Sketch | null) => {
    console.log(`📝 [useSketchState] Setting sketch: ${sketch?.id || "null"}`);
    stateRef.current.sketch = sketch;

    // Reset paths when sketch changes
    stateRef.current.paths = [];
    stateRef.current.pendingPaths = [];

    // Reset existing paths
    stateRef.current.existingPaths = [];

    // If sketch has regions with paths, add them to existing paths
    if (sketch?.regions) {
      Object.values(sketch.regions).forEach((region) => {
        if (region.paths && region.paths.length > 0) {
          stateRef.current.existingPaths.push(...region.paths);
        }
      });
      console.log(`📊 [useSketchState] Loaded ${stateRef.current.existingPaths.length} existing paths`);
    }

    console.log(`🔄 [useSketchState] Reset paths on sketch change`);
  }, []);

  const addPath = useCallback((path: DrawPath) => {
    console.log(`➕ [useSketchState] Adding local path with ${path.points.length} points`);
    // Add new path to local paths
    stateRef.current.paths.push(path);
  }, []);

  // Handle remote paths
  const addRemotePath = useCallback((path: DrawPath) => {
    console.log(`➕ [useSketchState] Adding remote path with ${path.points.length} points to existingPaths`);
    // Add directly to existingPaths
    stateRef.current.existingPaths.push(path);
  }, []);

  const removePath = useCallback((index: number) => {
    if (index < 0 || index >= stateRef.current.pendingPaths.length) {
      console.warn(`⚠️ [useSketchState] Invalid path index: ${index}`);
      return;
    }

    console.log(`➖ [useSketchState] Removing path at index ${index}`);
    stateRef.current.pendingPaths.splice(index, 1);
  }, []);

  const clearPaths = useCallback(() => {
    console.log(`🧹 [useSketchState] Clearing all paths`);
    stateRef.current.pendingPaths = [];
    stateRef.current.existingPaths = [];
    stateRef.current.paths = [];
  }, []);

  const markAsDrawing = useCallback((isDrawing: boolean) => {
    stateRef.current.isDrawing = isDrawing;
  }, []);

  const markAsPending = useCallback((isPending: boolean) => {
    stateRef.current.isPending = isPending;
  }, []);

  return {
    state: stateRef.current,
    addPath,
    addRemotePath,
    removePath,
    clearPaths,
    setSketch,
    markAsDrawing,
    markAsPending,
  };
};
