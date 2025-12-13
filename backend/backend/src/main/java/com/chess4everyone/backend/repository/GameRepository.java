package com.chess4everyone.backend.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.chess4everyone.backend.entity.Game;
import com.chess4everyone.backend.entity.User;

public interface GameRepository extends JpaRepository<Game, Long> {
    List<Game> findByUserOrderByPlayedAtDesc(User user);
    List<Game> findTop5ByUserOrderByPlayedAtDesc(User user);
}