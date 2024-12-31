import { SketchBoard } from "./SketchBoard";
import { SketchToolbar } from "./SketchToolbar";
import "../../styles/components/sketch.css";
import { useEffect, useState, useContext } from "react";
import { Sketch } from "../../types/interfaces";
import axiosInstance from "../../api/axiosInstance";
import { ChatContext } from "../../contexts/chatContext";
import { BASE_URL } from "../../utils/constants";
import { SketchConfig } from "./SketchConfig";

export const SketchContainer = () => {
  const chatContext = useContext(ChatContext);
  const [drawing, setDrawing] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [sketches, setSketches] = useState<Sketch[]>([]);

  useEffect(() => {
    const getSketches = async () => {
      const response = await axiosInstance.get(
        `${BASE_URL}/getSketches/${chatContext?.state.currentChannel}`
      );
      setSketches(response.data);
    };
    getSketches();
  }, [chatContext?.state.currentChannel]);

  if (!chatContext) return null;

  return (
    <div className="sketch-container">
      <SketchConfig sketches={sketches} />
      <SketchBoard drawing={drawing} erasing={erasing} />
      <SketchToolbar
        drawing={drawing}
        erasing={erasing}
        setDrawing={setDrawing}
        setErasing={setErasing}
      />
    </div>
  );
};
