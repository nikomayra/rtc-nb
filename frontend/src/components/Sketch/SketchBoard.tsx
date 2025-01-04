import "../../styles/components/sketch.css";
import { useEffect, useRef, useState, useCallback, useContext } from "react";
import { DrawPath, SketchUpdate, MessageType, IncomingMessage } from "../../types/interfaces";
import { WebSocketContext } from "../../contexts/webSocketContext";
import { ChatContext } from "../../contexts/chatContext";

interface SketchBoardProps {
  channelName: string;
  sketchId: string;
  drawing: boolean;
  strokeWidth: number;
}

export const SketchBoard = ({ channelName, sketchId, drawing, strokeWidth }: SketchBoardProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // const containerRef = useRef<HTMLDivElement>(null);
  const [isInteracting, setIsInteracting] = useState(drawing);
  const [currentPath, setCurrentPath] = useState<DrawPath>({
    points: [],
    isDrawing: drawing,
    strokeWidth: strokeWidth,
  });
  const bufferTimeoutRef = useRef<NodeJS.Timeout>();
  const BUFFER_INTERVAL = 100; // ms
  const POINTS_PER_PATH = 50;

  const wsService = useContext(WebSocketContext);
  const chatContext = useContext(ChatContext);
  if (!wsService || !chatContext) throw new Error("WebSocketContext or ChatContext not found");

  const flushBuffer = useCallback(() => {
    if (currentPath.points.length === 0) return;

    const bounds = calculateBounds(currentPath.points);
    const update: SketchUpdate = {
      sketchId,
      region: {
        start: bounds.start,
        end: bounds.end,
        paths: [currentPath],
      },
    };
    try {
      wsService.actions.send({
        channelName,
        type: MessageType.SketchUpdate,
        content: { sketchUpdate: update },
      });
    } catch (error) {
      console.error("Error sending sketch update:", error);
    }

    setCurrentPath((prev) => ({ ...prev, points: [] }));
  }, [wsService, currentPath, sketchId, channelName]);

  useEffect(() => {
    if (currentPath.points.length === 0) return;

    if (bufferTimeoutRef.current) {
      clearTimeout(bufferTimeoutRef.current);
    }

    if (currentPath.points.length >= POINTS_PER_PATH) {
      flushBuffer();
    } else {
      bufferTimeoutRef.current = setTimeout(flushBuffer, BUFFER_INTERVAL);
    }

    return () => {
      if (bufferTimeoutRef.current) {
        clearTimeout(bufferTimeoutRef.current);
      }
    };
  }, [currentPath.points, flushBuffer]);

  // useEffect(() => {
  //   const updateCanvasSize = () => {
  //     if (canvasRef.current && containerRef.current) {
  //       canvasRef.current.width = containerRef.current.clientWidth;
  //       canvasRef.current.height = containerRef.current.clientHeight;
  //     }
  //   };
  //   const resizeObserver = new ResizeObserver(updateCanvasSize);
  //   if (containerRef.current) {
  //     resizeObserver.observe(containerRef.current);
  //   }
  //   updateCanvasSize();
  //   return () => {
  //     resizeObserver.disconnect();
  //   };
  // }, [containerRef]);

  const calculateBounds = (points: { x: number; y: number }[]) => {
    const minX = Math.min(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y));
    const maxX = Math.max(...points.map((p) => p.x));
    const maxY = Math.max(...points.map((p) => p.y));
    return { start: { x: minX, y: minY }, end: { x: maxX, y: maxY } };
  };

  const handleMouseUp = () => {
    flushBuffer();
    setIsInteracting(false);
  };

  const handleMouseDown = () => {
    setIsInteracting(true);
  };

  const handleMouseLeave = () => {
    if (isInteracting) {
      flushBuffer();
      setIsInteracting(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isInteracting) return;

    const point = getCanvasPoint(e);
    if (!point || !isValidPoint(point)) return;

    const prevPoint = currentPath.points[currentPath.points.length - 1];
    drawPath(prevPoint, point, drawing ? "white" : "black", strokeWidth); // Draw/Erase

    setCurrentPath((prev) => ({ ...prev, points: [...prev.points, point] }));

    // Set buffer flush timeout
    if (bufferTimeoutRef.current) {
      clearTimeout(bufferTimeoutRef.current);
    }
    if (currentPath.points.length >= 50) {
      flushBuffer();
    } else {
      bufferTimeoutRef.current = setTimeout(flushBuffer, BUFFER_INTERVAL);
    }
  };

  const isValidPoint = (point: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    return point.x >= 0 && point.y >= 0 && point.x < canvas.width && point.y < canvas.height;
  };

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return { x, y };
  };

  const drawPath = useCallback(
    (
      prevPoint: { x: number; y: number },
      currentPoint: { x: number; y: number },
      color: string,
      strokeWidth: number
    ) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.beginPath();
      ctx.moveTo(prevPoint.x, prevPoint.y);
      ctx.lineTo(currentPoint.x, currentPoint.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    },
    []
  );

  const handleSketchUpdate = useCallback(
    (message: IncomingMessage) => {
      if (message.type !== MessageType.SketchUpdate) return;

      const update = message.content.sketchUpdate as SketchUpdate;
      if (update.sketchId !== sketchId) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      // Draw each path in the update
      update.region.paths.forEach((path) => {
        const points = path.points;
        for (let i = 1; i < points.length; i++) {
          drawPath(points[i - 1], points[i], path.isDrawing ? "white" : "black", path.strokeWidth);
        }
      });
    },
    [sketchId, drawPath]
  );

  useEffect(() => {
    wsService.actions.setMessageHandler(handleSketchUpdate);
    return () => wsService.actions.setMessageHandler(() => {});
  }, [wsService, handleSketchUpdate]);

  return (
    <div className="sketch-board">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      ></canvas>
    </div>
  );
};
