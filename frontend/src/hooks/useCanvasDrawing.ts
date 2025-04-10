import { useRef, useCallback, useState } from "react";
import { type MutableRefObject } from "react";
import { Point, DrawPath } from "../types/interfaces";

interface CanvasState {
  width: number;
  height: number;
  ctx: CanvasRenderingContext2D | null;
}

interface UseCanvasDrawingReturn {
  // Canvas ref and state
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  canvasState: CanvasState;
  initializeCanvas: (width: number, height: number) => void;

  // Drawing methods
  drawLine: (start: Point, end: Point, isDrawing: boolean, strokeWidth: number, color: string) => void;
  drawPath: (path: DrawPath) => void;
  clear: () => void;
  redrawCanvas: (paths: DrawPath[]) => void;

  // Utility methods
  calculateBounds: (points: Point[]) => { start: Point; end: Point };
  isValidPoint: (point: Point) => boolean;
  getCanvasPoint: (e: React.MouseEvent<HTMLCanvasElement>) => Point | undefined;
}

/**
 * Hook that handles canvas drawing operations
 * Focused on pure canvas manipulation without state management
 */
const useCanvasDrawing = (): UseCanvasDrawingReturn => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Initialize or reinitialize canvas with new dimensions
  const initializeCanvas = useCallback(
    (width: number, height: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Skip if dimensions haven't changed
      if (dimensions.width === width && dimensions.height === height) {
        return;
      }

      // Set dimensions on the canvas element
      canvas.width = width;
      canvas.height = height;

      // Get and configure context, store in ref
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.clearRect(0, 0, width, height);
        ctxRef.current = ctx;
      }

      // Update state to trigger re-render in consumers
      setDimensions({ width, height });
    },
    [dimensions.width, dimensions.height]
  );

  // Clear the canvas
  const clear = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    // Read dimensions from state
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);
  }, [dimensions.width, dimensions.height]);

  // Draw a single line segment
  const drawLine = useCallback((start: Point, end: Point, isDrawing: boolean, strokeWidth: number, color: string) => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    // Use path.color if drawing, default/ignored if erasing
    ctx.strokeStyle = isDrawing ? color : "#000000"; // Color parameter added
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }, []);

  // Draw a complete path with multiple points
  const drawPath = useCallback((path: DrawPath) => {
    const ctx = ctxRef.current;
    if (!ctx || !path.points || path.points.length === 0) return;

    // Set style and width for the entire path
    // Use the path's color if drawing. Erase color is irrelevant due to destination-out.
    ctx.strokeStyle = path.isDrawing ? path.color : "#000000";
    ctx.lineWidth = path.strokeWidth;
    // Ensure line cap and join styles are applied for this path
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();

    // Move to the first point
    ctx.moveTo(path.points[0].x, path.points[0].y);

    // Draw lines to subsequent points
    for (let i = 1; i < path.points.length; i++) {
      ctx.lineTo(path.points[i].x, path.points[i].y);
    }

    // Stroke the complete path
    // Use non-zero winding rule for fill if needed later
    // Check if it's just a single point (dot)
    if (path.points.length === 1) {
      // Draw a small circle or square for a single point
      // Using arc for a circle
      ctx.fillStyle = ctx.strokeStyle;
      ctx.arc(path.points[0].x, path.points[0].y, path.strokeWidth / 2, 0, 2 * Math.PI);
      ctx.fill();
    } else {
      // Stroke the path for lines with 2+ points
      ctx.stroke();
    }
  }, []);

  // Redraw all paths on the canvas
  const redrawCanvas = useCallback(
    (paths: DrawPath[]) => {
      const ctx = ctxRef.current;
      if (!ctx) return;

      paths.forEach((path) => {
        if (path.points.length < 2) return;
        drawPath(path);
      });
    },
    [drawPath]
  );

  // Calculate the bounding box of a set of points
  const calculateBounds = useCallback((points: Point[]) => {
    if (points.length === 0) {
      return { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } };
    }

    const xValues = points.map((p) => p.x);
    const yValues = points.map((p) => p.y);

    return {
      start: { x: Math.min(...xValues), y: Math.min(...yValues) },
      end: { x: Math.max(...xValues), y: Math.max(...yValues) },
    };
  }, []);

  // Check if a point is within canvas bounds
  const isValidPoint = useCallback(
    (point: Point) => {
      // Read dimensions from state
      return point.x >= 0 && point.y >= 0 && point.x < dimensions.width && point.y < dimensions.height;
    },
    [dimensions.width, dimensions.height]
  );

  // Convert mouse event coordinates to canvas coordinates
  const getCanvasPoint = useCallback((e: React.MouseEvent<HTMLCanvasElement>): Point | undefined => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.floor(e.clientX - rect.left),
      y: Math.floor(e.clientY - rect.top),
    };
  }, []);

  return {
    canvasRef,
    canvasState: { ...dimensions, ctx: ctxRef.current },
    initializeCanvas,
    drawLine,
    drawPath,
    clear,
    redrawCanvas,
    calculateBounds,
    isValidPoint,
    getCanvasPoint,
  };
};

export default useCanvasDrawing;
