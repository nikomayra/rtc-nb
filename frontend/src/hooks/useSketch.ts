/**
 * @deprecated This hook is being phased out in favor of useSketchManager.
 * The original code is kept below for reference during refactoring.
 */

/*
// import { useState, useCallback, useContext, useEffect } from "react";
// import { DrawPath, Point } from "../types/interfaces";
// import useCanvasDrawing from "./useCanvasDrawing";
// import { useSketchSync } from "./useSketchSync";
// import { SketchContext } from "../contexts/sketchContext";

// const DEBUG = true;

// interface UseSketchProps {
//   channelName: string;
// }

// export const useSketch = ({ channelName }: UseSketchProps) => {
//   const { state, actions } = useContext(SketchContext)!;
//   const [currentPath, setCurrentPath] = useState<DrawPath | null>(null);

//   const canvasDrawing = useCanvasDrawing();

//   // Load or refresh canvas whenever the *ID* of the current sketch changes
//   useEffect(() => {
//     if (!state.currentSketch) return;

//     const { width, height } = state.currentSketch;
//     if (DEBUG) console.log(`🎨 [useSketch] Checking if canvas dimensions changed.`);

//     // Only initialize if the dimensions differ
//     if (canvasDrawing.canvasState.width !== width || canvasDrawing.canvasState.height !== height) {
//       if (DEBUG) console.log(`🎨 [useSketch] Initializing canvas with dimensions ${width}x${height}`);
//       canvasDrawing.initializeCanvas(width, height);
//     }

//     // Redraw if there are existing paths
//     if (state.paths.length > 0) {
//       if (DEBUG) console.log(`🔄 [useSketch] Redrawing ${state.paths.length} existing paths`);
//       canvasDrawing.redrawCanvas(state.paths);
//     }
//   }, [canvasDrawing, state.paths, state.currentSketch]);

//   // Initialize sketch sync
//   const sketchSync = useSketchSync({
//     channelName,
//     sketchId: state.currentSketch?.id,
//     onUpdateFromServer: (update) => {
//       if (DEBUG) console.log(`📥 [useSketch] Received update with ${update.paths?.length || 0} paths`);
//       // Add received paths to context and canvas
//       if (update.paths) {
//         update.paths.forEach((path: DrawPath) => {
//           actions.addPath(path);
//           canvasDrawing.drawPath(path);
//         });
//       }
//     },
//     onClearFromServer: () => {
//       if (DEBUG) console.log(`🧹 [useSketch] Received clear command`);
//       actions.clearPaths();
//       canvasDrawing.clear();
//     },
//   });

//   // Handle drawing operations
//   const handleDraw = useCallback(
//     (point: Point, isDrawing: boolean, strokeWidth: number, isComplete: boolean) => {
//       if (!point || !state.currentSketch) return;

//       if (!currentPath) {
//         // Start new path
//         if (DEBUG) console.log(`👇 [useSketch] Starting new path at (${point.x},${point.y})`);
//         const newPath: DrawPath = {
//           points: [point],
//           isDrawing,
//           strokeWidth,
//         };
//         setCurrentPath(newPath);
//         canvasDrawing.drawPath(newPath);
//       } else {
//         // Continue path
//         const updatedPath: DrawPath = {
//           ...currentPath,
//           points: [...currentPath.points, point],
//         };
//         setCurrentPath(updatedPath);
//         canvasDrawing.drawPath(updatedPath);

//         if (isComplete) {
//           // Path is complete, add to context and sync
//           if (DEBUG) console.log(`👆 [useSketch] Completing path with ${updatedPath.points.length} points`);
//           actions.addPath(updatedPath);
//           sketchSync.sendUpdate(updatedPath);
//           setCurrentPath(null);
//         }
//       }
//     },
//     [currentPath, canvasDrawing, actions, sketchSync, state.currentSketch]
//   );

//   // Clear the canvas
//   const clearCanvas = useCallback(() => {
//     if (DEBUG) console.log(`🧹 [useSketch] Clearing canvas`);
//     canvasDrawing.clear();
//     actions.clearPaths();
//     sketchSync.sendClear();
//   }, [canvasDrawing, actions, sketchSync]);

//   // Redraw all paths
//   const redrawAllPaths = useCallback(() => {
//     if (!state.currentSketch) return;

//     if (DEBUG) console.log(`🔄 [useSketch] Redrawing ${state.paths.length} paths`);
//     canvasDrawing.redrawCanvas(state.paths);
//   }, [canvasDrawing, state.paths, state.currentSketch]);

//   return {
//     // Canvas ref and dimensions
//     canvasRef: canvasDrawing.canvasRef,
//     canvasState: canvasDrawing.canvasState,

//     // Drawing operations
//     handleDraw,
//     clearCanvas,
//     redrawAllPaths,

//     // Utilities from canvas drawing
//     getCanvasPoint: canvasDrawing.getCanvasPoint,
//     isValidPoint: canvasDrawing.isValidPoint,

//     // Current sketch from context
//     currentSketch: state.currentSketch,

//     // Service operations from context
//     createSketch: actions.createSketch,
//     deleteSketch: actions.deleteSketch,
//     loadSketch: actions.loadSketch,
//   };
// };
*/
