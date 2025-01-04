import "../../styles/components/sketch.css";

interface SketchToolbarProps {
  setStrokeWidth: React.Dispatch<React.SetStateAction<number>>;
  setDrawing: React.Dispatch<React.SetStateAction<boolean>>;
}

export const SketchToolbar = ({ setDrawing, setStrokeWidth }: SketchToolbarProps) => {
  const handleClear = () => {
    // TODO: Implement Clear functionality
    console.log("Clear");
  };

  const handlePen = () => {
    console.log("Pen");
    setDrawing(true);
  };

  const handleEraser = () => {
    console.log("Eraser");
    setDrawing(false);
  };

  return (
    <div className="sketch-toolbar">
      <button onClick={handlePen}>Pen🖊️</button>
      <button onClick={handleEraser}>Eraser🧹</button>
      <label htmlFor="stroke-width">Stroke Width</label>
      <select id="stroke-width" onChange={(e) => setStrokeWidth(parseInt(e.target.value))} defaultValue={2}>
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
