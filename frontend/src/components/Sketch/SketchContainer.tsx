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
import { useSketchActions } from "../../hooks/useSketchActions";
import { useCanvas } from "../../hooks/useCanvas";

export const SketchContainer = () => {
  const [drawing, setDrawing] = useState<boolean>(true);
  const [sketches, setSketches] = useState<RegionlessSketch[]>([]);
  const [currentSketch, setCurrentSketch] = useState<Sketch | null>(null);
  const [strokeWidth, setStrokeWidth] = useState<number>(2);

  const chatContext = useContext(ChatContext);
  const authContext = useContext(AuthContext);
  if (!chatContext || !authContext) throw new Error("Chat or Auth context not found");

  const canvasOps = useCanvas(currentSketch?.width ?? 0, currentSketch?.height ?? 0);

  const sketchActions = useSketchActions(
    chatContext.state.currentChannel ?? "",
    currentSketch?.id ?? "",
    canvasOps.drawFullPath,
    canvasOps.calculateBounds
  );

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

  const handleDrawing = (value: boolean) => {
    setDrawing(value);
  };

  const handleStrokeWidth = (value: number) => {
    if (value > 10) {
      console.error("Stroke width cannot exceed 10px");
      return;
    }
    setStrokeWidth(value);
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
            currentSketch={currentSketch}
            drawing={drawing}
            strokeWidth={strokeWidth}
            sketchActions={sketchActions}
            canvasOps={canvasOps}
          />
          <SketchToolbar
            setDrawing={handleDrawing}
            setStrokeWidth={handleStrokeWidth}
            sketchActions={sketchActions}
            clearCanvas={canvasOps.clear}
            currentSketchId={currentSketch.id}
            channelName={chatContext.state.currentChannel ?? ""}
          />
        </>
      )}
    </div>
  );
};
