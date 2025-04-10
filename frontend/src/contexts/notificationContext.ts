import { ReactNode, createContext } from "react";

export type NotificationType = "success" | "error";

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number; // Duration in milliseconds
}

export interface NotificationContextType {
  state: {
    notifications: Notification[];
  };
  actions: {
    addNotification: (notification: Omit<Notification, "id">) => void;
    removeNotification: (id: string) => void;
    clearAllNotifications: () => void;
  };
}

export const NotificationContext = createContext<NotificationContextType | null>(null);

export interface NotificationProviderProps {
  children: ReactNode;
}
