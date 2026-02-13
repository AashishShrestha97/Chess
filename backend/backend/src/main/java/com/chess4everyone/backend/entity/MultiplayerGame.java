package com.chess4everyone.backend.entity;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "multiplayer_games")
public class MultiplayerGame {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "game_uuid", nullable = false, unique = true)
    private String gameUuid; // UUID for WebSocket room

    @ManyToOne
    @JoinColumn(name = "white_player_id", nullable = false)
    private User whitePlayer;

    @ManyToOne
    @JoinColumn(name = "black_player_id", nullable = false)
    private User blackPlayer;

    @Column(name = "time_control", nullable = false)
    private String timeControl; // e.g. "5+0", "10+0"

    @Column(name = "game_type", nullable = false)
    private String gameType; // "STANDARD" or "VOICE"

    @Column(name = "status", nullable = false)
    private String status; // "WAITING", "ACTIVE", "COMPLETED", "ABANDONED"

    @Column(name = "result")
    private String result; // "WHITE_WIN", "BLACK_WIN", "DRAW", null if ongoing

    @Column(name = "termination_reason")
    private String terminationReason;

    @Lob
    @Column(name = "pgn", columnDefinition = "LONGTEXT")
    private String pgn;

    @Lob
    @Column(name = "moves_json", columnDefinition = "LONGTEXT")
    private String movesJson;

    @Column(name = "current_fen")
    private String currentFen;

    @Column(name = "white_time_remaining_ms")
    private Long whiteTimeRemainingMs;

    @Column(name = "black_time_remaining_ms")
    private Long blackTimeRemainingMs;

    @Column(name = "last_move_at")
    private Instant lastMoveAt;

    @CreationTimestamp
    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;
}