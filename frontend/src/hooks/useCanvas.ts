import { useRef, useEffect, useCallback } from "react";
import { Point, DrawPath } from "../types/interfaces";

export function useCanvas(width: number, height: number) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Initialize context
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    ctxRef.current = canvas.getContext("2d");
  }, [width, height]);

  const drawPath = useCallback((prevPoint: Point, currentPoint: Point, isDrawing: boolean, strokeWidth: number) => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(prevPoint.x, prevPoint.y);
    ctx.lineTo(currentPoint.x, currentPoint.y);
    ctx.strokeStyle = isDrawing ? "white" : "black";
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }, []);

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
    ctx.clearRect(0, 0, width, height);
  }, [width, height]);

  const calculateBounds = (points: Point[]) => {
    const minX = Math.min(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y));
    const maxX = Math.max(...points.map((p) => p.x));
    const maxY = Math.max(...points.map((p) => p.y));
    return { start: { x: minX, y: minY }, end: { x: maxX, y: maxY } };
  };

  const isValidPoint = useCallback((point: Point) => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    return point.x >= 0 && point.y >= 0 && point.x < canvas.width && point.y < canvas.height;
  }, []);

  const getCanvasPoint = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ~~(e.clientX - rect.left);
    const y = ~~(e.clientY - rect.top);
    return { x, y };
  }, []);

  return {
    canvasRef,
    drawPath,
    drawFullPath,
    clear,
    calculateBounds,
    isValidPoint,
    getCanvasPoint,
  };
}
