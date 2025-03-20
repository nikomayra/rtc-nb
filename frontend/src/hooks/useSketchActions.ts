// import { useCallback, useContext, useState, useEffect, useRef } from "react";
// import { DrawPath, MessageType, Point, SketchCommandType } from "../types/interfaces";
// import { WebSocketContext } from "../contexts/webSocketContext";

/**
 * @deprecated Use the useSketch hook instead.
 * This hook is kept for backward compatibility only.
 */

// interface Bounds {
//   start: Point;
//   end: Point;
// }

// export function useSketchActions(
//   channelName: string,
//   sketchId: string,
//   drawFullPath: (path: DrawPath) => void,
//   addPath: (path: DrawPath) => void,
//   calculateBounds: (points: Point[]) => Bounds
// ) {
//   // Track stacks with useRef to avoid re-renders which could cause issues
//   const undoStackRef = useRef<DrawPath[]>([]);
//   const redoStackRef = useRef<DrawPath[]>([]);

//   // Use state only for counts to trigger UI updates
//   const [undoCount, setUndoCount] = useState(0);
//   const [redoCount, setRedoCount] = useState(0);

//   // Track if we're currently in an undo/redo operation to prevent nesting
//   const isPerformingUndoRedoRef = useRef(false);

//   const wsService = useContext(WebSocketContext);
//   if (!wsService) throw new Error("WebSocketContext not found");

//   // Clear stacks when sketch ID changes
//   useEffect(() => {
//     undoStackRef.current = [];
//     redoStackRef.current = [];
//     setUndoCount(0);
//     setRedoCount(0);
//     isPerformingUndoRedoRef.current = false;
//   }, [sketchId]);

//   // Safe helper for stack manipulations that updates counts
//   const updateStacks = useCallback((updateFn: () => void) => {
//     console.log(`🧮 [updateStacks] Before: undo=${undoStackRef.current.length}, redo=${redoStackRef.current.length}`);
//     updateFn();
//     setUndoCount(undoStackRef.current.length);
//     setRedoCount(redoStackRef.current.length);
//     console.log(`🧮 [updateStacks] After: undo=${undoStackRef.current.length}, redo=${redoStackRef.current.length}`);
//   }, []);

//   const sendSketchUpdate = useCallback(
//     (path: DrawPath) => {
//       if (!path.points.length) return;

//       try {
//         const bounds = calculateBounds(path.points);
//         console.log(`📤 [sendSketchUpdate] Sending path: ${path.points.length} points, isDrawing=${path.isDrawing}`);

//         const updatedRegion = {
//           start: bounds.start,
//           end: bounds.end,
//           paths: [
//             {
//               points: path.points,
//               isDrawing: path.isDrawing,
//               strokeWidth: path.strokeWidth,
//             },
//           ],
//         };

//         wsService.actions.send({
//           channelName,
//           type: MessageType.Sketch,
//           content: {
//             sketchCmd: {
//               commandType: SketchCommandType.Update,
//               sketchId,
//               region: updatedRegion,
//             },
//           },
//         });
//       } catch (error) {
//         console.error("Failed to send sketch update:", error);
//       }
//     },
//     [wsService, channelName, sketchId, calculateBounds]
//   );

//   const addPathToStack = useCallback(
//     (path: DrawPath) => {
//       // Don't add to undo stack if we're in the middle of an undo/redo
//       if (isPerformingUndoRedoRef.current) {
//         console.log("🛑 [addPath] Skipping during undo/redo operation");
//         return;
//       }

//       console.log(`➕ [addPath] Path with ${path.points.length} points to undo stack`);

//       // Add to undo stack and clear redo stack
//       updateStacks(() => {
//         undoStackRef.current.push(path);
//         redoStackRef.current = []; // Clear redo stack on new drawing
//       });

//       // This function is called after the path is already drawn locally,
//       // so we only need to send it to other clients via WebSocket
//       sendSketchUpdate(path);
//     },
//     [sendSketchUpdate, updateStacks]
//   );

//   const undo = useCallback(() => {
//     if (undoStackRef.current.length === 0 || isPerformingUndoRedoRef.current) {
//       console.log(
//         `🚫 [undo] Cannot undo: stack empty=${undoStackRef.current.length === 0}, busy=${
//           isPerformingUndoRedoRef.current
//         }`
//       );
//       return;
//     }

//     console.log(`↩️ [undo] Starting undo operation`);
//     try {
//       isPerformingUndoRedoRef.current = true;

//       const pathToUndo = undoStackRef.current.pop();
//       if (!pathToUndo) return;
//       console.log(`↩️ [undo] Popped path with ${pathToUndo.points.length} points`);

//       // Add to redo stack
//       redoStackRef.current.push(pathToUndo);

//       // Update UI counts
//       setUndoCount(undoStackRef.current.length);
//       setRedoCount(redoStackRef.current.length);

//       // Create the inverse operation (toggle drawing/erasing)
//       const inversePath = {
//         ...pathToUndo,
//         isDrawing: !pathToUndo.isDrawing,
//         strokeWidth: pathToUndo.strokeWidth + 1, // Slightly thicker for erasing
//       };

//       // Draw the inverse path locally
//       drawFullPath(inversePath);

//       // Add to canvas state for persistence
//       addPath(inversePath);
//       // Send to other clients as a normal update
//       sendSketchUpdate(inversePath);
//     } finally {
//       // Reset the flag immediately
//       isPerformingUndoRedoRef.current = false;
//       console.log(`↩️ [undo] Finished undo operation`);
//     }
//   }, [addPath, drawFullPath, sendSketchUpdate]);

//   const redo = useCallback(() => {
//     if (redoStackRef.current.length === 0 || isPerformingUndoRedoRef.current) {
//       console.log(
//         `🚫 [redo] Cannot redo: stack empty=${redoStackRef.current.length === 0}, busy=${
//           isPerformingUndoRedoRef.current
//         }`
//       );
//       return;
//     }

//     console.log(`↪️ [redo] Starting redo operation`);
//     try {
//       isPerformingUndoRedoRef.current = true;

//       const pathToRedo = redoStackRef.current.pop();
//       if (!pathToRedo) return;
//       console.log(`↪️ [redo] Popped path with ${pathToRedo.points.length} points`);

//       // Move back to undo stack
//       undoStackRef.current.push(pathToRedo);

//       // Update UI counts
//       setUndoCount(undoStackRef.current.length);
//       setRedoCount(redoStackRef.current.length);

//       // Draw the original path
//       drawFullPath(pathToRedo);

//       // Add to canvas state for persistence
//       addPath(pathToRedo);

//       // Send to other clients as a normal update
//       sendSketchUpdate(pathToRedo);
//     } finally {
//       // Reset the flag immediately
//       isPerformingUndoRedoRef.current = false;
//       console.log(`↪️ [redo] Finished redo operation`);
//     }
//   }, [addPath, drawFullPath, sendSketchUpdate]);

//   return {
//     addPathToStack,
//     undo,
//     redo,
//     canUndo: () => undoStackRef.current.length > 0 && !isPerformingUndoRedoRef.current,
//     canRedo: () => redoStackRef.current.length > 0 && !isPerformingUndoRedoRef.current,
//     undoCount,
//     redoCount,
//     isPending: isPerformingUndoRedoRef.current,
//   };
// }
