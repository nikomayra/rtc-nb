import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  className?: string;
}

export const Modal = ({ isOpen, onClose, children, title, className = "" }: ModalProps) => {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      // Prevent scrolling on the main content when modal is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Render modal in a portal
  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className={`bg-surface-light rounded-lg shadow-lg relative max-h-[90vh] max-w-[90vw] 
          overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-surface-dark ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute -top-2 -right-1.5 w-10 h-10 bg-surface-dark rounded-full 
            flex items-center justify-center text-text-light hover:bg-primary/80 
            hover:text-white transition-all duration-200 text-2xl z-10 shadow-lg
            hover:scale-110 active:scale-95"
          onClick={onClose}
        >
          ×
        </button>
        {title && (
          <div className="px-6 py-4 border-b border-primary/20">
            <h2 className="text-lg font-medium text-text-light">{title}</h2>
          </div>
        )}
        <div className="p-6 space-y-4">{children}</div>
      </div>
    </div>,
    document.body // Portal target
  );
};
