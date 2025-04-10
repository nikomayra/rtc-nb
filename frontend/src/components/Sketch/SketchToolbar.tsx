import { useCallback, useEffect } from "react";
import ColorPickerButton from "./ColorPickerButton";

type Tool = "draw" | "erase" | "pan";

interface SketchToolbarProps {
  onClear: () => void;
  currentTool: Tool;
  setCurrentTool: (tool: Tool) => void;
  strokeWidth: number;
  setStrokeWidth: (width: number) => void;
  currentColor: string;
  setCurrentColor: (color: string) => void;
}

export const SketchToolbar = ({
  onClear,
  currentTool,
  setCurrentTool,
  strokeWidth,
  setStrokeWidth,
  currentColor,
  setCurrentColor,
}: SketchToolbarProps) => {
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("[SketchToolbar] Mounted");
      return () => {
        console.log("[SketchToolbar] Unmounted");
      };
    }
  }, []);

  const handleClear = useCallback(() => {
    onClear();
  }, [onClear]);

  const handleColorChange = useCallback(
    (newColor: string) => {
      setCurrentColor(newColor);
      if (currentTool === "erase") {
        setCurrentTool("draw");
      }
    },
    [currentTool, setCurrentColor, setCurrentTool]
  );

  return (
    <div className="flex gap-2 p-3 justify-center items-center border-t border-primary/20 bg-surface-dark/10">
      {/* Draw Button */}
      <button
        onClick={() => setCurrentTool("draw")}
        className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
          currentTool === "draw"
            ? "bg-primary/20 text-primary hover:bg-primary/30"
            : "bg-surface-dark/50 text-text-light/70 hover:bg-surface-dark/70"
        }`}
      >
        ✏️ Draw
      </button>

      {/* Color Picker Button */}
      <ColorPickerButton currentColor={currentColor} onChangeColor={handleColorChange} />

      {/* Erase Button */}
      <button
        onClick={() => setCurrentTool("erase")}
        className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
          currentTool === "erase"
            ? "bg-primary/20 text-primary hover:bg-primary/30"
            : "bg-surface-dark/50 text-text-light/70 hover:bg-red-500/10"
        }`}
      >
        🧽 Erase
      </button>

      {/* Pan Button */}
      <button
        onClick={() => setCurrentTool("pan")}
        className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
          currentTool === "pan"
            ? "bg-primary/20 text-primary hover:bg-primary/30"
            : "bg-surface-dark/50 text-text-light/70 hover:bg-red-500/10"
        }`}
      >
        👋 Pan
      </button>

      {/* Stroke Width Selector */}
      <select
        value={strokeWidth}
        onChange={(e) => setStrokeWidth(Number(e.target.value))}
        className="px-2 py-1.5 rounded-md text-sm bg-surface-dark/50 text-text-light border border-primary/20"
      >
        {[3, 6, 9, 12, 15, 18, 21, 24, 27, 30].map((width) => (
          <option key={width} value={width}>
            {width}px
          </option>
        ))}
      </select>

      {/* Clear Button */}
      <button
        onClick={handleClear}
        className="px-3 py-1.5 rounded-md text-sm bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
      >
        🗑️ Clear
      </button>
    </div>
  );
};
