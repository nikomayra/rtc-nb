import { SketchBoard } from "./SketchBoard";
import { SketchToolbar } from "./SketchToolbar";
import "../../styles/components/sketch.css";
import { useEffect, useState, useContext } from "react";
import { RegionlessSketch, RegionlessSketchSchema, Sketch } from "../../types/interfaces";
import { axiosInstance, isAxiosError } from "../../api/axiosInstance";
import { ChatContext } from "../../contexts/chatContext";
import { BASE_URL } from "../../utils/constants";
import { SketchConfig } from "./SketchConfig";
import { AuthContext } from "../../contexts/authContext";
import { z } from "zod";

export const SketchContainer = () => {
  const chatContext = useContext(ChatContext);
  const authContext = useContext(AuthContext);
  const [drawing, setDrawing] = useState(false);
  const [sketches, setSketches] = useState<RegionlessSketch[]>([]);
  const [currentSketch, setCurrentSketch] = useState<Sketch | null>(null);
  const [strokeWidth, setStrokeWidth] = useState(2);

  if (!chatContext || !authContext) throw new Error("Chat or Auth context not found");

  useEffect(() => {
    if (!authContext.state.token || !chatContext.state.currentChannel) return;

    const getSketches = async () => {
      try {
        const response = await axiosInstance.get(
          `${BASE_URL}/getSketches/${encodeURIComponent(chatContext.state.currentChannel!)}`,
          {
            headers: {
              Authorization: `Bearer ${authContext.state.token}`,
            },
          }
        );
        if (response.data.success) {
          const validatedSketches = z.array(RegionlessSketchSchema).parse(response.data.data);
          setSketches(validatedSketches);
        } else {
          console.error("Failed to get sketches:", response.data.error);
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.error("Invalid sketch data:", error.errors);
        }
        if (isAxiosError(error)) {
          console.error("Failed to get sketches:", error.response?.data?.message);
        }
        throw error;
      }
    };
    getSketches();
  }, [chatContext.state.currentChannel, authContext.state.token]);

  const handleCurrentSketch = (sketch: Sketch) => {
    setCurrentSketch(sketch);
  };

  const handleDeleteSketch = async (id: string) => {
    try {
      const response = await axiosInstance.delete(`${BASE_URL}/deleteSketch/${id}`, {
        headers: {
          Authorization: `Bearer ${authContext.state.token}`,
        },
      });
      if (response.data.success) {
        setSketches((prev) => prev.filter((sketch) => sketch.id !== id));
        if (currentSketch?.id === id) {
          setCurrentSketch(null);
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

  return (
    <div className="sketch-container">
      <SketchConfig
        sketches={sketches}
        channelName={chatContext.state.currentChannel ?? ""}
        token={authContext.state.token ?? ""}
        currentSketch={handleCurrentSketch}
        deleteSketch={handleDeleteSketch}
      />
      {currentSketch && (
        <>
          <SketchBoard
            channelName={chatContext.state.currentChannel ?? ""}
            currentSketch={currentSketch}
            drawing={drawing}
            strokeWidth={strokeWidth}
          />
          <SketchToolbar setDrawing={setDrawing} setStrokeWidth={setStrokeWidth} />
        </>
      )}
    </div>
  );
};
