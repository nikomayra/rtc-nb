import "../../styles/components/sketch.css";
import { Sketch } from "../../types/interfaces";
import SketchItem from "./SketchItem";

interface SketchConfigProps {
  sketches: Sketch[];
}

export const SketchConfig = ({ sketches }: SketchConfigProps) => {
  const handleCreateSketch = () => {
    console.log("Create Sketch");
  };

  return (
    <div className="sketch-config">
      <label htmlFor="sketch-select">Select a sketch:</label>
      <select name="sketch-select" id="sketch-select">
        {sketches.map((sketch) => (
          <SketchItem key={sketch.id} sketch={sketch} />
        ))}
      </select>
      <button onClick={handleCreateSketch}>Create Sketch</button>
    </div>
  );
};
