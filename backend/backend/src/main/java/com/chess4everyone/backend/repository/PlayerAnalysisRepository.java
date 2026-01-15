package com.chess4everyone.backend.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.chess4everyone.backend.entity.PlayerAnalysis;
import com.chess4everyone.backend.entity.User;

public interface PlayerAnalysisRepository extends JpaRepository<PlayerAnalysis, Long> {
    Optional<PlayerAnalysis> findByUserId(Long userId);
    Optional<PlayerAnalysis> findByUser(User user);
    boolean existsByUserId(Long userId);
}
