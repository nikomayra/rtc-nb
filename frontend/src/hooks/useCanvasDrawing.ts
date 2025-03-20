import { useRef, useEffect, useCallback } from "react";
import { type MutableRefObject } from "react";
import { Point, DrawPath } from "../types/interfaces";

interface UseCanvasDrawingReturn {
  // Canvas ref and dimensions
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  width: number;
  height: number;

  // Drawing methods
  drawPath: (prevPoint: Point, currentPoint: Point, isDrawing: boolean, strokeWidth: number) => void;
  drawFullPath: (path: DrawPath) => void;
  clear: () => void;
  redrawCanvas: (paths: DrawPath[]) => void;

  // Utility methods
  calculateBounds: (points: Point[]) => { start: Point; end: Point };
  isValidPoint: (point: Point) => boolean;
  getCanvasPoint: (e: React.MouseEvent<HTMLCanvasElement>) => Point | undefined;
}

/**
 * Hook that handles all canvas drawing operations
 * This hook is concerned only with rendering to the canvas
 * and doesn't maintain state about the paths
 */
const useCanvasDrawing = (width: number, height: number): UseCanvasDrawingReturn => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const drawPath = useCallback((prevPoint: Point, currentPoint: Point, isDrawing: boolean, strokeWidth: number) => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(prevPoint.x, prevPoint.y);
    ctx.lineTo(currentPoint.x, currentPoint.y);
    ctx.strokeStyle = isDrawing ? "white" : "black";
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }, []);

  const drawFullPath = useCallback(
    (path: DrawPath) => {
      console.log(`🖌️ [useCanvasDrawing] Drawing path of points`);

      const points = path.points;
      // Need at least 2 points to draw
      if (points.length < 2) return;

      for (let i = 1; i < points.length; i++) {
        drawPath(points[i - 1], points[i], path.isDrawing, path.strokeWidth);
      }
    },
    [drawPath]
  );

  const redrawCanvas = useCallback(
    (paths: DrawPath[]) => {
      const ctx = ctxRef.current;
      const canvas = canvasRef.current;
      if (!ctx || !canvas) return;

      console.log(`🔄 [useCanvasDrawing] Redrawing ${paths.length} paths`);

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Redraw all paths
      paths.forEach((path) => {
        if (path.points.length < 2) return;

        drawFullPath(path);
      });
    },
    [drawFullPath]
  );

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    console.log(`🧹 [useCanvasDrawing] Clearing canvas`);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Initialize canvas context
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    console.log(`🖼️ [useCanvasDrawing] Initializing canvas (${width}x${height})`);
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctxRef.current = ctx;
  }, [width, height]);

  const calculateBounds = useCallback((points: Point[]) => {
    if (points.length === 0) {
      return { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } };
    }

    const minX = Math.min(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y));
    const maxX = Math.max(...points.map((p) => p.x));
    const maxY = Math.max(...points.map((p) => p.y));

    return {
      start: { x: minX, y: minY },
      end: { x: maxX, y: maxY },
    };
  }, []);

  const isValidPoint = useCallback((point: Point) => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    return point.x >= 0 && point.y >= 0 && point.x < canvas.width && point.y < canvas.height;
  }, []);

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
    drawPath,
    drawFullPath,
    clear,
    redrawCanvas,
    calculateBounds,
    isValidPoint,
    getCanvasPoint,
    width,
    height,
  };
};

export default useCanvasDrawing;
