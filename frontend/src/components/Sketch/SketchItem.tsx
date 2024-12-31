import { Sketch } from "../../types/interfaces";

const SketchItem = ({ sketch }: { sketch: Sketch }) => {
  const handleClick = () => {
    console.log(sketch);
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
