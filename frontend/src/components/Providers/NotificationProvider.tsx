import { useState, useCallback, useEffect } from "react";
import { NotificationContext, NotificationProviderProps, Notification } from "../../contexts/notificationContext";
import { NotificationContainer } from "../Generic/NotificationContainer";

// Define interface for our custom event
interface ApiErrorEvent extends CustomEvent {
  detail: {
    message: string;
    status?: number;
    url?: string;
  };
}

export const NotificationProvider = ({ children }: NotificationProviderProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id));
  }, []);

  const addNotification = useCallback(
    ({ type, message, duration = 5000 }: Omit<Notification, "id">) => {
      // Generate a more unique ID by combining timestamp with a random string
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      setNotifications((prev) => {
        // Limit to maximum 5 notifications, removing oldest ones if needed
        const maxNotifications = 5;
        const newNotifications = [...prev, { id, type, message, duration }];

        if (newNotifications.length > maxNotifications) {
          return newNotifications.slice(-maxNotifications);
        }

        return newNotifications;
      });

      // Auto-remove notification after duration
      if (duration && duration > 0) {
        setTimeout(() => {
          removeNotification(id);
        }, duration);
      }
    },
    [removeNotification]
  );

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Listen for API errors and show error notifications
  useEffect(() => {
    const handleApiError = (event: Event) => {
      const { detail } = event as ApiErrorEvent;
      addNotification({
        type: "error",
        message: detail.message,
        duration: 7000, // Show API errors a bit longer
      });
    };

    window.addEventListener("api-error", handleApiError);

    return () => {
      window.removeEventListener("api-error", handleApiError);
    };
  }, [addNotification]);

  return (
    <NotificationContext.Provider
      value={{
        state: { notifications },
        actions: {
          addNotification,
          removeNotification,
          clearAllNotifications,
        },
      }}
    >
      {children}
      <NotificationContainer notifications={notifications} removeNotification={removeNotification} />
    </NotificationContext.Provider>
  );
};
