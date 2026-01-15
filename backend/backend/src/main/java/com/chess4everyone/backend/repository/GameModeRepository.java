package com.chess4everyone.backend.repository;

import com.chess4everyone.backend.entity.GameMode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.List;

@Repository
public interface GameModeRepository extends JpaRepository<GameMode, Long> {
    Optional<GameMode> findByName(String name);
    List<GameMode> findAll();
}
