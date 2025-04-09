import { useCallback } from "react";
// import { useSketchSync } from "../../hooks/useSketchSync";

type Tool = "draw" | "erase" | "pan";

interface SketchToolbarProps {
  onClear: () => void;
  currentTool: Tool;
  setCurrentTool: (tool: Tool) => void;
  strokeWidth: number;
  setStrokeWidth: (width: number) => void;
}

export const SketchToolbar = ({
  onClear,
  currentTool,
  setCurrentTool,
  strokeWidth,
  setStrokeWidth,
}: SketchToolbarProps) => {
  // handleClear simply calls the provided onClear prop
  const handleClear = useCallback(() => {
    onClear(); // Trigger the clear logic managed by useSketchManager
  }, [onClear]);

  return (
    <div className="flex gap-2 p-3 justify-center border-t border-primary/20 bg-surface-dark/10">
      <button
        onClick={() => setCurrentTool("draw")}
        className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
          currentTool === "draw"
            ? "bg-primary/20 text-primary hover:bg-primary/30"
            : "bg-surface-dark/50 text-text-light/70 hover:bg-red-500/10"
        }`}
      >
        ✏️ Draw
      </button>
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
      <button
        onClick={handleClear}
        className="px-3 py-1.5 rounded-md text-sm bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
      >
        🗑️ Clear
      </button>
    </div>
  );
};
