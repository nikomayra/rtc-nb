import { useState, useCallback } from "react";
import { NotificationContext, NotificationProviderProps, Notification } from "../contexts/notificationContext";
import { NotificationContainer } from "../components/Generic/NotificationContainer";

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
      <NotificationContainer />
    </NotificationContext.Provider>
  );
};
