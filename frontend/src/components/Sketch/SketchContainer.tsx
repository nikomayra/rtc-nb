import { useEffect } from "react";
import { SketchBoard } from "./SketchBoard";
import { SketchConfig } from "./SketchConfig";
import { useSketchContext } from "../../hooks/useSketchContext";
import { useSystemContext } from "../../hooks/useSystemContext";

export const SketchContainer = () => {
  const sketchContext = useSketchContext();
  const systemContext = useSystemContext();

  const { state: systemState } = systemContext;
  const { state: sketchState } = sketchContext;

  // Mount/Unmount logging
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("[SketchContainer] Mounted");
      return () => {
        console.log("[SketchContainer] Unmounted");
      };
    }
  }, []);

  if (!systemState.currentChannel) {
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

  if (!sketchState.currentSketch) {
    return (
      <div className="h-full w-full flex flex-col bg-surface-dark/10 rounded-md overflow-hidden">
        <SketchConfig channelName={systemState.currentChannel.name} />
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
      <SketchConfig channelName={systemState.currentChannel.name} />
      <div className="flex flex-1 w-full overflow-hidden">
        <SketchBoard channelName={systemState.currentChannel.name} />
      </div>
    </div>
  );
};
