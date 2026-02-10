import http from "./http";

export interface NotificationDto {
  id: number;
  title: string;
  message: string;
  payload: string | null;
  type: 'GAME_MODE' | 'VOICE_COMMAND' | 'SYSTEM';
  isRead: boolean;
  createdAt: string;
}

/**
 * Fetch all notifications
 */
export const getAllNotifications = async () => {
  return http.get<NotificationDto[]>("/api/notifications");
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (id: number) => {
  return http.patch<NotificationDto>(`/api/notifications/${id}/mark-read`);
};

/**
 * Subscribe to notifications via Server-Sent Events
 */
export const subscribeToNotifications = (onNotification: (notif: NotificationDto) => void) => {
  const eventSource = new EventSource("/api/notifications/stream", {
    withCredentials: true,
  });

  eventSource.addEventListener("notification", (event: any) => {
    try {
      const data = JSON.parse(event.data);
      onNotification(data);
    } catch (e) {
      console.error("Failed to parse notification:", e);
    }
  });

  eventSource.addEventListener("ping", () => {
    console.log("📡 Notification ping received");
  });

  eventSource.onerror = (err) => {
    console.error("📡 SSE connection error:", err);
    eventSource.close();
  };

  return eventSource;
};