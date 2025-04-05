import { useContext } from "react";
import { SketchContext } from "../contexts/sketchContext";

export const useSketchContext = () => {
  const sketchContext = useContext(SketchContext);

  if (!sketchContext) {
    throw new Error("useSketch must be used within a SketchProvider");
  }

  return sketchContext;
};
