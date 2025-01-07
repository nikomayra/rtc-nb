import "../../styles/components/sketch.css";
import { useEffect, useRef, useState, useCallback, useContext } from "react";
import { DrawPath, SketchUpdate, MessageType, IncomingMessage, Sketch } from "../../types/interfaces";
import { WebSocketContext } from "../../contexts/webSocketContext";
import { ChatContext } from "../../contexts/chatContext";

interface SketchBoardProps {
  channelName: string;
  currentSketch: Sketch;
  drawing: boolean;
  strokeWidth: number;
}

export const SketchBoard = ({ channelName, currentSketch, drawing, strokeWidth }: SketchBoardProps) => {
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
      sketchId: currentSketch.id,
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
  }, [wsService, currentPath, currentSketch, channelName]);

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
    const minX = ~~Math.min(...points.map((p) => p.x)); // Fast bitwise truncation
    const minY = ~~Math.min(...points.map((p) => p.y));
    const maxX = ~~Math.max(...points.map((p) => p.x));
    const maxY = ~~Math.max(...points.map((p) => p.y));
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
    if (prevPoint) {
      drawPath(prevPoint, point, drawing ? "white" : "black", strokeWidth); // Draw/Erase
    }

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
    const x = ~~(e.clientX - rect.left); // Fast bitwise truncation
    const y = ~~(e.clientY - rect.top);
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
      if (update.sketchId !== currentSketch.id) return;

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
    [currentSketch, drawPath]
  );

  useEffect(() => {
    wsService.actions.setMessageHandler(handleSketchUpdate);
    return () => wsService.actions.setMessageHandler(() => {});
  }, [wsService, handleSketchUpdate]);

  // Init on-load draw sketch from database
  const loadCurrentSketch = useCallback(() => {
    console.log("Drawing selected sketch...");
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear the canvas before drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Iterate through the regions
    Object.keys(currentSketch.regions).forEach((regionKey) => {
      const region = currentSketch.regions[regionKey];

      // Iterate through each path in the region
      region.paths.forEach((path) => {
        const points = path.points;

        // Draw each segment of the path
        for (let i = 1; i < points.length; i++) {
          drawPath(points[i - 1], points[i], path.isDrawing ? "white" : "black", path.strokeWidth);
        }
      });
    });
  }, [currentSketch.regions, drawPath]);

  // Load when currentSketch changes
  useEffect(() => {
    loadCurrentSketch();
  }, [currentSketch, loadCurrentSketch]);

  return (
    <div className="sketch-board">
      <canvas
        ref={canvasRef}
        width={currentSketch.width}
        height={currentSketch.height}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      ></canvas>
    </div>
  );
};
