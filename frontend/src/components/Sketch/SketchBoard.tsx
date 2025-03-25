import { useState, useCallback, memo, useRef } from "react";
import { Point } from "../../types/interfaces";
import { useSketch } from "../../hooks/useSketch";
import { SketchToolbar } from "./SketchToolbar";

// Define tools for the board
type Tool = "draw" | "erase" | "pan";

interface SketchBoardProps {
  channelName: string;
}

// Shared state across renders
const sharedState = {
  toolState: {
    tool: "draw" as Tool,
    strokeWidth: 3,
  },
};

export const SketchBoard = memo(({ channelName }: SketchBoardProps) => {
  // Use shared state to maintain tool selection across remounts
  const [currentTool, setCurrentTool] = useState<Tool>(sharedState.toolState.tool);
  const [strokeWidth, setStrokeWidth] = useState(sharedState.toolState.strokeWidth);
  const [isInteracting, setIsInteracting] = useState(false);
  const [panStart, setPanStart] = useState<Point | null>(null);

  // Reference to the scroll container for panning
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const sketch = useSketch({ channelName });
  const { canvasState, currentSketch } = sketch;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!sketch.canvasRef.current || !currentSketch || !canvasState.ctx) return;

      setIsInteracting(true);

      if (currentTool === "pan") {
        setPanStart({ x: e.clientX, y: e.clientY });
        e.currentTarget.style.cursor = "grabbing";
        return;
      }

      const point = sketch.getCanvasPoint(e);
      if (!point || !sketch.isValidPoint(point)) {
        console.warn("Invalid point detected");
        return;
      }

      sketch.handleDraw(point, currentTool === "draw", strokeWidth, false);
    },
    [sketch, currentTool, strokeWidth, currentSketch, canvasState.ctx]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isInteracting || !currentSketch || !canvasState.ctx) return;

      if (currentTool === "pan" && panStart) {
        const container = scrollContainerRef.current;
        if (!container) return;

        // Calculate the distance moved since last position
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;

        // Update scroll position
        container.scrollLeft -= dx;
        container.scrollTop -= dy;

        // Update the pan start position
        setPanStart({ x: e.clientX, y: e.clientY });
        return;
      }

      const point = sketch.getCanvasPoint(e);
      if (!point || !sketch.isValidPoint(point)) return;

      sketch.handleDraw(point, currentTool === "draw", strokeWidth, false);
    },
    [isInteracting, currentTool, panStart, sketch, strokeWidth, currentSketch, canvasState.ctx]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isInteracting || !currentSketch || !canvasState.ctx) return;

      if (currentTool === "pan") {
        if (sketch.canvasRef.current) {
          sketch.canvasRef.current.style.cursor = "grab";
        }
      } else {
        const point = sketch.getCanvasPoint(e);
        if (point && sketch.isValidPoint(point)) {
          sketch.handleDraw(point, currentTool === "draw", strokeWidth, true);
        }
      }

      setIsInteracting(false);
      setPanStart(null);
    },
    [isInteracting, currentTool, sketch, strokeWidth, currentSketch, canvasState.ctx]
  );

  if (!currentSketch) {
    return (
      <div className="flex w-full flex-col h-full items-center justify-center text-text-light/50">
        Please select a sketch to start drawing
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col h-full">
      <div className="text-center py-3 border-b border-primary/20">
        <h2 className="font-medium text-text-light">{currentSketch.displayName}</h2>
      </div>
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto bg-surface-dark/30 min-h-[300px] scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-surface-dark 
          scrollbar-hover:scrollbar-thumb-primary/30"
      >
        <div className="min-w-min">
          <canvas
            ref={sketch.canvasRef}
            width={canvasState.width}
            height={canvasState.height}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{
              touchAction: "none",
              cursor: currentTool === "pan" ? "grab" : "crosshair",
              display: "block",
            }}
            className="bg-black border-2 border-dashed border-primary/30"
          />
        </div>
      </div>

      <SketchToolbar
        currentTool={currentTool}
        setCurrentTool={(tool: Tool) => setCurrentTool(tool)}
        strokeWidth={strokeWidth}
        setStrokeWidth={setStrokeWidth}
        onClear={sketch.clearCanvas}
        currentSketchId={currentSketch.id}
        channelName={channelName}
      />
    </div>
  );
});

SketchBoard.displayName = "SketchBoard";
