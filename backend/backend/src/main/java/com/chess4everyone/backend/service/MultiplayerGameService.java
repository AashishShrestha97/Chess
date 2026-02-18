package com.chess4everyone.backend.service;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.chess4everyone.backend.entity.MultiplayerGame;
import com.chess4everyone.backend.entity.User;
import com.chess4everyone.backend.repository.MultiplayerGameRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class MultiplayerGameService {

    private final MultiplayerGameRepository multiplayerGameRepository;

    public MultiplayerGame createGame(User whitePlayer, User blackPlayer,
                                      String timeControl, String gameType) {
        MultiplayerGame game = new MultiplayerGame();
        game.setGameUuid(UUID.randomUUID().toString());
        game.setWhitePlayer(whitePlayer);
        game.setBlackPlayer(blackPlayer);
        game.setTimeControl(timeControl);
        game.setGameType(gameType != null ? gameType : "STANDARD");
        game.setStatus("WAITING");
        game.setCurrentFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");

        // Parse time control for initial clock values
        long initialMs = parseTimeControlToMs(timeControl);
        game.setWhiteTimeRemainingMs(initialMs);
        game.setBlackTimeRemainingMs(initialMs);

        return multiplayerGameRepository.save(game);
    }

    public void startGame(String gameUuid) {
        multiplayerGameRepository.findByGameUuid(gameUuid).ifPresent(game -> {
            game.setStatus("ACTIVE");
            game.setStartedAt(Instant.now());
            multiplayerGameRepository.save(game);
        });
    }

    public void applyMove(String gameUuid, String from, String to,
                          String promotion, String san, String fen) {
        multiplayerGameRepository.findByGameUuid(gameUuid).ifPresent(game -> {
            game.setCurrentFen(fen);
            game.setLastMoveAt(Instant.now());

            // Append to PGN (simplified)
            String currentPgn = game.getPgn() != null ? game.getPgn() : "";
            game.setPgn(currentPgn + (currentPgn.isEmpty() ? "" : " ") + san);

            multiplayerGameRepository.save(game);
        });
    }

    public void updateTime(String gameUuid, long whiteMs, long blackMs) {
        multiplayerGameRepository.findByGameUuid(gameUuid).ifPresent(game -> {
            game.setWhiteTimeRemainingMs(whiteMs);
            game.setBlackTimeRemainingMs(blackMs);
            multiplayerGameRepository.save(game);
        });
    }

    public void endGame(String gameUuid, String result, String reason) {
        multiplayerGameRepository.findByGameUuid(gameUuid).ifPresent(game -> {
            game.setStatus("COMPLETED");
            game.setResult(result);
            game.setTerminationReason(reason);
            game.setCompletedAt(Instant.now());
            game.setEndedAt(Instant.now());
            multiplayerGameRepository.save(game);
        });
    }

    public Optional<MultiplayerGame> getGameByUuid(String gameUuid) {
        return multiplayerGameRepository.findByGameUuid(gameUuid);
    }

    public Optional<MultiplayerGame> getGameById(Long gameId) {
        return multiplayerGameRepository.findById(gameId);
    }

    private long parseTimeControlToMs(String timeControl) {
        try {
            String[] parts = timeControl.split("\\+");
            long minutes = Long.parseLong(parts[0]);
            return minutes * 60 * 1000;
        } catch (Exception e) {
            return 10 * 60 * 1000; // default 10 minutes
        }
    }
}