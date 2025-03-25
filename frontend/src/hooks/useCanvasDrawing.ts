import { useRef, useCallback } from "react";
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
  drawLine: (start: Point, end: Point, isDrawing: boolean, strokeWidth: number) => void;
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
  const stateRef = useRef<CanvasState>({
    width: 0,
    height: 0,
    ctx: null,
  });

  // Initialize or reinitialize canvas with new dimensions
  const initializeCanvas = useCallback((width: number, height: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Skip if dimensions haven't changed
    if (stateRef.current.width === width && stateRef.current.height === height) {
      return;
    }

    // Set dimensions
    canvas.width = width;
    canvas.height = height;

    // Get and configure context
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.clearRect(0, 0, width, height);

      // Update state atomically
      stateRef.current = {
        width,
        height,
        ctx,
      };
    }
  }, []);

  // Clear the canvas
  const clear = useCallback(() => {
    const { ctx, width, height } = stateRef.current;
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
  }, []);

  // Draw a single line segment
  const drawLine = useCallback((start: Point, end: Point, isDrawing: boolean, strokeWidth: number) => {
    const { ctx } = stateRef.current;
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = isDrawing ? "#ffffff" : "#000000";
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }, []);

  // Draw a complete path with multiple points
  const drawPath = useCallback(
    (path: DrawPath) => {
      const { ctx } = stateRef.current;
      if (!ctx || !path.points || path.points.length < 2) return;

      // Draw all line segments in a single path for better performance
      const points = path.points;
      for (let i = 1; i < points.length; i++) {
        drawLine(points[i - 1], points[i], path.isDrawing, path.strokeWidth);
      }
    },
    [drawLine]
  );

  // Redraw all paths on the canvas
  const redrawCanvas = useCallback(
    (paths: DrawPath[]) => {
      if (!paths.length) {
        clear();
        return;
      }

      clear();

      paths.forEach((path) => {
        if (path.points.length < 2) return;
        drawPath(path);
      });
    },
    [clear, drawPath]
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
  const isValidPoint = useCallback((point: Point) => {
    const { width, height } = stateRef.current;
    return point.x >= 0 && point.y >= 0 && point.x < width && point.y < height;
  }, []);

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
    canvasState: stateRef.current,
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
