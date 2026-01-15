package com.chess4everyone.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.chess4everyone.backend.entity.VoiceCommand;

@Repository
public interface VoiceCommandRepository extends JpaRepository<VoiceCommand, Long> {
    Optional<VoiceCommand> findByCommandName(String commandName);
    List<VoiceCommand> findByActiveTrue();
    List<VoiceCommand> findByIntent(String intent);
}
