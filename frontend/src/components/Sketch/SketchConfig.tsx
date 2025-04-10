import { useState } from "react";
import { Sketch } from "../../types/interfaces";
import SketchList from "./SketchList";
import { Modal } from "../Generic/Modal";
import { useNotification } from "../../hooks/useNotification";
import { useSketchContext } from "../../hooks/useSketchContext";

interface SketchConfigProps {
  channelName: string;
}

const MIN_SKETCH_DIMENSION = 100;
const MAX_SKETCH_WIDTH = 1280;
const MAX_SKETCH_HEIGHT = 720;

export const SketchConfig = ({ channelName }: SketchConfigProps) => {
  const [displayName, setDisplayName] = useState("");
  const [width, setWidth] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);

  const sketchContext = useSketchContext();
  const { showError } = useNotification();

  const { state: sketchState, actions: sketchActions } = sketchContext;

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || /^\d+$/.test(value)) {
      setWidth(value);
    }
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || /^\d+$/.test(value)) {
      setHeight(value);
    }
  };

  const validateSketchDimensions = (width: string, height: string): string | null => {
    const numWidth = parseInt(width);
    const numHeight = parseInt(height);

    if (!width || !height || isNaN(numWidth) || isNaN(numHeight)) {
      return "Width and height are required";
    }
    if (numWidth < MIN_SKETCH_DIMENSION || numHeight < MIN_SKETCH_DIMENSION) {
      return `Minimum dimension is ${MIN_SKETCH_DIMENSION}px`;
    }
    if (numWidth > MAX_SKETCH_WIDTH || numHeight > MAX_SKETCH_HEIGHT) {
      return `Maximum dimensions are ${MAX_SKETCH_WIDTH}x${MAX_SKETCH_HEIGHT}`;
    }
    return null;
  };

  const handleCreateSketch = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validateSketchDimensions(width, height);
    if (error) {
      showError(error);
      return;
    }

    setIsOpen(false);
    try {
      await sketchActions.createSketch(channelName, displayName, parseInt(width), parseInt(height));

      // Reset form fields
      setDisplayName("");
      setWidth("");
      setHeight("");
    } catch (error) {
      // Error handling is done in the context
      console.error("Failed to create sketch:", error);
    }
  };

  const handleSelectSketch = async (sketch: Sketch) => {
    // Check if the selected sketch is already the current one
    if (sketch.id === sketchState.currentSketch?.id) {
      if (import.meta.env.DEV) console.log(`[SketchConfig] Sketch ${sketch.id} is already selected. Skipping load.`);
      return; // Don't reload if it's already the current sketch
    }

    try {
      if (import.meta.env.DEV) console.log(`[SketchConfig] Selecting sketch ${sketch.id}`);
      await sketchActions.loadSketch(channelName, sketch.id);
    } catch (error) {
      // Error handling is done in the context
      console.error("Failed to load sketch:", error);
    }
  };

  const handleDeleteSketch = async (id: string) => {
    try {
      await sketchActions.deleteSketch(id);
    } catch (error) {
      // Error handling is done in the context
      console.error("Failed to delete sketch:", error);
    }
  };

  return (
    <div className="flex items-center justify-between p-4 border-b border-primary/20">
      <div className="flex items-center">
        <SketchList
          sketches={sketchState.sketches
            .slice()
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())}
          onSelect={handleSelectSketch}
          onDelete={handleDeleteSketch}
          isLoading={sketchState.isLoading}
        />
        <button
          onClick={() => setIsOpen(true)}
          className="px-3 py-1 rounded-md text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          + New Sketch
        </button>
      </div>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Create Sketch">
        <form onSubmit={handleCreateSketch} className="space-y-4">
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-text-light mb-1">
              Display Name
            </label>
            <input
              type="text"
              id="displayName"
              placeholder="My Sketch"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full p-2 bg-surface-dark text-text-light rounded-md border border-primary/20 focus:border-primary focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="width" className="block text-sm font-medium text-text-light mb-1">
                Width (px)
              </label>
              <input
                type="text"
                id="width"
                value={width}
                onChange={handleWidthChange}
                placeholder={`${MIN_SKETCH_DIMENSION}-${MAX_SKETCH_WIDTH}`}
                pattern="\d*"
                className="w-full p-2 bg-surface-dark text-text-light rounded-md border border-primary/20 focus:border-primary focus:outline-none"
                required
              />
            </div>
            <div>
              <label htmlFor="height" className="block text-sm font-medium text-text-light mb-1">
                Height (px)
              </label>
              <input
                type="text"
                id="height"
                value={height}
                onChange={handleHeightChange}
                placeholder={`${MIN_SKETCH_DIMENSION}-${MAX_SKETCH_HEIGHT}`}
                pattern="\d*"
                className="w-full p-2 bg-surface-dark text-text-light rounded-md border border-primary/20 focus:border-primary focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 rounded-md text-sm bg-surface-dark text-text-light hover:bg-surface-dark/70 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-md text-sm bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
