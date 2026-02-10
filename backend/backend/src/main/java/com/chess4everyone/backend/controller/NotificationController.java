package com.chess4everyone.backend.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.chess4everyone.backend.dto.admin.NotificationDto;
import com.chess4everyone.backend.service.admin.NotificationService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@Slf4j
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping("")
    public ResponseEntity<List<NotificationDto>> getAll() {
        return ResponseEntity.ok(notificationService.getAllNotifications());
    }

    @GetMapping("/stream")
    public SseEmitter stream() {
        String sessionId = UUID.randomUUID().toString();
        log.info("📡 New SSE subscription: {}", sessionId);
        return notificationService.subscribe(sessionId);
    }

    @PatchMapping("/{id}/mark-read")
    public ResponseEntity<NotificationDto> markRead(@PathVariable Long id) {
        NotificationDto dto = notificationService.markAsRead(id);
        return ResponseEntity.ok(dto);
    }
}
