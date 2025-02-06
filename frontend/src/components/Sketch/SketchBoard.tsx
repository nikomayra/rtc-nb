import "../../styles/components/sketch.css";
import { useState, useCallback, useRef, memo } from "react";
import { DrawPath } from "../../types/interfaces";
import useCanvas from "../../hooks/useCanvas";
import { useSketchActions } from "../../hooks/useSketchActions";

interface SketchBoardProps {
  onPathComplete: (path: DrawPath) => void;
  canvasOps: ReturnType<typeof useCanvas>;
  onClear: () => void;
  sketchActions: ReturnType<typeof useSketchActions>;
}

export const SketchBoard = memo(({ onPathComplete, canvasOps, onClear, sketchActions }: SketchBoardProps) => {
  const [isDrawing, setIsDrawing] = useState(true);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [isInteracting, setIsInteracting] = useState(false);

  const currentPathRef = useRef<DrawPath>({
    points: [],
    isDrawing,
    strokeWidth,
  });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      setIsInteracting(true);
      const point = canvasOps.getCanvasPoint(e);
      if (!point || !canvasOps.isValidPoint(point)) return;

      currentPathRef.current = {
        points: [point],
        isDrawing,
        strokeWidth,
      };
    },
    [canvasOps, isDrawing, strokeWidth]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isInteracting) return;

      const point = canvasOps.getCanvasPoint(e);
      if (!point || !canvasOps.isValidPoint(point)) return;

      const prevPoint = currentPathRef.current.points[currentPathRef.current.points.length - 1];
      if (prevPoint) {
        canvasOps.drawPath(prevPoint, point, isDrawing, strokeWidth);
      }

      currentPathRef.current.points.push(point);
    },
    [canvasOps, isInteracting, isDrawing, strokeWidth]
  );

  const handleMouseUp = useCallback(() => {
    if (!isInteracting) return;

    if (currentPathRef.current.points.length > 0) {
      onPathComplete(currentPathRef.current);
    }

    setIsInteracting(false);
    currentPathRef.current = {
      points: [],
      isDrawing,
      strokeWidth,
    };
  }, [isInteracting, isDrawing, strokeWidth, onPathComplete]);

  return (
    <div className="sketch-board-container">
      <div className="sketch-board">
        <canvas
          ref={canvasOps.canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>
      <div className="sketch-toolbar">
        <button onClick={() => setIsDrawing(true)} className={isDrawing ? "active" : ""}>
          Pen🖊️
        </button>
        <button onClick={() => setIsDrawing(false)} className={!isDrawing ? "active" : ""}>
          Eraser🧹
        </button>
        <select value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((width) => (
            <option key={width} value={width}>
              {width}
            </option>
          ))}
        </select>
        <button onClick={onClear}>Clear🗑️</button>
        <button onClick={sketchActions.undo} disabled={!sketchActions.canUndo()}>
          Undo↩️
        </button>
        <button onClick={sketchActions.redo} disabled={!sketchActions.canRedo()}>
          Redo↪️
        </button>
      </div>
    </div>
  );
});

SketchBoard.displayName = "SketchBoard";
