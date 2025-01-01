import "../../styles/components/sketch.css";

interface SketchToolbarProps {
  setStrokeWidth: React.Dispatch<React.SetStateAction<number>>;
  setDrawing: React.Dispatch<React.SetStateAction<boolean>>;
}

export const SketchToolbar = ({
  setDrawing,
  setStrokeWidth,
}: SketchToolbarProps) => {
  const handleClear = () => {
    // TODO: Implement Clear functionality
    console.log("Clear");
  };

  return (
    <div className="sketch-toolbar">
      <button onClick={() => setDrawing(true)}>Pen🖊️</button>
      <button onClick={() => setDrawing(false)}>Eraser🧹</button>
      <label htmlFor="stroke-width">Stroke Width</label>
      <select
        id="stroke-width"
        onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
        defaultValue={2}
      >
        <option value={1}>1</option>
        <option value={2}>2</option>
        <option value={3}>3</option>
        <option value={4}>4</option>
        <option value={5}>5</option>
      </select>
      <button onClick={handleClear}>Clear🗑️</button>
    </div>
  );
};
