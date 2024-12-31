import "../../styles/components/sketch.css";
import { useEffect, useRef, useState } from "react";

interface SketchBoardProps {
  drawing: boolean;
  erasing: boolean;
}

export const SketchBoard = ({ drawing, erasing }: SketchBoardProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInteracting, setIsInteracting] = useState(drawing || erasing);
  const [prevPos, setPrevPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const updateCanvasSize = () => {
      if (canvasRef.current && containerRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = containerRef.current.clientHeight;
      }
    };
    const resizeObserver = new ResizeObserver(updateCanvasSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    updateCanvasSize();
    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef]);

  const handleMouseDown = () => {
    // console.log("Mouse down");
    setIsInteracting(true);
  };

  const handleMouseUp = () => {
    // console.log("Mouse up");
    setIsInteracting(false);
    setPrevPos({ x: 0, y: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (drawing && isInteracting) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const ctx = canvas.getContext("2d");
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (ctx) {
        // console.log("Drawing at:", e.clientX, e.clientY);
        ctx.beginPath();
        if (prevPos.x !== 0 && prevPos.y !== 0) {
          ctx.moveTo(prevPos.x, prevPos.y);
        } else {
          ctx.moveTo(x, y);
        }
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        setPrevPos({ x, y });
      }
    }
    if (erasing && isInteracting) {
      //TBD
    }
  };

  return (
    <div className="sketch-board" ref={containerRef}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      ></canvas>
    </div>
  );
};
