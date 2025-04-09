/**
 * @deprecated This hook is being phased out in favor of useSketchManager.
 * The original code is kept below for reference during refactoring.
 */

/*
// import { useCallback, useRef, useState, useEffect } from "react";
// import { DrawPath, Sketch } from "../types/interfaces";

// // Handles local drawing state and path management

// const DEBUG = true;

// export interface SketchState {
//   sketch: Sketch | null;
//   paths: {
//     [id: string]: DrawPath; // Use a map for O(1) lookups and updates
//   };
//   isDrawing: boolean;
//   isPending: boolean;
//   lastUpdate: number; // Timestamp to track updates
// }

// export interface UseSketchStateReturn {
//   state: SketchState;
//   setSketch: (sketch: Sketch | null) => void;
//   addPath: (path: DrawPath) => string;
//   updatePath: (pathId: string, path: DrawPath) => void;
//   removePath: (pathId: string) => void;
//   clearPaths: () => void;
//   markAsDrawing: (isDrawing: boolean) => void;
//   markAsPending: (isPending: boolean) => void;
//   getAllPaths: () => DrawPath[];
// }

// // Create a session-persistent path ID store
// const pathStore = {
//   // Map of sketch ID to map of path index to path ID
//   // This ensures path IDs are preserved across component remounts
//   sketchPaths: new Map<string, Map<string, string>>(),

//   // Store a path ID for a sketch
//   storePath: (sketchId: string, pathKey: string, pathId: string) => {
//     if (!pathStore.sketchPaths.has(sketchId)) {
//       pathStore.sketchPaths.set(sketchId, new Map());
//     }
//     pathStore.sketchPaths.get(sketchId)?.set(pathKey, pathId);
//   },

//   // Retrieve a path ID for a sketch
//   getPathId: (sketchId: string, pathKey: string): string | undefined => {
//     return pathStore.sketchPaths.get(sketchId)?.get(pathKey);
//   },

//   // Generate a unique key for a path based on its properties
//   generatePathKey: (path: DrawPath): string => {
//     // Use first and last point to create a unique key
//     if (path.points.length === 0) return "empty";

//     const firstPoint = path.points[0];
//     const lastPoint = path.points[path.points.length - 1];
//     return `${firstPoint.x},${firstPoint.y}-${lastPoint.x},${lastPoint.y}-${path.isDrawing}-${path.strokeWidth}`;
//   },

//   // Clear all path IDs for a sketch
//   clearSketch: (sketchId: string) => {
//     pathStore.sketchPaths.delete(sketchId);
//   },
// };

// export const useSketchState = (): UseSketchStateReturn => {
//   const [state, setState] = useState<SketchState>({
//     sketch: null,
//     paths: {},
//     isDrawing: false,
//     isPending: false,
//     lastUpdate: Date.now(),
//   });

//   // Use a ref to access current state in callbacks without triggering re-renders
//   const stateRef = useRef<SketchState>(state);
//   // Store active path ID in ref to preserve across render cycles
//   const activePathIdRef = useRef<string | null>(null);

//   // Keep stateRef in sync with state
//   useEffect(() => {
//     stateRef.current = state;
//   }, [state]);

//   const setSketch = useCallback((sketch: Sketch | null) => {
//     if (DEBUG) console.log(`📝 [useSketchState] Setting sketch: ${sketch?.id || "null"}`);

//     // Convert existing paths to map
//     const pathsMap: { [id: string]: DrawPath } = {};
//     if (sketch?.regions) {
//       Object.values(sketch.regions).forEach((region) => {
//         if (region.paths && region.paths.length > 0) {
//           region.paths.forEach((path, index) => {
//             const pathKey = `region-${index}-${pathStore.generatePathKey(path)}`;
//             let pathId: string;

//             // Use existing ID if available, otherwise generate a new one
//             if (sketch.id) {
//               const existingPathId = pathStore.getPathId(sketch.id, pathKey);
//               if (existingPathId) {
//                 pathId = existingPathId;
//                 if (DEBUG) console.log(`🔄 [useSketchState] Reusing path ID: ${pathId} for sketch ${sketch.id}`);
//               } else {
//                 pathId = crypto.randomUUID();
//                 pathStore.storePath(sketch.id, pathKey, pathId);
//                 if (DEBUG) console.log(`🆕 [useSketchState] New path ID: ${pathId} for sketch ${sketch.id}`);
//               }
//             } else {
//               pathId = crypto.randomUUID();
//             }

//             pathsMap[pathId] = path;
//           });
//         }
//       });
//     }

//     setState((prev) => {
//       // Always preserve existing paths if same sketch
//       const preservePaths = sketch?.id === prev.sketch?.id;
//       return {
//         ...prev,
//         sketch,
//         paths: preservePaths ? { ...prev.paths } : pathsMap,
//         lastUpdate: Date.now(),
//       };
//     });

//     if (DEBUG) console.log(`📊 [useSketchState] Loaded ${Object.keys(pathsMap).length} paths`);
//   }, []);

//   const addPath = useCallback((path: DrawPath): string => {
//     const pathId = crypto.randomUUID();
//     if (DEBUG) console.log(`➕ [useSketchState] Adding path ${pathId} with ${path.points.length} points`);

//     // Store the path ID for this sketch if we have a sketch ID
//     if (stateRef.current.sketch?.id) {
//       const pathKey = `live-${Date.now()}-${pathStore.generatePathKey(path)}`;
//       pathStore.storePath(stateRef.current.sketch.id, pathKey, pathId);
//     }

//     // Remember the active path ID
//     activePathIdRef.current = pathId;

//     setState((prev) => ({
//       ...prev,
//       paths: {
//         ...prev.paths,
//         [pathId]: path,
//       },
//       lastUpdate: Date.now(),
//     }));

//     return pathId;
//   }, []);

//   const updatePath = useCallback((pathId: string, path: DrawPath) => {
//     setState((prev) => {
//       if (!prev.paths[pathId]) {
//         console.warn(`⚠️ [useSketchState] Attempted to update non-existent path: ${pathId}`);
//         // Try to use the active path ID if available
//         if (activePathIdRef.current && prev.paths[activePathIdRef.current]) {
//           pathId = activePathIdRef.current;
//           if (DEBUG) console.log(`🔄 [useSketchState] Using active path ID instead: ${pathId}`);
//         } else {
//           return prev;
//         }
//       }

//       return {
//         ...prev,
//         paths: {
//           ...prev.paths,
//           [pathId]: path,
//         },
//         lastUpdate: Date.now(),
//       };
//     });
//   }, []);

//   const removePath = useCallback((pathId: string) => {
//     setState((prev) => {
//       if (!prev.paths[pathId]) {
//         console.warn(`⚠️ [useSketchState] Attempted to remove non-existent path: ${pathId}`);
//         return prev;
//       }

//       const newPaths = { ...prev.paths };
//       delete newPaths[pathId];

//       return {
//         ...prev,
//         paths: newPaths,
//         lastUpdate: Date.now(),
//       };
//     });
//   }, []);

//   const clearPaths = useCallback(() => {
//     if (DEBUG) console.log(`🧹 [useSketchState] Clearing all paths`);

//     // Clear path store for this sketch
//     if (stateRef.current.sketch?.id) {
//       pathStore.clearSketch(stateRef.current.sketch.id);
//     }

//     setState((prev) => ({
//       ...prev,
//       paths: {},
//       lastUpdate: Date.now(),
//     }));
//   }, []);

//   const markAsDrawing = useCallback((isDrawing: boolean) => {
//     setState((prev) => ({
//       ...prev,
//       isDrawing,
//     }));
//   }, []);

//   const markAsPending = useCallback((isPending: boolean) => {
//     setState((prev) => ({
//       ...prev,
//       isPending,
//     }));
//   }, []);

//   const getAllPaths = useCallback(() => {
//     return Object.values(stateRef.current.paths);
//   }, []);

//   return {
//     state,
//     setSketch,
//     addPath,
//     updatePath,
//     removePath,
//     clearPaths,
//     markAsDrawing,
//     markAsPending,
//     getAllPaths,
//   };
// };
*/
