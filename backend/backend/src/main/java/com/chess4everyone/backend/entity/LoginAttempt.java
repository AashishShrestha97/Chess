package com.chess4everyone.backend.entity;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Tracks login attempts for rate limiting and security purposes.
 */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "login_attempts", indexes = {
    @Index(name = "idx_email_time", columnList = "email, attempt_time")
})
public class LoginAttempt {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String email;
    
    @CreationTimestamp
    @Column(name = "attempt_time")
    private Instant attemptTime;
    
    @Column(nullable = false)
    private Boolean success;
    
    @Column(name = "ip_address")
    private String ipAddress;
}
