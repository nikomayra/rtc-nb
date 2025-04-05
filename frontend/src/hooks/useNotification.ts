import { useCallback, useContext } from "react";
import { NotificationContext, NotificationType } from "../contexts/notificationContext";

export const useNotification = () => {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }

  const { addNotification, removeNotification, clearAllNotifications } = context.actions;

  const showNotification = useCallback(
    (message: string, type: NotificationType = "info", duration = 5000) => {
      addNotification({ message, type, duration });
    },
    [addNotification]
  );

  const showSuccess = useCallback(
    (message: string, duration = 2000) => {
      showNotification(message, "success", duration);
    },
    [showNotification]
  );

  // const showInfo = (message: string, duration = 5000) => {
  //   showNotification(message, "info", duration);
  // };

  const showWarning = useCallback(
    (message: string, duration = 5000) => {
      showNotification(message, "warning", duration);
    },
    [showNotification]
  );

  const showError = useCallback(
    (message: string, duration = 5000) => {
      showNotification(message, "error", duration);
    },
    [showNotification]
  );

  return {
    showNotification,
    showSuccess,
    // showInfo,
    showWarning,
    showError,
    removeNotification,
    clearAllNotifications,
    notifications: context.state.notifications,
  };
};
