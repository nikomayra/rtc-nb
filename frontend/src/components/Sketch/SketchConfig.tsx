import "../../styles/components/sketch.css";
import { RegionlessSketch, SketchSchema } from "../../types/interfaces";
import SketchList from "./SketchList";
import { axiosInstance, isAxiosError } from "../../api/axiosInstance";
import { BASE_URL } from "../../utils/constants";
import { useContext, useState } from "react";
import { z } from "zod";
import { Modal } from "../Generic/Modal";
import { SketchContext } from "../../contexts/sketchContext";

interface SketchConfigProps {
  channelName: string;
  token: string;
}

export const SketchConfig = ({ channelName, token }: SketchConfigProps) => {
  //  ChannelName string `json:"channelName"`
  // 	DisplayName string `json:"displayName"`
  // 	Width       int    `json:"width"`
  // 	Height      int    `json:"height"`

  const [displayName, setDisplayName] = useState("");
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const sketchContext = useContext(SketchContext);
  if (!sketchContext) throw new Error("SketchContext not found");

  const handleCreateSketch = async (e: React.FormEvent) => {
    e.preventDefault();
    // console.log("Create Sketch");
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
        sketchContext.actions.setCurrentSketch(validatedSketch);
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
    // console.log("Select Sketch", sketch);
    try {
      const response = await axiosInstance.get(`${BASE_URL}/channels/${sketch.channelName}/sketches/${sketch.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        const sketchWithRegions = SketchSchema.parse(response.data.data);
        sketchContext.actions.setCurrentSketch(sketchWithRegions);
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

  const handleDeleteSketch = async (id: string) => {
    // console.log("deleting sketch");
    try {
      const response = await axiosInstance.delete(`${BASE_URL}/deleteSketch/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.data.success) {
        sketchContext.actions.removeSketch(id);
        if (sketchContext.state.currentSketch?.id === id) {
          sketchContext.actions.setCurrentSketch(null);
        }
      } else {
        console.error("Failed to delete sketch:", response.data.error);
      }
    } catch (error) {
      if (isAxiosError(error)) {
        console.error("Failed to delete sketch:", error.response?.data?.message);
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
    </div>
  );
};
