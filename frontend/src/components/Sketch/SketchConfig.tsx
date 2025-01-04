import "../../styles/components/sketch.css";
import { RegionlessSketch, Sketch, SketchSchema } from "../../types/interfaces";
import SketchItem from "./SketchItem";
import { axiosInstance, isAxiosError } from "../../api/axiosInstance";
import { BASE_URL } from "../../utils/constants";
import { useState } from "react";
import { z } from "zod";
import { Modal } from "../Generic/Modal";

interface SketchConfigProps {
  sketches: RegionlessSketch[];
  currentSketch: (sketch: Sketch) => void;
  channelName: string;
  deleteSketch: () => Promise<void>;
  token: string;
}

export const SketchConfig = ({ sketches, channelName, token, currentSketch, deleteSketch }: SketchConfigProps) => {
  //  ChannelName string `json:"channelName"`
  // 	DisplayName string `json:"displayName"`
  // 	Width       int    `json:"width"`
  // 	Height      int    `json:"height"`

  const [displayName, setDisplayName] = useState("");
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const handleCreateSketch = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Create Sketch");
    setIsOpen(false);
    try {
      const response = await axiosInstance.post(
        `${BASE_URL}/createSketch`,
        {
          channelName: channelName,
          displayName: displayName,
          width: width,
          height: height,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        const validatedSketch = SketchSchema.parse(response.data.data);
        currentSketch(validatedSketch);
      } else {
        console.error("Failed to create sketch:", response.data.error);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Invalid sketch data:", error.errors);
      }
      if (isAxiosError(error)) {
        console.error("Failed to create sketch:", error.response?.data?.message);
      }
      throw error;
    }
  };

  const handleSelectSketch = async (sketch: RegionlessSketch) => {
    console.log("Select Sketch", sketch);
    try {
      const response = await axiosInstance.get(`${BASE_URL}/channels/${sketch.channelName}/sketches/${sketch.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        const sketchWithRegions = SketchSchema.parse(response.data.data);
        currentSketch(sketchWithRegions);
      } else {
        console.error("Failed to get sketch:", response.data.error);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Invalid sketch data:", error.errors);
      }
      if (isAxiosError(error)) {
        console.error("Failed to get sketch:", error.response?.data?.message);
      }
      throw error;
    }
  };

  const handleDeleteSketch = async () => {
    console.log("Delete Sketch");
    await deleteSketch();
  };

  return (
    <div className="sketch-config">
      <select name="sketch-select" id="sketch-select" defaultValue="default">
        <option value="default" disabled>
          Select your Sketch...
        </option>
        {sketches.map((sketch) => (
          <SketchItem key={sketch.id} sketch={sketch} onSelect={handleSelectSketch} />
        ))}
      </select>
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
          <input type="number" placeholder="Width" value={width} onChange={(e) => setWidth(parseInt(e.target.value))} />
          <br />
          <label htmlFor="height">Height (max 720)</label>
          <br />
          <input
            type="number"
            placeholder="Height"
            value={height}
            onChange={(e) => setHeight(parseInt(e.target.value))}
          />
          <br />
          <button type="submit">Create Sketch</button>
        </form>
      </Modal>
      <button onClick={handleDeleteSketch}>Delete Sketch</button>
    </div>
  );
};
