import { useRef, useCallback, useContext } from "react";
import { DrawPath, SketchUpdate, MessageType, Point } from "../types/interfaces";
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

      const bounds = calculateBounds(path.points);
      const update: SketchUpdate = {
        sketchId,
        region: {
          start: bounds.start,
          end: bounds.end,
          paths: [
            {
              ...path,
              isDrawing: isInverse ? !path.isDrawing : path.isDrawing,
            },
          ],
        },
      };

      wsService.actions.send({
        channelName,
        type: MessageType.SketchUpdate,
        content: { sketchUpdate: update },
      });
    },
    [wsService, channelName, sketchId, calculateBounds]
  );

  const addPath = useCallback(
    (path: DrawPath) => {
      undoStack.current.push(path);
      redoStack.current = [];
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
