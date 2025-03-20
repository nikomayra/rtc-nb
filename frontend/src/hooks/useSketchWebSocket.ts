// import { useCallback, useContext, useEffect, useRef } from "react";
// import { WebSocketContext } from "../contexts/webSocketContext";
// import { SketchContext } from "../contexts/sketchContext";
// import { IncomingMessage, MessageType, SketchCommandType, Region } from "../types/interfaces";
// import { AuthContext } from "../contexts/authContext";

/**
 * @deprecated Use the useSketchSync hook instead.
 * This hook is kept for backward compatibility only.
 */

// export const useSketchWebSocket = (
//   currentSketchId: string | undefined,
//   onUpdate: (update: Region) => void,
//   onClear: () => void
// ) => {
//   const wsService = useContext(WebSocketContext);
//   const sketchContext = useContext(SketchContext);
//   const authContext = useContext(AuthContext);
//   if (!sketchContext || !wsService || !authContext) throw new Error("Context not found");

//   const currentSketchIdRef = useRef(currentSketchId);
//   const isProcessingMessage = useRef(false);
//   const messageQueue = useRef<IncomingMessage[]>([]);
//   const processMessageRef = useRef<(message: IncomingMessage) => void>();

//   useEffect(() => {
//     currentSketchIdRef.current = currentSketchId;
//   }, [currentSketchId]);

//   const handleMessage = useCallback(
//     async (message: IncomingMessage) => {
//       if (message.type !== MessageType.Sketch || !message.content.sketchCmd) return;

//       console.log(`📥 [handleMessage] From ${message.username}, cmd: ${message.content.sketchCmd.commandType}`);

//       if (isProcessingMessage.current) {
//         console.log(`⏳ [handleMessage] Queue message (${messageQueue.current.length} pending)`);
//         messageQueue.current.push(message);
//         return;
//       }

//       try {
//         isProcessingMessage.current = true;
//         const cmd = message.content.sketchCmd;

//         // Skip our own messages - we handle everything locally first
//         if (message.username === authContext.state.username) {
//           console.log(`🔄 [handleMessage] Ignoring own message (already processed locally)`);
//           return;
//         }

//         // Process messages from other users
//         switch (cmd.commandType) {
//           case SketchCommandType.Update:
//             if (cmd.region && currentSketchIdRef.current === cmd.sketchId) {
//               console.log(`🔄 [handleMessage] Update from ${message.username}: ${cmd.region.paths.length} paths`);

//               onUpdate(cmd.region);
//             } else {
//               console.log(`⚠️ [handleMessage] Skipping update - ID mismatch`);
//             }
//             break;

//           case SketchCommandType.Clear:
//             if (currentSketchIdRef.current === cmd.sketchId) {
//               console.log(`🧹 [handleMessage] Clear from ${message.username}`);
//               onClear();
//             }
//             break;

//           case SketchCommandType.Delete:
//             console.log(`🗑️ [handleMessage] Delete sketch: ${cmd.sketchId}`);
//             sketchContext.actions.removeSketch(cmd.sketchId);
//             if (currentSketchIdRef.current === cmd.sketchId) {
//               sketchContext.actions.setCurrentSketch(null);
//             }
//             break;

//           case SketchCommandType.New:
//             if (cmd.sketchData) {
//               console.log(`📝 [handleMessage] New sketch: ${cmd.sketchData.id}`);
//               sketchContext.actions.addSketch(cmd.sketchData);
//             }
//             break;
//         }
//       } catch (error) {
//         console.error("❌ [handleMessage] Error:", error);
//       } finally {
//         isProcessingMessage.current = false;
//         if (messageQueue.current.length > 0) {
//           const nextMessage = messageQueue.current.shift();
//           if (nextMessage) {
//             console.log(`⏭️ [handleMessage] Processing next queued message`);
//             processMessageRef.current?.(nextMessage);
//           }
//         }
//       }
//     },
//     [onUpdate, onClear, sketchContext.actions, authContext.state.username]
//   );

//   useEffect(() => {
//     if (!wsService) return;

//     processMessageRef.current = handleMessage;
//     wsService.actions.setMessageHandlers({
//       onSketchMessage: handleMessage,
//     });

//     return () => {
//       wsService.actions.setMessageHandlers({});
//     };
//   }, [wsService, handleMessage]);
// };
