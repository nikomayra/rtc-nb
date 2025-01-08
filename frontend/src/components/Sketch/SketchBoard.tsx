import "../../styles/components/sketch.css";
import { useEffect, useState, useCallback, useContext } from "react";
import { DrawPath, SketchUpdate, MessageType, IncomingMessage, Sketch } from "../../types/interfaces";
import { WebSocketContext } from "../../contexts/webSocketContext";
import { useSketchActions } from "../../hooks/useSketchActions";
import { useCanvas } from "../../hooks/useCanvas";

interface SketchBoardProps {
  currentSketch: Sketch;
  drawing: boolean;
  strokeWidth: number;
  sketchActions: ReturnType<typeof useSketchActions>;
  canvasOps: ReturnType<typeof useCanvas>;
}

export const SketchBoard = ({ currentSketch, drawing, strokeWidth, sketchActions, canvasOps }: SketchBoardProps) => {
  const [isInteracting, setIsInteracting] = useState(false);
  const [currentPath, setCurrentPath] = useState<DrawPath>({
    points: [],
    isDrawing: drawing,
    strokeWidth: strokeWidth,
  });
  const POINTS_PER_PATH = 20;

  const wsService = useContext(WebSocketContext);
  if (!wsService) throw new Error("WebSocketContext not found");

  // Update current path when drawing/strokeWidth changes
  useEffect(() => {
    setCurrentPath((prev) => ({
      ...prev,
      isDrawing: drawing,
      strokeWidth: strokeWidth,
    }));
  }, [drawing, strokeWidth]);

  const flushBuffer = useCallback(() => {
    if (currentPath.points.length === 0) return;
    sketchActions.addPath(currentPath);
    setCurrentPath((prev) => ({ ...prev, points: [] }));
  }, [currentPath, sketchActions]);

  // Flush buffer if points exceed limit
  useEffect(() => {
    if (currentPath.points.length === 0) return;
    if (currentPath.points.length >= POINTS_PER_PATH) flushBuffer();
  }, [currentPath.points, flushBuffer]);

  // Mouse events
  const handleMouseUp = () => {
    flushBuffer();
    setIsInteracting(false);
  };

  const handleMouseDown = () => {
    setIsInteracting(true);
  };

  const handleMouseLeave = () => {
    if (isInteracting) {
      flushBuffer();
      setIsInteracting(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isInteracting) return;

    const point = canvasOps.getCanvasPoint(e);
    if (!point || !canvasOps.isValidPoint(point)) return;

    const prevPoint = currentPath.points[currentPath.points.length - 1];
    if (prevPoint) {
      canvasOps.drawPath(prevPoint, point, drawing, strokeWidth);
    }

    setCurrentPath((prev) => ({ ...prev, points: [...prev.points, point] }));
  };

  // Draw received sketch updates
  const handleSketchUpdate = useCallback(
    (message: IncomingMessage) => {
      if (message.type === MessageType.SketchUpdate) {
        if (message.type !== MessageType.SketchUpdate) return;

        const update = message.content.sketchUpdate as SketchUpdate;
        if (update.sketchId !== currentSketch.id) return;

        const canvas = canvasOps.canvasRef.current;
        if (!canvas) return;

        // Draw each path in the update
        update.region.paths.forEach((path) => {
          const points = path.points;
          for (let i = 1; i < points.length; i++) {
            canvasOps.drawPath(points[i - 1], points[i], path.isDrawing, path.strokeWidth);
          }
        });
      } else if (message.type === MessageType.ClearSketch) {
        if (message.content.clearSketch === currentSketch.id) {
          canvasOps.clear();
        }
      }
    },
    [currentSketch.id, canvasOps]
  );

  useEffect(() => {
    wsService.actions.setMessageHandler(handleSketchUpdate);
    return () => wsService.actions.setMessageHandler(() => {});
  }, [wsService, handleSketchUpdate]);

  // Init on-load draw sketch from database
  const loadCurrentSketch = useCallback(() => {
    console.log("Drawing selected sketch...");
    const canvas = canvasOps.canvasRef.current;
    if (!canvas) return;

    // Clear the canvas before drawing
    canvasOps.clear();

    // Iterate through the regions
    Object.keys(currentSketch.regions).forEach((regionKey) => {
      const region = currentSketch.regions[regionKey];

      // Iterate through each path in the region
      region.paths.forEach((path) => {
        const points = path.points;

        // Draw each segment of the path
        for (let i = 1; i < points.length; i++) {
          canvasOps.drawPath(points[i - 1], points[i], path.isDrawing, path.strokeWidth);
        }
      });
    });
  }, [currentSketch.regions, canvasOps]);

  // Load when currentSketch changes
  useEffect(() => {
    loadCurrentSketch();
  }, [currentSketch, loadCurrentSketch]);

  return (
    <div className="sketch-board">
      <canvas
        ref={canvasOps.canvasRef}
        width={currentSketch.width}
        height={currentSketch.height}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      ></canvas>
    </div>
  );
};
