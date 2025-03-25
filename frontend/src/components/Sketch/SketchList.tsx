import { useState } from "react";
import { Sketch } from "../../types/interfaces";
import helpers from "../../utils/helpers";
import { Dropdown } from "../Generic/Dropdown";
import { Modal } from "../Generic/Modal";

interface SketchListProps {
  sketches: Sketch[];
  onSelect: (sketch: Sketch) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
}

const SketchList = ({ sketches, onSelect, onDelete, isLoading = false }: SketchListProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmDeleteSketchID, setConfirmDeleteSketchID] = useState<string | null>(null);

  const handleSelect = (sketch: Sketch) => {
    if (!sketch.id || !sketch.channelName) {
      console.error("Invalid sketch data:", sketch);
      return;
    }
    onSelect(sketch);
    setIsOpen(false);
  };

  const handleDelete = () => {
    if (!confirmDeleteSketchID) {
      console.error("No sketch selected for deletion");
      return;
    }
    onDelete(confirmDeleteSketchID);
    setConfirmDeleteSketchID(null);
  };

  const sketchItems = (
    <>
      {isLoading ? (
        <div className="py-2 px-3 text-sm text-text-light/50 text-center">
          <span className="inline-block mr-2">Loading sketches</span>
          <svg className="inline-block w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
      ) : sketches.length === 0 ? (
        <div className="py-2 px-3 text-sm text-text-light/50 text-center">No sketches available</div>
      ) : (
        sketches.map((sketch) => (
          <div
            key={sketch.id}
            className="flex items-center justify-between py-2 px-3 hover:bg-surface-dark/50 rounded-md transition-colors"
          >
            <div className="flex-1 flex-row gap-1 cursor-pointer text-sm truncate" onClick={() => handleSelect(sketch)}>
              <span className="flex font-medium text-text-light truncate">{sketch.displayName}</span>
              <span className="flex text-xs text-text-light/50 truncate">by {sketch.createdBy}</span>
              <span className="flex text-xs text-text-light/50 truncate">
                {helpers.formatToHumanReadable(sketch.createdAt)}
              </span>
            </div>
            <button
              onClick={() => setConfirmDeleteSketchID(sketch.id)}
              className="ml-2 p-1.5 text-text-light/50 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
              aria-label="Delete sketch"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        ))
      )}
    </>
  );

  return (
    <>
      <Dropdown
        trigger={<span>Sketches</span>}
        isOpenExternal={isOpen}
        setIsOpenExternal={setIsOpen}
        className="mr-2"
        menuClassName="w-72"
        position="left"
      >
        {sketchItems}
      </Dropdown>
      <Modal
        isOpen={confirmDeleteSketchID !== null}
        onClose={() => setConfirmDeleteSketchID(null)}
        title="Confirm Sketch Deletion"
      >
        <div className="flex flex-row gap-2 justify-between">
          <button
            className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors"
            onClick={handleDelete}
          >
            Delete
          </button>
          <button
            className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors"
            onClick={() => setConfirmDeleteSketchID(null)}
          >
            Cancel
          </button>
        </div>
      </Modal>
    </>
  );
};

export default SketchList;
