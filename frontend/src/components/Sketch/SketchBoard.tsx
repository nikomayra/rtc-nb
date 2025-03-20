import { useState, useCallback, memo, useContext, useRef } from "react";
import { Point } from "../../types/interfaces";
import { SketchContext } from "../../contexts/sketchContext";
import { useSketch } from "../../hooks/useSketch";

interface SketchBoardProps {
  channelName: string;
}

type Tool = "draw" | "erase" | "pan";

export const SketchBoard = memo(({ channelName }: SketchBoardProps) => {
  const [currentTool, setCurrentTool] = useState<Tool>("draw");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [isInteracting, setIsInteracting] = useState(false);
  const [panStart, setPanStart] = useState<Point | null>(null);

  // Reference to the scroll container for panning
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const sketchContext = useContext(SketchContext);
  if (!sketchContext) throw new Error("Context missing");

  // Use our new useSketch hook
  const sketch = useSketch({
    channelName,
    currentSketch: sketchContext.state.currentSketch,
  });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!sketch.canvasRef.current) return;

      console.log(`👇 [SketchBoard] Tool: ${currentTool}`);
      setIsInteracting(true);

      if (currentTool === "pan") {
        setPanStart({ x: e.clientX, y: e.clientY });
        // Change cursor to "grabbing" when panning
        e.currentTarget.style.cursor = "grabbing";
        return;
      }

      const point = sketch.getCanvasPoint(e);
      if (!point || !sketch.isValidPoint(point)) {
        console.warn("Invalid point detected");
        return;
      }

      sketch.startPath(point, currentTool === "draw", strokeWidth);
    },
    [sketch, currentTool, strokeWidth]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isInteracting) return;

      if (currentTool === "pan" && panStart) {
        const container = scrollContainerRef.current;
        if (!container) return;

        // Calculate the distance moved since last position
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;

        // Update scroll position (subtract because scroll direction is opposite to drag)
        container.scrollLeft -= dx;
        container.scrollTop -= dy;

        // Update the pan start position for next move event
        setPanStart({ x: e.clientX, y: e.clientY });
        return;
      }

      const point = sketch.getCanvasPoint(e);
      if (!point || !sketch.isValidPoint(point)) return;

      sketch.continuePath(point);
    },
    [isInteracting, currentTool, panStart, sketch]
  );

  const handleMouseUp = useCallback(() => {
    if (!isInteracting) return;

    if (currentTool === "pan") {
      // Reset cursor back to grab when done panning
      if (sketch.canvasRef.current) {
        sketch.canvasRef.current.style.cursor = "grab";
      }
    } else {
      sketch.completePath();
    }

    setIsInteracting(false);
    setPanStart(null);
  }, [isInteracting, currentTool, sketch]);

  return (
    <div className="flex w-full flex-col h-full">
      <div className="text-center py-3 border-b border-primary/20">
        <h2 className="font-medium text-text-light">{sketchContext.state.currentSketch?.displayName}</h2>
      </div>
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto bg-surface-dark/30 min-h-[300px] scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-surface-dark 
          scrollbar-hover:scrollbar-thumb-primary/30"
      >
        <div className="min-w-min">
          <canvas
            ref={sketch.canvasRef}
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
      <div className="flex gap-2 p-3 justify-center border-t border-primary/20 bg-surface-dark/10">
        <button
          onClick={() => setCurrentTool("draw")}
          disabled={isInteracting}
          className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
            currentTool === "draw"
              ? "bg-primary/20 text-primary hover:bg-primary/30"
              : "bg-surface-dark/50 text-text-light/70 hover:bg-red-500/10"
          }`}
        >
          ✏️ Draw
        </button>
        <button
          onClick={() => setCurrentTool("erase")}
          disabled={isInteracting}
          className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
            currentTool === "erase"
              ? "bg-primary/20 text-primary hover:bg-primary/30"
              : "bg-surface-dark/50 text-text-light/70 hover:bg-red-500/10"
          }`}
        >
          🧽 Erase
        </button>
        <button
          onClick={() => setCurrentTool("pan")}
          disabled={isInteracting}
          className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
            currentTool === "pan"
              ? "bg-primary/20 text-primary hover:bg-primary/30"
              : "bg-surface-dark/50 text-text-light/70 hover:bg-red-500/10"
          }`}
        >
          👋 Pan
        </button>
        <select
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          disabled={isInteracting}
          className="px-2 py-1.5 rounded-md text-sm bg-surface-dark/50 text-text-light border border-primary/20"
        >
          {[3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45].map((width) => (
            <option key={width} value={width}>
              {width}px
            </option>
          ))}
        </select>
        <button
          onClick={sketch.clear}
          disabled={isInteracting}
          className="px-3 py-1.5 rounded-md text-sm bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
        >
          🗑️ Clear
        </button>
      </div>
    </div>
  );
});

SketchBoard.displayName = "SketchBoard";
