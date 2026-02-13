package com.chess4everyone.backend.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.chess4everyone.backend.entity.MultiplayerGame;
import com.chess4everyone.backend.entity.User;

@Repository
public interface MultiplayerGameRepository extends JpaRepository<MultiplayerGame, Long> {
    List<MultiplayerGame> findByWhitePlayerOrBlackPlayerOrderByCreatedAtDesc(User white, User black);
    List<MultiplayerGame> findByStatus(String status);
}