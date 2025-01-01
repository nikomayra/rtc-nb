import "../../styles/components/sketch.css";
import { Sketch } from "../../types/interfaces";
import SketchItem from "./SketchItem";

interface SketchConfigProps {
  sketches: Sketch[];
  setCurrentSketch: React.Dispatch<React.SetStateAction<Sketch | null>>;
}

export const SketchConfig = ({
  sketches,
  setCurrentSketch,
}: SketchConfigProps) => {
  const handleCreateSketch = () => {
    console.log("Create Sketch");
  };

  const handleSelectSketch = (sketch: Sketch) => {
    setCurrentSketch(sketch);
  };

  const handleDeleteSketch = () => {
    // TODO: Delete sketch
    console.log("Delete Sketch");
  };

  return (
    <div className="sketch-config">
      <label htmlFor="sketch-select">Select a sketch:</label>
      <select
        name="sketch-select"
        id="sketch-select"
        defaultValue={sketches[0].id ?? "Sketches..."}
      >
        {sketches.map((sketch) => (
          <SketchItem
            key={sketch.id}
            sketch={sketch}
            onSelect={handleSelectSketch}
          />
        ))}
      </select>
      <button onClick={handleCreateSketch}>Create Sketch</button>
      <button onClick={handleDeleteSketch}>Delete Sketch</button>
    </div>
  );
};
