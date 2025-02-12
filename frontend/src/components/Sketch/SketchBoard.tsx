import { useState, useCallback, useRef, memo, useEffect, useContext } from "react";
import { DrawPath, Point } from "../../types/interfaces";
import useCanvas from "../../hooks/useCanvas";
import { useSketchActions } from "../../hooks/useSketchActions";
import { SketchContext } from "../../contexts/sketchContext";

interface SketchBoardProps {
  onPathComplete: (path: DrawPath) => void;
  canvasOps: ReturnType<typeof useCanvas>;
  onClear: () => void;
  sketchActions: ReturnType<typeof useSketchActions>;
}

type Tool = "draw" | "erase" | "pan";

export const SketchBoard = memo(({ onPathComplete, canvasOps, onClear, sketchActions }: SketchBoardProps) => {
  const [currentTool, setCurrentTool] = useState<Tool>("draw");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [isInteracting, setIsInteracting] = useState(false);
  const [panStart, setPanStart] = useState<Point | null>(null);

  const sketchContext = useContext(SketchContext);
  if (!sketchContext) throw new Error("Context missing");

  const currentPathRef = useRef<DrawPath>({
    points: [],
    isDrawing: currentTool === "draw",
    strokeWidth,
  });

  // Prevent memory leaks by cleaning up paths
  useEffect(() => {
    return () => {
      currentPathRef.current = {
        points: [],
        isDrawing: true,
        strokeWidth: 2,
      };
    };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!canvasOps.canvasRef.current) return;

      setIsInteracting(true);

      if (currentTool === "pan") {
        setPanStart({ x: e.clientX, y: e.clientY });
        return;
      }

      const point = canvasOps.getCanvasPoint(e);
      if (!point || !canvasOps.isValidPoint(point)) {
        console.warn("Invalid point detected");
        return;
      }

      currentPathRef.current = {
        points: [point],
        isDrawing: currentTool === "draw",
        strokeWidth,
      };
    },
    [canvasOps, currentTool, strokeWidth]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isInteracting) return;

      if (currentTool === "pan" && panStart) {
        const container = e.currentTarget.parentElement;
        if (!container) return;

        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;

        container.scrollLeft -= dx;
        container.scrollTop -= dy;

        setPanStart({ x: e.clientX, y: e.clientY });
        return;
      }

      const point = canvasOps.getCanvasPoint(e);
      if (!point || !canvasOps.isValidPoint(point)) return;

      const prevPoint = currentPathRef.current.points[currentPathRef.current.points.length - 1];
      if (prevPoint) {
        canvasOps.drawPath(prevPoint, point, currentTool === "draw", strokeWidth);
      }

      currentPathRef.current.points.push(point);
    },
    [isInteracting, currentTool, panStart, canvasOps, strokeWidth]
  );

  const handleMouseUp = useCallback(() => {
    if (!isInteracting) return;

    if (currentPathRef.current.points.length > 0) {
      onPathComplete(currentPathRef.current);
    }

    setIsInteracting(false);
    currentPathRef.current = {
      points: [],
      isDrawing: currentTool === "draw",
      strokeWidth,
    };
  }, [isInteracting, currentTool, strokeWidth, onPathComplete]);

  return (
    <div className="sketch-board-container">
      <div className="sketch-title">
        <span>{sketchContext.state.currentSketch?.displayName}</span>
      </div>
      <div className="sketch-board">
        <canvas
          ref={canvasOps.canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ touchAction: "none" }} // Prevent touch scrolling while drawing
        />
      </div>
      <div className="sketch-toolbar">
        <button onClick={() => setCurrentTool("draw")} disabled={isInteracting}>
          Pen🖊️
        </button>
        <button onClick={() => setCurrentTool("erase")} disabled={isInteracting}>
          Eraser🧹
        </button>
        <button onClick={() => setCurrentTool("pan")} disabled={isInteracting}>
          Pan🤚
        </button>
        <select value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} disabled={isInteracting}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((width) => (
            <option key={width} value={width}>
              {width}
            </option>
          ))}
        </select>
        <button onClick={onClear} disabled={isInteracting}>
          Clear🗑️
        </button>
        <button onClick={sketchActions.undo} disabled={!sketchActions.canUndo() || isInteracting}>
          Undo↩️
        </button>
        <button onClick={sketchActions.redo} disabled={!sketchActions.canRedo() || isInteracting}>
          Redo↪️
        </button>
      </div>
    </div>
  );
});

SketchBoard.displayName = "SketchBoard";
