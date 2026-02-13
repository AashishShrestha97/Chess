package com.chess4everyone.backend.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.chess4everyone.backend.repo.UserRepository;
import com.chess4everyone.backend.service.MultiplayerGameService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@RestController
@RequestMapping("/api/multiplayer")
@RequiredArgsConstructor
@Slf4j
public class MultiplayerGameController {

    private final MultiplayerGameService multiplayerGameService;
    private final UserRepository userRepository;

    @GetMapping("/game/{gameUuid}")
    public ResponseEntity<?> getGame(@PathVariable String gameUuid, Authentication auth) {
        return multiplayerGameService.getGameByUuid(gameUuid)
                .<ResponseEntity<?>>map(game -> ResponseEntity.ok(Map.of(
                        "gameUuid", game.getGameUuid(),
                        "whitePlayer", game.getWhitePlayer().getName(),
                        "blackPlayer", game.getBlackPlayer().getName(),
                        "timeControl", game.getTimeControl(),
                        "gameType", game.getGameType(),
                        "status", game.getStatus(),
                        "currentFen", game.getCurrentFen(),
                        "whiteTimeRemainingMs", game.getWhiteTimeRemainingMs(),
                        "blackTimeRemainingMs", game.getBlackTimeRemainingMs()
                )))
                .orElse(ResponseEntity.notFound().build());
    }
}