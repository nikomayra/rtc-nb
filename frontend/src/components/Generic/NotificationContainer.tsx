import { useEffect, useState } from "react";
import { Notification } from "../../contexts/notificationContext";

interface NotificationContainerProps {
  notifications: Notification[];
  removeNotification: (id: string) => void;
}

export const NotificationContainer = ({ notifications, removeNotification }: NotificationContainerProps) => {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-3 items-center">
      {notifications.map((notification) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
};

interface NotificationToastProps {
  notification: Notification;
  onClose: () => void;
}

const NotificationToast = ({ notification, onClose }: NotificationToastProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Animate in
    setTimeout(() => setIsVisible(true), 10);

    // Auto close
    if (notification.duration) {
      const timeout = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300); // Wait for exit animation
      }, notification.duration - 300); // Subtract exit animation time

      return () => clearTimeout(timeout);
    }
  }, [notification.duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for exit animation
  };

  const getTypeStyles = () => {
    switch (notification.type) {
      case "info":
        return "bg-blue-500/40 text-blue-400 font-bold text-sm border-blue-500/30";
      case "success":
        return "bg-green-500/40 text-green-400 font-bold text-sm border-green-500/30";
      case "warning":
        return "bg-yellow-500/40 text-yellow-400 font-bold text-sm border-yellow-500/30";
      case "error":
        return "bg-red-500/40 text-red-400 font-bold text-sm border-red-500/30";
      default:
        return "bg-primary/40 text-primary font-bold text-sm border-primary/30";
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
