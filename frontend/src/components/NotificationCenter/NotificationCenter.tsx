import React, { useState, useEffect } from "react";
import { subscribeToNotifications, markNotificationAsRead, type NotificationDto, getAllNotifications } from "../../api/notifications";
import { deepgramTTSService } from "../../utils/deepgramTTSService";
import { FiBell, FiX, FiCheckCircle } from "react-icons/fi";
import "./NotificationCenter.css";

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load initial notifications
    loadNotifications();

    // Subscribe to SSE stream
    const eventSource = subscribeToNotifications((newNotif) => {
      console.log("🔔 New notification received:", newNotif);
      setNotifications((prev) => [newNotif, ...prev]);

      // Announce new notification via TTS
      if (newNotif.type === "GAME_MODE") {
        deepgramTTSService.speak({
          text: `Admin notification: ${newNotif.title}. ${newNotif.message}`,
          voice: "aura-asteria-en",
          priority: "high",
        });
      } else if (newNotif.type === "VOICE_COMMAND") {
        deepgramTTSService.speak({
          text: `Voice command update: ${newNotif.message}`,
          voice: "aura-asteria-en",
          priority: "high",
        });
      }
    });

    return () => {
      eventSource.close();
    };
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await getAllNotifications();
      setNotifications(response.data);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className={`notification-center ${isOpen ? "open" : ""}`}>
      <div className="notification-header">
        <div className="notification-title">
          <FiBell className="bell-icon" />
          <h3>Notifications</h3>
          {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
        </div>
        <button className="close-btn" onClick={onClose}>
          <FiX />
        </button>
      </div>

      <div className="notification-list">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="empty">No notifications yet</div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              className={`notification-item ${!notif.isRead ? "unread" : ""} ${notif.type.toLowerCase()}`}
            >
              <div className="notification-content">
                <div className="notification-title-row">
                  <h4>{notif.title}</h4>
                  {!notif.isRead && <span className="new-badge">NEW</span>}
                </div>
                <p className="notification-message">{notif.message}</p>
                <span className="notification-time">
                  {new Date(notif.createdAt).toLocaleString()}
                </span>
              </div>
              <button
                className="mark-read-btn"
                onClick={() => handleMarkAsRead(notif.id)}
                title="Mark as read"
              >
                <FiCheckCircle />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationCenter;
