import { useRef, useCallback, useContext } from "react";
import { DrawPath, MessageType, Point, SketchCommandType } from "../types/interfaces";
import { WebSocketContext } from "../contexts/webSocketContext";

interface Bounds {
  start: Point;
  end: Point;
}

export function useSketchActions(
  channelName: string,
  sketchId: string,
  drawFullPath: (path: DrawPath) => void,
  calculateBounds: (points: Point[]) => Bounds
) {
  const undoStack = useRef<DrawPath[]>([]);
  const redoStack = useRef<DrawPath[]>([]);

  const wsService = useContext(WebSocketContext);
  if (!wsService) throw new Error("WebSocketContext not found");

  const sendSketchUpdate = useCallback(
    (path: DrawPath, isInverse: boolean = false) => {
      if (!path.points.length) return;

      try {
        const bounds = calculateBounds(path.points);
        console.log("📤 Sending Update:", {
          bounds,
          isInverse,
          pathPoints: path.points.length,
        });
        const updatedRegion = {
          start: bounds.start,
          end: bounds.end,
          paths: [
            {
              points: path.points,
              isDrawing: isInverse ? !path.isDrawing : path.isDrawing,
              strokeWidth: path.strokeWidth,
            },
          ],
        };

        wsService.actions.send({
          channelName,
          type: MessageType.Sketch,
          content: {
            sketchCmd: {
              commandType: SketchCommandType.Update,
              sketchId,
              region: updatedRegion,
            },
          },
        });
      } catch (error) {
        console.error("Failed to send sketch update:", error);
      }
    },
    [wsService, channelName, sketchId, calculateBounds]
  );

  const addPath = useCallback(
    (path: DrawPath) => {
      undoStack.current.push(path);
      redoStack.current = [];
      console.log("➕ Adding Path:", {
        path,
        undoStackSize: undoStack.current.length,
      });
      sendSketchUpdate(path);
    },
    [sendSketchUpdate]
  );

  const undo = useCallback(() => {
    const pathToUndo = undoStack.current.pop();
    if (!pathToUndo) return;

    redoStack.current.push(pathToUndo);
    const inversePath = {
      ...pathToUndo,
      isDrawing: !pathToUndo.isDrawing,
    };
    drawFullPath(inversePath);
    sendSketchUpdate(pathToUndo, true);
  }, [sendSketchUpdate, drawFullPath]);

  const redo = useCallback(() => {
    const pathToRedo = redoStack.current.pop();
    if (!pathToRedo) return;

    undoStack.current.push(pathToRedo);
    drawFullPath(pathToRedo);
    sendSketchUpdate(pathToRedo);
  }, [sendSketchUpdate, drawFullPath]);

  return {
    addPath,
    undo,
    redo,
    canUndo: () => undoStack.current.length > 0,
    canRedo: () => redoStack.current.length > 0,
  };
}
