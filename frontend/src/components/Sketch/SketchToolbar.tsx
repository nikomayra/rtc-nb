import { useContext } from "react";
import { useSketchActions } from "../../hooks/useSketchActions";
import "../../styles/components/sketch.css";
import { BASE_URL } from "../../utils/constants";
import { AuthContext } from "../../contexts/authContext";
import { axiosInstance } from "../../api/axiosInstance";
import { WebSocketContext } from "../../contexts/webSocketContext";
import { MessageType } from "../../types/interfaces";
import { isAxiosError } from "axios";

interface SketchToolbarProps {
  setStrokeWidth: (value: number) => void;
  setDrawing: (value: boolean) => void;
  sketchActions: ReturnType<typeof useSketchActions>;
  clearCanvas: () => void;
  currentSketchId: string;
  channelName: string;
}

export const SketchToolbar = ({
  setDrawing,
  setStrokeWidth,
  sketchActions,
  clearCanvas,
  currentSketchId,
  channelName,
}: SketchToolbarProps) => {
  const wsService = useContext(WebSocketContext);
  const authContext = useContext(AuthContext);
  if (!wsService || !authContext) throw new Error("Context not found");

  const handleClear = async () => {
    try {
      const response = await axiosInstance.post(
        `${BASE_URL}/clearSketch`,
        {
          sketchId: currentSketchId,
          channelName: channelName,
        },
        {
          headers: {
            Authorization: `Bearer ${authContext.state.token}`,
          },
        }
      );

      if (response.data.success) {
        clearCanvas();
        // Send WebSocket message to clear other clients
        wsService.actions.send({
          channelName,
          type: MessageType.ClearSketch,
          content: { clearSketch: currentSketchId },
        });
      }
    } catch (error) {
      if (isAxiosError(error)) {
        console.error("Failed to clear sketch:", error.response?.data?.message);
      }
      throw error;
    }
  };

  return (
    <div className="sketch-toolbar">
      <button onClick={() => setDrawing(true)}>Pen🖊️</button>
      <button onClick={() => setDrawing(false)}>Eraser🧹</button>
      <label htmlFor="stroke-width">Stroke Width</label>
      <select id="stroke-width" onChange={(e) => setStrokeWidth(parseInt(e.target.value))} defaultValue={2}>
        <option value={1}>1</option>
        <option value={2}>2</option>
        <option value={3}>3</option>
        <option value={4}>4</option>
        <option value={5}>5</option>
        <option value={6}>6</option>
        <option value={7}>7</option>
        <option value={8}>8</option>
        <option value={9}>9</option>
        <option value={10}>10</option>
      </select>
      <button onClick={() => sketchActions.undo()} disabled={!sketchActions.canUndo()}>
        Undo◀️
      </button>
      <button onClick={() => sketchActions.redo()} disabled={!sketchActions.canRedo()}>
        Redo▶️
      </button>
      <button onClick={handleClear}>Clear🗑️</button>
    </div>
  );
};
