import { useContext } from "react";
import { SketchBoard } from "./SketchBoard";
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

  const {
    state: { currentChannel },
  } = chatContext;
  const {
    state: { currentSketch },
  } = sketchContext;

  if (!currentChannel) {
    return (
      <div className="h-full w-full flex flex-col bg-surface-dark/10 rounded-md overflow-hidden">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center p-6 bg-surface-dark/20 rounded-lg border border-primary/10 max-w-md">
            <h3 className="text-lg font-medium text-text-light mb-3">No Channel Selected</h3>
            <p className="text-sm text-text-light/70 mb-4">Please select a channel to start drawing.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentSketch) {
    return (
      <div className="h-full w-full flex flex-col bg-surface-dark/10 rounded-md overflow-hidden">
        <SketchConfig channelName={currentChannel} />
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
      <SketchConfig channelName={currentChannel} />
      <div className="flex flex-1 w-full overflow-hidden">
        <SketchBoard channelName={currentChannel} />
      </div>
    </div>
  );
};
