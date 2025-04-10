import React, { useEffect, useState, useCallback } from "react";
import { Notification } from "../../contexts/notificationContext";
import { useNotification } from "../../hooks/useNotification";

export const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotification();

  // Mount/Unmount logging
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("[NotificationContainer] Mounted");
      return () => {
        console.log("[NotificationContainer] Unmounted");
      };
    }
  }, []);

  if (notifications.length === 0) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-3 items-center">
        {/* Placeholder for empty notifications */}
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-3 items-center">
      {notifications.map((notification) => (
        <NotificationToast key={notification.id} notification={notification} removeNotification={removeNotification} />
      ))}
    </div>
  );
};

interface NotificationToastProps {
  notification: Notification;
  removeNotification: (id: string) => void;
}

const NotificationToast = ({ notification, removeNotification }: NotificationToastProps) => {
  const [isVisible, setIsVisible] = useState(false);

  // Get the stable removeNotification reference for the effect dependency
  const stableRemoveNotification = useCallback(() => {
    removeNotification(notification.id);
  }, [removeNotification, notification.id]);

  useEffect(() => {
    // Animate in
    const visibleTimer = window.setTimeout(() => setIsVisible(true), 10);

    // Auto close
    let closeTimeout: number | undefined;
    let cleanupTimeout: number | undefined;
    if (notification.duration && notification.duration > 0) {
      closeTimeout = window.setTimeout(() => {
        setIsVisible(false);
        // Use stableRemoveNotification here after animation
        cleanupTimeout = window.setTimeout(stableRemoveNotification, 300);
      }, Math.max(0, notification.duration - 300));
    }

    return () => {
      window.clearTimeout(visibleTimer);
      if (closeTimeout) window.clearTimeout(closeTimeout);
      if (cleanupTimeout) window.clearTimeout(cleanupTimeout);
    };
    // Depend on the stable callback and duration
  }, [notification.duration, stableRemoveNotification]);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    // Use stableRemoveNotification here after animation
    window.setTimeout(stableRemoveNotification, 300);
  }, [stableRemoveNotification]);

  const getTypeStyles = () => {
    switch (notification.type) {
      case "success":
        return "bg-green-500/40 text-green-400 font-bold text-sm border-green-500/30";
      case "error":
        return "bg-red-500/40 text-red-400 font-bold text-sm border-red-500/30";
      default:
        return "bg-green-500/40 text-green-400 font-bold text-sm border-green-500/30";
    }
  };

  return (
    <div
      className={`transform transition-all duration-300 ease-in-out ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      } ${getTypeStyles()} min-w-[300px] max-w-[600px] w-auto rounded-md border backdrop-blur-sm p-3 shadow-lg flex justify-between items-center`}
    >
      <div className="flex-1 pr-4 text-center">
        {typeof notification.message === "object" ? JSON.stringify(notification.message) : notification.message}
      </div>
      <button
        onClick={handleClose}
        className="text-text-light opacity-60 hover:opacity-100 transition-opacity focus:outline-none"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};
