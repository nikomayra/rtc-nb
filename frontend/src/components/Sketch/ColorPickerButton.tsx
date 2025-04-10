import React, { useState, useRef, useCallback } from "react";
import { HexColorPicker } from "react-colorful";

interface ColorPickerButtonProps {
  currentColor: string;
  onChangeColor: (color: string) => void;
}

const ColorPickerButton: React.FC<ColorPickerButtonProps> = ({ currentColor, onChangeColor }) => {
  // console.log("[ColorPicker] Rendering or Re-rendering. Initial isOpen state:", useState(false)[0]); // Remove misleading log
  const [isOpen, setIsOpen] = useState(false);
  // const pickerRef = useRef<HTMLDivElement>(null); // No longer needed for mousedown
  const containerRef = useRef<HTMLDivElement>(null); // Ref for the blur container

  // Add log here to see the actual state value during render
  console.log("[ColorPicker] Rendering. Current isOpen state:", isOpen);

  // Stabilize togglePicker with useCallback
  const togglePicker = useCallback((event: React.MouseEvent) => {
    event.stopPropagation(); // Keep stopping propagation on the button click
    setIsOpen((prevIsOpen) => {
      console.log("[ColorPicker] togglePicker: Setting isOpen from", prevIsOpen, "to", !prevIsOpen);
      return !prevIsOpen;
    });
  }, []);

  // Close picker when focus leaves the container
  const handleBlur = useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    // Check if the relatedTarget (where focus went) is outside the container
    if (containerRef.current && !containerRef.current.contains(event.relatedTarget as Node)) {
      console.log("[ColorPicker] handleBlur: Focus left container. Setting isOpen to false.");
      setIsOpen(false);
    }
  }, []);

  return (
    // Add a container div with onBlur and ref
    <div ref={containerRef} onBlur={handleBlur} className="relative">
      {/* Color Indicator Button - Now a styled rectangle */}
      <button
        onClick={togglePicker}
        className={`px-3 py-1.5 rounded-md text-sm transition-colors border border-transparent focus:outline-none focus:ring-1 focus:ring-primary-light focus:border-primary-light ${
          isOpen ? "bg-primary/30" : "bg-surface-dark/50 hover:bg-surface-dark/70"
        }`}
        style={{ backgroundColor: isOpen ? undefined : currentColor }}
        aria-label="Select drawing color"
      >
        🎨 Color
      </button>

      {/* Color Picker Popover */}
      {isOpen && (
        <div
          // ref={pickerRef} // No longer needed
          className="absolute z-50 bottom-full mb-2 left-0 p-2 bg-surface-medium rounded-lg shadow-xl border border-border-dark"
          // Prevent clicks inside the picker from triggering blur/close logic immediately
          onClick={(e) => e.stopPropagation()}
        >
          <HexColorPicker color={currentColor} onChange={(colorResult) => onChangeColor(colorResult)} />
        </div>
      )}
    </div>
  );
};

export default ColorPickerButton;
