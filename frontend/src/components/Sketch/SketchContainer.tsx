import { SketchBoard } from "./SketchBoard";
import { useContext, useCallback, useEffect } from "react";
import { DrawPath, Region } from "../../types/interfaces";
import { ChatContext } from "../../contexts/chatContext";
import { AuthContext } from "../../contexts/authContext";
import { SketchConfig } from "./SketchConfig";

import { useSketchWebSocket } from "../../hooks/useSketchWebSocket";
import { useSketchActions } from "../../hooks/useSketchActions";
import useCanvas from "../../hooks/useCanvas";
import { SketchContext } from "../../contexts/sketchContext";

export const SketchContainer = () => {
  const sketchContext = useContext(SketchContext);
  const chatContext = useContext(ChatContext);
  const authContext = useContext(AuthContext);
  if (!sketchContext || !chatContext || !authContext) throw new Error("Context not found");

  const currentSketch = sketchContext.state.currentSketch;
  const canvasOps = useCanvas(currentSketch?.width ?? 0, currentSketch?.height ?? 0);

  const sketchActions = useSketchActions(
    chatContext.state.currentChannel ?? "",
    currentSketch?.id ?? "",
    canvasOps.drawFullPath,
    canvasOps.calculateBounds
  );

  // Handle completed paths from SketchBoard
  const handlePathComplete = useCallback(
    (path: DrawPath) => {
      if (!currentSketch) return;
      canvasOps.addPath(path); // Add to canvas state
      sketchActions.addPath(path); // Send to backend
    },
    [currentSketch, canvasOps, sketchActions]
  );

  // Handle WebSocket updates
  const handleUpdate = useCallback(
    (update: Region) => {
      update.paths.forEach((path) => {
        canvasOps.drawFullPath(path);
      });
    },
    [canvasOps]
  );

  // Setup WebSocket handling
  useSketchWebSocket(currentSketch?.id, handleUpdate, canvasOps.clear);

  //handle initial sketch loading
  useEffect(() => {
    if (!currentSketch?.regions) {
      // console.log("No regions found in sketch");
      return;
    }

    // console.log("Loading sketch regions:", Object.keys(currentSketch.regions).length);

    // Clear canvas first
    canvasOps.clear();

    // Draw all paths from all regions
    Object.values(currentSketch.regions).forEach((region) => {
      if (!region.paths) {
        console.log("No paths in region");
        return;
      }
      // console.log(`Drawing region with ${region.paths.length} paths`);
      region.paths.forEach((path) => {
        if (path.points.length > 1) {
          // console.log(`Drawing path with ${path.points.length} points`);

          for (let i = 1; i < path.points.length; i++) {
            canvasOps.drawPath(
              path.points[i - 1],
              path.points[i],
              path.isDrawing ?? true, // Default to true if undefined
              path.strokeWidth ?? 2 // Default to 2 if undefined
            );
          }
        }
      });
    });
  }, [currentSketch, canvasOps]);

  if (!currentSketch) {
    return (
      <div className="sketch-container">
        <SketchConfig channelName={chatContext.state.currentChannel ?? ""} token={authContext.state.token ?? ""} />
      </div>
    );
  }

  return (
    <div className="sketch-container">
      <SketchConfig channelName={chatContext.state.currentChannel ?? ""} token={authContext.state.token ?? ""} />
      <SketchBoard
        onPathComplete={handlePathComplete}
        canvasOps={canvasOps}
        onClear={canvasOps.clear}
        sketchActions={sketchActions}
      />
    </div>
  );
};
