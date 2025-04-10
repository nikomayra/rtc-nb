import { useState, useCallback, memo, useRef } from "react";
import { Point } from "../../types/interfaces";
import { useSketchManager } from "../../hooks/useSketchManager";
import { SketchToolbar } from "./SketchToolbar";

// Define tools for the board
type Tool = "draw" | "erase" | "pan";

interface SketchBoardProps {
  channelName: string;
}

export const SketchBoard = memo(({ channelName }: SketchBoardProps) => {
  // Local state for UI interactions (tool, stroke, pan)
  const [currentTool, setCurrentTool] = useState<Tool>("draw");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [isInteracting, setIsInteracting] = useState(false);
  const [panStart, setPanStart] = useState<Point | null>(null);

  // Reference to the scroll container for panning
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Use the new sketch manager hook
  const sketchManager = useSketchManager({ channelName });
  // Destructure necessary values and methods
  const {
    canvasRef,
    canvasState,
    currentSketch,
    getCanvasPoint,
    isValidPoint,
    handleMouseDown: managerMouseDown,
    handleMouseMove: managerMouseMove,
    handleMouseUp: managerMouseUp,
    clearLocalAndRemote,
  } = sketchManager;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!canvasRef.current || !currentSketch) return;

      setIsInteracting(true);

      if (currentTool === "pan") {
        setPanStart({ x: e.clientX, y: e.clientY });
        e.currentTarget.style.cursor = "grabbing";
        return;
      }

      // Handle drawing/erasing start
      const point = getCanvasPoint(e);
      if (!point || !isValidPoint(point)) {
        console.warn("[SketchBoard] Invalid start point detected");
        setIsInteracting(false);
        return;
      }

      managerMouseDown(point, currentTool === "draw", strokeWidth);
    },
    [canvasRef, currentSketch, currentTool, getCanvasPoint, isValidPoint, managerMouseDown, strokeWidth]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isInteracting || !currentSketch) return;

      // Handle panning movement
      if (currentTool === "pan" && panStart) {
        const container = scrollContainerRef.current;
        if (!container) return;
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        container.scrollLeft -= dx;
        container.scrollTop -= dy;
        setPanStart({ x: e.clientX, y: e.clientY });
        return;
      }

      // Handle drawing/erasing movement
      if (currentTool === "draw" || currentTool === "erase") {
        const point = getCanvasPoint(e);
        if (!point) return;

        managerMouseMove(point);
      }
    },
    [isInteracting, currentSketch, currentTool, panStart, getCanvasPoint, managerMouseMove]
  );

  const handleMouseUp = useCallback(() => {
    if (!isInteracting) return;

    // Finish panning
    if (currentTool === "pan") {
      if (canvasRef.current) {
        canvasRef.current.style.cursor = "grab";
      }
    } else if (currentTool === "draw" || currentTool === "erase") {
      managerMouseUp();
    }

    // Reset interaction state
    setIsInteracting(false);
    setPanStart(null);
  }, [isInteracting, currentTool, canvasRef, managerMouseUp]);

  const handleMouseLeave = useCallback(() => {
    // If the user was actively drawing/panning and leaves the canvas, treat it as mouse up
    if (isInteracting) {
      console.log("[SketchBoard] Mouse left canvas during interaction, treating as mouse up.");
      managerMouseUp();
      // Also reset local interaction state
      setIsInteracting(false);
      setPanStart(null);
      if (currentTool === "pan" && canvasRef.current) {
        canvasRef.current.style.cursor = "grab";
      }
    }
  }, [isInteracting, managerMouseUp, currentTool, canvasRef]);

  if (!currentSketch) {
    return (
      <div className="flex w-full flex-col h-full items-center justify-center text-text-light/50">
        Please select or create a sketch to start drawing.
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col h-full">
      {/* Header with Sketch Name */}
      <div className="text-center py-3 border-b border-primary/20">
        <h2 className="font-medium text-text-light">{currentSketch.displayName}</h2>
      </div>

      {/* Scrollable Canvas Container */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto bg-surface-dark/30 min-h-[300px] scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-surface-dark
          scrollbar-hover:scrollbar-thumb-primary/30"
      >
        <div className="min-w-min">
          {" "}
          {/* Ensures container respects canvas size */}
          <canvas
            ref={canvasRef as React.RefObject<HTMLCanvasElement>}
            width={canvasState.width}
            height={canvasState.height}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            style={{
              touchAction: "none",
              cursor: currentTool === "pan" ? "grab" : "crosshair",
              display: "block",
            }}
            className="bg-neutral-500 border-2 border-dashed border-primary/30"
          />
        </div>
      </div>

      {/* Toolbar */}
      <SketchToolbar
        currentTool={currentTool}
        setCurrentTool={setCurrentTool}
        strokeWidth={strokeWidth}
        setStrokeWidth={setStrokeWidth}
        onClear={clearLocalAndRemote}
      />
    </div>
  );
});

SketchBoard.displayName = "SketchBoard";
