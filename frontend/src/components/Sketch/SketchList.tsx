import { Sketch } from "../../types/interfaces";
import helpers from "../../utils/helpers";

interface SketchListProps {
  sketches: Sketch[];
  onSelect: (sketch: Sketch) => void;
  onDelete: (id: string) => void;
  toggleDropdown: () => void;
  isOpen: boolean;
}

const SketchList = ({ sketches, onSelect, onDelete, toggleDropdown, isOpen }: SketchListProps) => {
  const handleSelect = (sketch: Sketch) => {
    if (!sketch.id || !sketch.channelName) {
      console.error("Invalid sketch data:", sketch);
      return;
    }
    onSelect(sketch);
  };

  const handleDelete = (id: string) => {
    if (!id) {
      console.error("Invalid sketch ID for deletion");
      return;
    }
    // Prevent accidental double-clicks
    const confirmDelete = window.confirm("Are you sure you want to delete this sketch?");
    if (confirmDelete) {
      onDelete(id);
    }
  };

  return (
    <div className="dropdown">
      <button onClick={toggleDropdown}>{isOpen ? "▲ Close" : "▼ Open"}</button>
      {isOpen && (
        <ul>
          {sketches.length === 0 ? (
            <li>No sketches available</li>
          ) : (
            sketches.map((sketch) => (
              <li key={sketch.id}>
                <span onClick={() => handleSelect(sketch)}>
                  {sketch.displayName} by {sketch.createdBy}: {helpers.formatToHumanReadable(sketch.createdAt)}
                </span>
                <button onClick={() => handleDelete(sketch.id)}>🗑️</button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default SketchList;
