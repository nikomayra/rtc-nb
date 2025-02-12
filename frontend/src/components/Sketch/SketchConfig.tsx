import { Sketch, SketchSchema, MessageType, SketchCommandType } from "../../types/interfaces";
import SketchList from "./SketchList";
import { axiosInstance, isAxiosError } from "../../api/axiosInstance";
import { BASE_URL } from "../../utils/constants";
import { useContext, useState } from "react";
import { z } from "zod";
import { Modal } from "../Generic/Modal";
import { SketchContext } from "../../contexts/sketchContext";
import { WebSocketContext } from "../../contexts/webSocketContext";

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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const sketchContext = useContext(SketchContext);
  const wsService = useContext(WebSocketContext);
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
      console.error(error);
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
      } else {
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
      } else {
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
      }
    } catch (error) {
      if (isAxiosError(error)) {
        const message = error.response?.data?.message || "Failed to delete sketch";
        if (message.includes("unauthorized")) {
          console.error("Only sketch creator or channel admin can delete sketches");
        } else {
          console.error(message);
        }
      }
      throw error;
    }
  };

  const toggleDropdown = () => {
    setIsDropdownOpen((prev) => !prev);
  };

  return (
    <div className="sketch-config">
      <SketchList
        sketches={sketchContext.state.sketches}
        onSelect={handleSelectSketch}
        onDelete={handleDeleteSketch}
        toggleDropdown={toggleDropdown}
        isOpen={isDropdownOpen}
      />
      <button onClick={() => setIsOpen(true)}>Create Sketch</button>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Create Sketch">
        <form onSubmit={handleCreateSketch}>
          <label htmlFor="displayName">Display Name</label>
          <br />
          <input
            type="text"
            placeholder="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <br />
          <label htmlFor="width">Width (max 1280)</label>
          <br />
          <input type="text" value={width} onChange={handleWidthChange} placeholder="Width (px)" pattern="\d*" />
          <br />
          <label htmlFor="height">Height (max 720)</label>
          <br />
          <input type="text" value={height} onChange={handleHeightChange} placeholder="Height (px)" pattern="\d*" />
          <br />
          <button type="submit">Create Sketch</button>
        </form>
      </Modal>
    </div>
  );
};
