import { useCallback, useContext } from "react";
import { WebSocketContext } from "../../contexts/webSocketContext";
import { AuthContext } from "../../contexts/authContext";
import { MessageType, SketchCommandType } from "../../types/interfaces";
import { axiosInstance } from "../../api/axiosInstance";
import { BASE_URL } from "../../utils/constants";

interface SketchToolbarProps {
  onClear: () => void;
  currentSketchId: string;
  channelName: string;
  isDrawing: boolean;
  setIsDrawing: (value: boolean) => void;
  strokeWidth: number;
  setStrokeWidth: (value: number) => void;
}

export const SketchToolbar = ({
  onClear,
  currentSketchId,
  channelName,
  isDrawing,
  setIsDrawing,
  strokeWidth,
  setStrokeWidth,
}: SketchToolbarProps) => {
  const wsService = useContext(WebSocketContext);
  const authContext = useContext(AuthContext);
  if (!wsService || !authContext) throw new Error("Context not found");

  const handleClear = useCallback(async () => {
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
        onClear();
        wsService.actions.send({
          channelName,
          type: MessageType.Sketch,
          content: {
            sketchCmd: {
              commandType: SketchCommandType.Clear,
              sketchId: currentSketchId,
            },
          },
        });
      }
    } catch (error) {
      console.error("Failed to clear sketch:", error);
    }
  }, [currentSketchId, channelName, onClear, wsService.actions, authContext.state.token]);

  return (
    <div className="sketch-toolbar">
      <button onClick={() => setIsDrawing(true)} className={isDrawing ? "active" : ""}>
        Pen🖊️
      </button>
      <button onClick={() => setIsDrawing(false)} className={!isDrawing ? "active" : ""}>
        Eraser🧹
      </button>
      <select value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((width) => (
          <option key={width} value={width}>
            {width}
          </option>
        ))}
      </select>
      <button onClick={handleClear}>Clear🗑️</button>
    </div>
  );
};
