import { SketchBoard } from "./SketchBoard";
import { useContext } from "react";
import { ChatContext } from "../../contexts/chatContext";
import { AuthContext } from "../../contexts/authContext";
import { SketchConfig } from "./SketchConfig";
import { SketchContext } from "../../contexts/sketchContext";

export const SketchContainer = () => {
  const sketchContext = useContext(SketchContext);
  const chatContext = useContext(ChatContext);
  const authContext = useContext(AuthContext);

  if (!sketchContext || !chatContext || !authContext) {
    throw new Error("Context not found");
  }

  const currentSketch = sketchContext.state.currentSketch;
  const currentChannel = chatContext.state.currentChannel ?? "";

  if (!currentSketch) {
    return (
      <div className="h-full w-full flex flex-col bg-surface-dark/10 rounded-md overflow-hidden">
        <SketchConfig channelName={currentChannel} token={authContext.state.token ?? ""} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center p-6 bg-surface-dark/20 rounded-lg border border-primary/10 max-w-md">
            <h3 className="text-lg font-medium text-text-light mb-3">No Sketch Selected</h3>
            <p className="text-sm text-text-light/70 mb-4">
              Select an existing sketch from the dropdown or create a new one to start drawing.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full max-w-full flex flex-col bg-surface-dark/10 rounded-md overflow-hidden">
      <SketchConfig channelName={currentChannel} token={authContext.state.token ?? ""} />
      <div className="flex flex-1 w-full overflow-hidden">
        <SketchBoard channelName={currentChannel} />
      </div>
    </div>
  );
};
