import { Sketch } from "../../types/interfaces";

interface SketchItemProps {
  sketch: Sketch;
  onSelect: (sketch: Sketch) => void;
}

const SketchItem = ({ sketch, onSelect }: SketchItemProps) => {
  const handleClick = () => {
    onSelect(sketch);
  };

  return (
    <option className="sketch-item" value={sketch.id}>
      <button onClick={handleClick}>
        {sketch.displayName} @ {sketch.createdAt} by {sketch.createdBy}
      </button>
    </option>
  );
};

export default SketchItem;
