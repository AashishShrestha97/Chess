package com.chess4everyone.backend.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.chess4everyone.backend.entity.Game;
import com.chess4everyone.backend.entity.User;
import com.chess4everyone.backend.entity.GameMode;

public interface GameRepository extends JpaRepository<Game, Long> {
    List<Game> findByUserOrderByPlayedAtDesc(User user);
    List<Game> findTop5ByUserOrderByPlayedAtDesc(User user);
    List<Game> findByWhitePlayerOrBlackPlayerOrderByPlayedAtDesc(User whitePlayer, User blackPlayer);
    List<Game> findTop5ByWhitePlayerOrBlackPlayerOrderByPlayedAtDesc(User whitePlayer, User blackPlayer);
    
    // Game mode queries
    List<Game> findByUserAndGameModeOrderByPlayedAtDesc(User user, GameMode gameMode);
    List<Game> findByUserAndGameMode(User user, GameMode gameMode);
    long countByUserAndGameMode(User user, GameMode gameMode);
}