import { useEffect, useRef, useState } from "react";

interface CustomDropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const CustomDropdown = ({ trigger, children, className = "" }: CustomDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-sm text-text-light/70 hover:text-primary transition-colors px-2 py-1 rounded"
      >
        {trigger}
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 top-full mt-1 w-56 bg-surface-dark border 
          border-primary/20 rounded-md shadow-lg z-50 ${className}
          scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-surface-dark`}
        >
          {children}
        </div>
      )}
    </div>
  );
};
