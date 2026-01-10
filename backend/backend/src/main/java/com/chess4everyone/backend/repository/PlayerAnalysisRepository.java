package com.chess4everyone.backend.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.chess4everyone.backend.entity.PlayerAnalysis;

public interface PlayerAnalysisRepository extends JpaRepository<PlayerAnalysis, Long> {
    Optional<PlayerAnalysis> findByUserId(Long userId);
    boolean existsByUserId(Long userId);
}
