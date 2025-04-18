import { useState, useCallback, useRef, useEffect } from "react";
import { throttle } from "lodash";
import useCanvasDrawing from "./useCanvasDrawing";
import { useSketchSync, SketchUpdateData } from "./useSketchSync";
import { useSketchContext } from "./useSketchContext";
import { DrawPath, Point, Region } from "../types/interfaces";

const PARTIAL_UPDATE_THROTTLE_MS = 50;

interface UseSketchManagerProps {
  channelName: string | undefined;
}

const calculateRegionForPath = (path: DrawPath): Region => {
  if (!path.points || path.points.length === 0) {
    console.warn("[Manager] Calculating region for empty path.");
    return { start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, paths: [path] };
  }
  const buffer = Math.ceil(path.strokeWidth / 2) + (path.isDrawing ? 0 : 2);

  let minX = path.points[0].x;
  let minY = path.points[0].y;
  let maxX = path.points[0].x;
  let maxY = path.points[0].y;

  for (let i = 1; i < path.points.length; i++) {
    minX = Math.min(minX, path.points[i].x);
    minY = Math.min(minY, path.points[i].y);
    maxX = Math.max(maxX, path.points[i].x);
    maxY = Math.max(maxY, path.points[i].y);
  }

  return {
    start: { x: minX - buffer, y: minY - buffer },
    end: { x: maxX + buffer, y: maxY + buffer },
    paths: [path],
  };
};

/**
 * Manages the state and interactions for an active sketch instance.
 */
export const useSketchManager = ({ channelName }: UseSketchManagerProps) => {
  const { state: sketchContextState, actions: sketchActions } = useSketchContext();
  // Destructure all needed functions/state from useCanvasDrawing
  const { canvasRef, initializeCanvas, clear, redrawCanvas, drawPath, getCanvasPoint, isValidPoint, canvasState } =
    useCanvasDrawing();

  // Local state only for tracking the active drawing/erasing interaction
  const [localInteractionState, setLocalInteractionState] = useState<{
    isDrawingOrErasing: boolean;
    currentPath: DrawPath | null;
  }>({
    isDrawingOrErasing: false,
    currentPath: null,
  });

  // --- Synchronization ---

  const handleRemoteUpdate = useCallback(
    (data: SketchUpdateData) => {
      // Ignore updates for sketches other than the current one
      if (data.sketchId !== sketchContextState.currentSketch?.id) return;

      if (import.meta.env.DEV)
        console.log(`📥 [Manager] Received ${data.isPartial ? "PARTIAL" : "COMPLETE"} update from ${data.username}`);

      if (data.region.paths && data.region.paths.length > 0) {
        // When receiving remote updates, use the two-pass approach IF the update isn't partial
        // Partial updates should just draw directly for responsiveness
        // Apply path with correct composite operation directly
        const path = data.region.paths[0];
        const ctx = canvasRef.current?.getContext("2d");
        if (ctx) {
          const originalGCO = ctx.globalCompositeOperation; // Store original GCO
          ctx.globalCompositeOperation = path.isDrawing ? "source-over" : "destination-out";
          drawPath(path);
          ctx.globalCompositeOperation = originalGCO; // Restore original GCO
        } else {
          console.warn("[Manager] Context not available for remote update redraw.");
        }
      } else {
        console.warn("[Manager] Received update region with no paths:", data.region);
      }
    },
    [drawPath, canvasRef, sketchContextState.currentSketch]
  );

  // Instantiate the sync hook, passing sketch ID directly from context
  const sketchSync = useSketchSync({
    channelName,
    sketchId: sketchContextState.currentSketch?.id,
    callbacks: {
      onUpdateFromServer: handleRemoteUpdate,
    },
  });

  // --- Canvas Initialization & Sketch Loading Effect ---

  useEffect(() => {
    const sketch = sketchContextState.currentSketch;
    const canvas = canvasRef.current; // Get the current canvas element

    if (import.meta.env.DEV)
      console.log(`[Manager] Canvas Effect run. Sketch: ${sketch?.id ?? "null"}, Canvas Ready: ${!!canvas}`);

    // Always reset local drawing state when sketch changes or becomes null
    setLocalInteractionState((prev) => {
      // Only log if state is actually changing
      if ((prev.isDrawingOrErasing || prev.currentPath) && import.meta.env.DEV) {
        console.log("[Manager] Resetting local drawing state.");
      }
      // Return the reset state regardless
      return { isDrawingOrErasing: false, currentPath: null };
    });

    if (canvas) {
      // Only proceed if canvas element exists
      if (sketch) {
        const { width, height, regions } = sketch;

        // Initialize canvas only if dimensions mismatch
        if (canvas.width !== width || canvas.height !== height) {
          if (import.meta.env.DEV)
            console.log(`[Manager] Initializing canvas ${width}x${height} (Current: ${canvas.width}x${canvas.height})`);
          initializeCanvas(width, height);
        } else {
          // Dimensions match, just clear before redrawing paths
          if (import.meta.env.DEV) console.log(`[Manager] Canvas dimensions match. Clearing before redraw.`);
          clear();
        }

        // --- Two-Pass Rendering --- //
        const allPaths = regions ? Object.values(regions).flatMap((r) => r.paths || []) : [];
        const drawPaths = allPaths.filter((p) => p.isDrawing);
        const erasePaths = allPaths.filter((p) => !p.isDrawing);
        const ctx = canvasRef.current?.getContext("2d");

        if (ctx) {
          // Pass 1: Draw the 'drawing' paths
          if (drawPaths.length > 0) {
            if (import.meta.env.DEV) console.log(`[Manager] Pass 1: Redrawing ${drawPaths.length} 'draw' paths.`);
            ctx.globalCompositeOperation = "source-over"; // Ensure default
            redrawCanvas(drawPaths);
          }

          // Pass 2: Draw the 'erase' paths
          if (erasePaths.length > 0) {
            if (import.meta.env.DEV) console.log(`[Manager] Pass 2: Redrawing ${erasePaths.length} 'erase' paths.`);
            ctx.globalCompositeOperation = "destination-out"; // Set erase mode
            redrawCanvas(erasePaths);
            ctx.globalCompositeOperation = "source-over";
          }

          // If there were no paths at all, ensure canvas is clear if dimensions matched
          if (allPaths.length === 0 && canvas.width === width && canvas.height === height) {
            clear();
          }
        } else {
          if (import.meta.env.DEV) console.warn("[Manager] Canvas context not available for redrawing.");
        }
      } else {
        // No sketch selected, but canvas exists - clear it
        if (import.meta.env.DEV) console.log("[Manager] No sketch selected. Clearing canvas.");
        clear();
      }
    }
  }, [
    sketchContextState.currentSketch, // Primary dependency: The sketch data
    canvasRef, // The ref object itself (stable)
    initializeCanvas, // Stable function from useCanvasDrawing
    clear, // Stable function
    redrawCanvas, // Stable function
  ]);

  // --- Throttled Send for Partial Updates ---

  const throttledSendPartialUpdateRef = useRef(
    throttle(
      (region: Region) => {
        // Send update only if a sketch is active (check context)
        if (sketchContextState.currentSketch) {
          sketchSync.sendUpdate(region, true);
        }
      },
      PARTIAL_UPDATE_THROTTLE_MS,
      { leading: false, trailing: true }
    )
  );

  // Effect to clean up throttle on unmount
  useEffect(() => {
    const throttledFunc = throttledSendPartialUpdateRef.current;
    return () => {
      throttledFunc.cancel();
    };
  }, []);

  // --- Interaction Handlers ---

  const handleMouseDown = useCallback(
    (point: Point, isDrawingTool: boolean, strokeWidth: number, currentColor: string) => {
      // Use current sketch directly from context
      if (!sketchContextState.currentSketch) return;

      const newPath: DrawPath = {
        points: [point],
        isDrawing: isDrawingTool,
        strokeWidth: strokeWidth,
        color: currentColor,
      };

      if (import.meta.env.DEV) console.log(`👇 [Manager] Start path - setting state only`);

      // Set the new interaction state, DO NOT draw yet
      setLocalInteractionState({
        isDrawingOrErasing: true,
        currentPath: newPath,
      });

      // drawPath(newPath); // REMOVED: Do not draw single point immediately
    },
    [sketchContextState.currentSketch]
  );

  const handleMouseMove = useCallback(
    (point: Point) => {
      // Use functional update to safely modify state based on previous state
      setLocalInteractionState((prev) => {
        // Only proceed if currently drawing/erasing
        if (!prev.isDrawingOrErasing || !prev.currentPath) return prev;

        // Add the new point
        const updatedPath: DrawPath = {
          ...prev.currentPath,
          points: [...prev.currentPath.points, point],
        };

        // Draw the path (now guaranteed to have >= 2 points if mouse has moved)
        // Set context GCO before drawing locally
        const ctx = canvasRef.current?.getContext("2d");
        if (ctx) {
          const originalGCO = ctx.globalCompositeOperation;
          ctx.globalCompositeOperation = updatedPath.isDrawing ? "source-over" : "destination-out";
          drawPath(updatedPath);
          ctx.globalCompositeOperation = originalGCO; // Restore after drawing
        } else {
          console.warn("[Manager] Context not available for local draw path.");
        }

        // Calculate region and send throttled update
        const region = calculateRegionForPath(updatedPath);
        throttledSendPartialUpdateRef.current(region);

        // Return updated interaction state
        return { ...prev, currentPath: updatedPath };
      });
    },
    [canvasRef, drawPath]
  );

  const handleMouseUp = useCallback(() => {
    // Read interaction state directly at the end of the action
    if (!localInteractionState.isDrawingOrErasing || !localInteractionState.currentPath) return;

    const finalPath = localInteractionState.currentPath;
    const currentSketch = sketchContextState.currentSketch; // Read context state

    if (import.meta.env.DEV) console.log(`👆 [Manager] Complete path (${finalPath.points.length} points)`);

    // Reset interaction state BEFORE async/throttled actions
    setLocalInteractionState({ isDrawingOrErasing: false, currentPath: null });

    throttledSendPartialUpdateRef.current.cancel(); // Cancel pending partial updates

    // Send complete path if long enough and sketch exists
    if (finalPath.points.length > 1 && currentSketch) {
      const finalRegion = calculateRegionForPath(finalPath);
      sketchSync.sendUpdate(finalRegion, false);
    } else {
      // Path was too short (likely a click) or no active sketch
      if (import.meta.env.DEV) console.log("[Manager] Path too short or no sketch, not sending complete update.");
    }
  }, [
    // Read state needed for logic
    localInteractionState.isDrawingOrErasing,
    localInteractionState.currentPath,
    sketchContextState.currentSketch,
    // Stable functions/objects needed
    sketchSync,
    throttledSendPartialUpdateRef,
  ]);

  // --- Actions ---

  const clearLocalAndRemote = useCallback(() => {
    const sketchToClear = sketchContextState.currentSketch;
    if (!sketchToClear || !channelName) return;

    if (import.meta.env.DEV) console.log(`🧹 [Manager] Requesting clear via API for ${sketchToClear.id}`);

    sketchActions
      .clearSketch(channelName, sketchToClear.id)
      .then(() => {
        // Optimistic clear (context reload will also clear/redraw)
        clear();
      })
      .catch((error: unknown) => {
        // Error is displayed by the provider's action
        console.error(
          "[Manager] Error during clearSketch context action:",
          error instanceof Error ? error.message : error
        );
      });
  }, [sketchContextState.currentSketch, sketchActions, clear, channelName]);

  // --- Return Value ---

  return {
    // Pass down canvas ref and stable methods/state
    canvasRef,
    canvasState, // Includes dimensions and context ref
    getCanvasPoint,
    isValidPoint,
    // Expose current sketch directly from context
    currentSketch: sketchContextState.currentSketch,
    // Interaction handlers
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    // Actions
    clearLocalAndRemote,
  };
};
