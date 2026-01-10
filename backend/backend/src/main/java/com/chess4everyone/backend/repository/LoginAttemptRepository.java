package com.chess4everyone.backend.repository;

import java.time.Instant;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.chess4everyone.backend.entity.LoginAttempt;

public interface LoginAttemptRepository extends JpaRepository<LoginAttempt, Long> {
    List<LoginAttempt> findByEmailAndAttemptTimeAfter(String email, Instant afterTime);
    List<LoginAttempt> findByEmailOrderByAttemptTimeDesc(String email);
}
