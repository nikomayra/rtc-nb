import { useRef, useEffect, useCallback } from "react";
import { type MutableRefObject } from "react";
import { Point, DrawPath } from "../types/interfaces";

interface CanvasState {
  paths: DrawPath[];
  currentPath: DrawPath | null;
}

interface UseCanvasReturn {
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  drawPath: (prevPoint: Point, currentPoint: Point, isDrawing: boolean, strokeWidth: number) => void;
  drawFullPath: (path: DrawPath) => void;
  clear: () => void;
  addPath: (path: DrawPath) => void;
  calculateBounds: (points: Point[]) => { start: Point; end: Point };
  isValidPoint: (point: Point) => boolean;
  getCanvasPoint: (e: React.MouseEvent<HTMLCanvasElement>) => Point | undefined;
  width: number;
  height: number;
}

const useCanvas = (width: number, height: number): UseCanvasReturn => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const stateRef = useRef<CanvasState>({
    paths: [],
    currentPath: null,
  });

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

  const redrawCanvas = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Redraw all paths
    stateRef.current.paths.forEach((path) => {
      path.points.reduce((prev, curr) => {
        if (prev) {
          drawPath(prev, curr, path.isDrawing, path.strokeWidth);
        }
        return curr;
      }, null as Point | null);
    });
  }, [drawPath]);

  // Initialize canvas context
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctxRef.current = ctx;

    // Redraw all paths
    redrawCanvas();
  }, [width, height, redrawCanvas]);

  const drawFullPath = useCallback(
    (path: DrawPath) => {
      const points = path.points;
      for (let i = 1; i < points.length; i++) {
        drawPath(points[i - 1], points[i], path.isDrawing, path.strokeWidth);
      }
    },
    [drawPath]
  );

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stateRef.current.paths = [];
  }, []);

  const addPath = useCallback((path: DrawPath) => {
    stateRef.current.paths.push(path);
  }, []);

  const calculateBounds = useCallback((points: Point[]) => {
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
    addPath,
    calculateBounds,
    isValidPoint,
    getCanvasPoint,
    width,
    height,
  };
};

export default useCanvas;
