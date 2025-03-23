import { Sketch, SketchSchema, MessageType, SketchCommandType } from "../../types/interfaces";
import SketchList from "./SketchList";
import { axiosInstance, isAxiosError } from "../../api/axiosInstance";
import { BASE_URL } from "../../utils/constants";
import { useContext, useState } from "react";
import { z } from "zod";
import { Modal } from "../Generic/Modal";
import { SketchContext } from "../../contexts/sketchContext";
import { WebSocketContext } from "../../contexts/webSocketContext";
import { useNotification } from "../../hooks/useNotification";

interface SketchConfigProps {
  channelName: string;
  token: string;
}

const MIN_SKETCH_DIMENSION = 100;
const MAX_SKETCH_WIDTH = 1280;
const MAX_SKETCH_HEIGHT = 720;

export const SketchConfig = ({ channelName, token }: SketchConfigProps) => {
  //  ChannelName string `json:"channelName"`
  // 	DisplayName string `json:"displayName"`
  // 	Width       int    `json:"width"`
  // 	Height      int    `json:"height"`

  const [displayName, setDisplayName] = useState("");
  const [width, setWidth] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);

  const sketchContext = useContext(SketchContext);
  const wsService = useContext(WebSocketContext);
  const { showError, showSuccess } = useNotification();

  if (!sketchContext || !wsService) throw new Error("SketchContext or WebSocketContext not found");

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
    sketchContext.actions.setLoading(true);
    sketchContext.actions.setError(null);
    const error = validateSketchDimensions(width, height);
    if (error) {
      showError(error);
      sketchContext.actions.setLoading(false);
      return;
    }
    setIsOpen(false);
    try {
      const response = await axiosInstance.post(
        `${BASE_URL}/createSketch`,
        {
          channelName: channelName,
          displayName: displayName,
          width: parseInt(width),
          height: parseInt(height),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        const validatedSketch = SketchSchema.parse(response.data.data);
        sketchContext.actions.addSketch(validatedSketch);
        showSuccess(`Sketch "${displayName}" created successfully`);

        // Broadcast new sketch to all clients
        wsService.actions.send({
          channelName,
          type: MessageType.Sketch,
          content: {
            sketchCmd: {
              commandType: SketchCommandType.New,
              sketchId: validatedSketch.id,
              sketchData: validatedSketch,
            },
          },
        });

        const fullSketchResponse = await axiosInstance.get(
          `${BASE_URL}/channels/${channelName}/sketches/${validatedSketch.id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (fullSketchResponse.data.success) {
          const sketchWithRegions = SketchSchema.parse(fullSketchResponse.data.data);
          sketchContext.actions.setCurrentSketch(sketchWithRegions);
        }
        setIsOpen(false);

        // Reset form fields
        setDisplayName("");
        setWidth("");
        setHeight("");
      } else {
        showError(response.data.error || "Failed to create sketch");
        sketchContext.actions.setError(response.data.error);
      }
    } catch (error) {
      let errorMessage = "Failed to create sketch";
      if (error instanceof z.ZodError) {
        errorMessage = "Invalid sketch data received";
      }
      if (isAxiosError(error)) {
        errorMessage = error.response?.data?.message || errorMessage;
      }
      showError(errorMessage);
      sketchContext.actions.setError(errorMessage);
    } finally {
      sketchContext.actions.setLoading(false);
    }
  };

  const handleSelectSketch = async (sketch: Sketch) => {
    sketchContext.actions.setLoading(true);
    sketchContext.actions.setError(null);
    try {
      const response = await axiosInstance.get(`${BASE_URL}/channels/${sketch.channelName}/sketches/${sketch.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        const sketchWithRegions = SketchSchema.parse(response.data.data);
        sketchContext.actions.setCurrentSketch(sketchWithRegions);
        showSuccess(`Sketch "${sketch.displayName}" loaded`);
      } else {
        showError(response.data.error || "Failed to load sketch");
        sketchContext.actions.setError(response.data.error);
        console.error("Failed to get sketch:", response.data.error);
      }
    } catch (error) {
      let errorMessage = "Failed to load sketch";
      if (error instanceof z.ZodError) {
        errorMessage = "Invalid sketch data received";
      }
      if (isAxiosError(error)) {
        errorMessage = error.response?.data?.message || errorMessage;
        console.error("Failed to get sketch:", error.response?.data?.message);
      }
      showError(errorMessage);
      sketchContext.actions.setError(errorMessage);
    } finally {
      sketchContext.actions.setLoading(false);
    }
  };

  const handleDeleteSketch = async (id: string) => {
    try {
      const response = await axiosInstance.delete(`${BASE_URL}/deleteSketch/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        sketchContext.actions.removeSketch(id);
        if (sketchContext.state.currentSketch?.id === id) {
          sketchContext.actions.setCurrentSketch(null);
        }
        wsService.actions.send({
          channelName,
          type: MessageType.Sketch,
          content: {
            sketchCmd: {
              commandType: SketchCommandType.Delete,
              sketchId: id,
            },
          },
        });
        showSuccess("Sketch deleted successfully");
      }
    } catch (error) {
      if (isAxiosError(error)) {
        const message = error.response?.data?.error.message || "Failed to delete sketch";
        showError(message);
        sketchContext.actions.setError(message);
      }
      throw error;
    }
  };

  return (
    <div className="flex items-center justify-between p-4 border-b border-primary/20">
      <div className="flex items-center">
        <SketchList
          sketches={sketchContext.state.sketches
            .slice()
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())}
          onSelect={handleSelectSketch}
          onDelete={handleDeleteSketch}
          isLoading={sketchContext.state.isLoading}
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
