package com.chess4everyone.backend.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.chess4everyone.backend.entity.Game;
import com.chess4everyone.backend.entity.GameAnalysis;

public interface GameAnalysisRepository extends JpaRepository<GameAnalysis, Long> {
    Optional<GameAnalysis> findByGame(Game game);
    Optional<GameAnalysis> findByGameId(Long gameId);
}
