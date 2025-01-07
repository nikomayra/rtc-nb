import { RegionlessSketch } from "../../types/interfaces";
import helpers from "../../utils/helpers";

interface SketchListProps {
  sketches: RegionlessSketch[];
  onSelect: (sketch: RegionlessSketch) => void;
  onDelete: (id: string) => void;
  toggleDropdown: () => void;
  isOpen: boolean;
}

const SketchList = ({ sketches, onSelect, onDelete, toggleDropdown, isOpen }: SketchListProps) => {
  const handleSelect = (sketch: RegionlessSketch) => {
    onSelect(sketch);
  };

  const handleDelete = (id: string) => {
    onDelete(id);
  };

  return (
    <div className="dropdown">
      <button className="dropdown-toggle" onClick={toggleDropdown}>
        {isOpen ? "▲ Close" : "▼ Open"}
      </button>
      {isOpen && (
        <ul className="dropdown-list">
          {sketches.map((sketch) => (
            <li key={sketch.id} className="dropdown-item">
              <span onClick={() => handleSelect(sketch)}>
                {sketch.displayName} by {sketch.createdBy}: {helpers.formatToHumanReadable(sketch.createdAt)}
              </span>
              <button onClick={() => handleDelete(sketch.id)}>🗑️</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SketchList;
