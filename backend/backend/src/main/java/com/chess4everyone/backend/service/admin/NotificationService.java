package com.chess4everyone.backend.service.admin;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.chess4everyone.backend.dto.admin.NotificationDto;
import com.chess4everyone.backend.entity.Notification;
import com.chess4everyone.backend.repository.NotificationRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final NotificationRepository notificationRepository;

    // Active SSE emitters keyed by session id
    private final Map<String, SseEmitter> emitters = new ConcurrentHashMap<>();

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /**
     * Create notification and broadcast to connected clients
     */
    public NotificationDto createNotification(String title, String message, String type, String payload) {
        log.info("🔔 Creating notification: {} - {}", type, title);

        Notification n = new Notification();
        n.setTitle(title);
        n.setMessage(message);
        n.setType(type);
        n.setPayload(payload);
        n.setIsRead(false);

        Notification saved = notificationRepository.save(n);

        NotificationDto dto = toDto(saved);

        // Broadcast to SSE clients
        broadcast(dto);

        return dto;
    }

    public List<NotificationDto> getAllNotifications() {
        return notificationRepository.findAll().stream().map(this::toDto).toList();
    }

    public NotificationDto markAsRead(Long id) {
        Notification n = notificationRepository.findById(id).orElseThrow(() -> new RuntimeException("Notification not found"));
        n.setIsRead(true);
        Notification updated = notificationRepository.save(n);
        return toDto(updated);
    }

    public SseEmitter subscribe(String sessionId) {
        SseEmitter emitter = new SseEmitter(0L); // no timeout
        emitters.put(sessionId, emitter);

        emitter.onCompletion(() -> emitters.remove(sessionId));
        emitter.onTimeout(() -> emitters.remove(sessionId));
        emitter.onError((e) -> emitters.remove(sessionId));

        // Send an initial ping
        try {
            emitter.send(SseEmitter.event().name("ping").data("connected"));
        } catch (Exception e) {
            log.warn("Failed to send initial ping to emitter: {}", e.getMessage());
        }

        return emitter;
    }

    private void broadcast(NotificationDto dto) {
        emitters.forEach((id, emitter) -> {
            try {
                emitter.send(SseEmitter.event().name("notification").data(dto));
            } catch (Exception e) {
                log.warn("Failed to send notification to {}: {}", id, e.getMessage());
                emitters.remove(id);
            }
        });
    }

    private NotificationDto toDto(Notification n) {
        return new NotificationDto(
            n.getId(),
            n.getTitle(),
            n.getMessage(),
            n.getPayload(),
            n.getType(),
            n.getIsRead(),
            n.getCreatedAt() != null ? n.getCreatedAt().format(FORMATTER) : null
        );
    }
}
