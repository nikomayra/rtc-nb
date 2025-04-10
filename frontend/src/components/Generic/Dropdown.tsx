import { useEffect, useRef, useState } from "react";

interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  position?: "left" | "right";
  isOpenExternal?: boolean;
  setIsOpenExternal?: (isOpen: boolean) => void;
}

export const Dropdown = ({
  trigger,
  children,
  className = "",
  triggerClassName = "",
  menuClassName = "",
  position = "right",
  isOpenExternal,
  setIsOpenExternal,
}: DropdownProps) => {
  const [isOpenInternal, setIsOpenInternal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Use external or internal state based on props
  const isOpen = isOpenExternal !== undefined ? isOpenExternal : isOpenInternal;
  const setIsOpen = setIsOpenExternal || setIsOpenInternal;

  // Mount/Unmount logging
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("[Dropdown] Mounted");
      return () => {
        console.log("[Dropdown] Unmounted");
      };
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setIsOpen]);

  const positionClass = position === "left" ? "left-0" : "right-0";

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1 rounded-lg text-xs bg-surface-dark/50 hover:bg-surface-dark text-text-light/70 hover:text-primary transition-colors ${triggerClassName}`}
      >
        {trigger}
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className={`absolute ${positionClass} top-full mt-1 w-64 bg-surface-light border 
          border-primary/20 rounded-md shadow-md z-50 ${menuClassName}`}
        >
          <div className="max-h-80 overflow-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-surface-dark">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};
