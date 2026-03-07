package com.chess4everyone.backend.controller;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.chess4everyone.backend.entity.User;
import com.chess4everyone.backend.entity.UserProfile;
import com.chess4everyone.backend.repo.UserRepository;
import com.chess4everyone.backend.repository.UserProfileRepository;
import com.chess4everyone.backend.security.JwtService;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/rankings")
public class RankingsController {

    private final UserRepository userRepo;
    private final UserProfileRepository profileRepo;
    private final JwtService jwtService;

    public record PlayerRankDto(
        Long rank,
        Long userId,
        String name,
        Integer rating,
        Integer ratingChangeThisMonth,
        Integer gamesPlayed,
        Double winRate,
        Integer wins,
        Integer losses,
        Integer draws,
        Integer currentStreak,
        Integer bestStreak,
        boolean isCurrentUser
    ) {}

    public record RankingsResponse(
        List<PlayerRankDto> globalRankings,
        PlayerRankDto currentUserRank,
        long totalPlayers
    ) {}

    @GetMapping
    public ResponseEntity<?> getRankings(
            HttpServletRequest req,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        try {
            // Extract current user id from JWT cookie (optional)
            Long currentUserId = extractUserId(req);

            // Fetch all profiles sorted by rating desc
            List<UserProfile> allProfiles = profileRepo.findAll().stream()
                .sorted(Comparator.comparingInt(UserProfile::getRating).reversed())
                .collect(Collectors.toList());

            long totalPlayers = allProfiles.size();

            // Paginate
            int fromIdx = page * size;
            int toIdx   = Math.min(fromIdx + size, allProfiles.size());
            List<UserProfile> pageProfiles = (fromIdx < allProfiles.size())
                ? allProfiles.subList(fromIdx, toIdx)
                : List.of();

            List<PlayerRankDto> rankings = new ArrayList<>();
            for (int i = 0; i < pageProfiles.size(); i++) {
                UserProfile p = pageProfiles.get(i);
                long globalRank = fromIdx + i + 1;
                rankings.add(toDto(p, globalRank, currentUserId));
            }

            // Current user rank (always included)
            PlayerRankDto currentUserRank = null;
            if (currentUserId != null) {
                for (int i = 0; i < allProfiles.size(); i++) {
                    if (allProfiles.get(i).getUser().getId().equals(currentUserId)) {
                        currentUserRank = toDto(allProfiles.get(i), i + 1L, currentUserId);
                        break;
                    }
                }
            }

            return ResponseEntity.ok(new RankingsResponse(rankings, currentUserRank, totalPlayers));

        } catch (Exception e) {
            log.error("Error fetching rankings: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of("error", "Failed to load rankings"));
        }
    }

    @GetMapping("/search")
    public ResponseEntity<?> searchPlayers(
            @RequestParam String q,
            HttpServletRequest req) {
        try {
            Long currentUserId = extractUserId(req);
            String query = q.toLowerCase().trim();

            List<UserProfile> allProfiles = profileRepo.findAll().stream()
                .sorted(Comparator.comparingInt(UserProfile::getRating).reversed())
                .collect(Collectors.toList());

            List<PlayerRankDto> results = new ArrayList<>();
            for (int i = 0; i < allProfiles.size(); i++) {
                UserProfile p = allProfiles.get(i);
                if (p.getUser().getName().toLowerCase().contains(query)) {
                    results.add(toDto(p, i + 1L, currentUserId));
                }
            }

            return ResponseEntity.ok(results);
        } catch (Exception e) {
            log.error("Search error: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of("error", "Search failed"));
        }
    }

    private PlayerRankDto toDto(UserProfile p, long rank, Long currentUserId) {
        User user = p.getUser();
        return new PlayerRankDto(
            rank,
            user.getId(),
            user.getName(),
            p.getRating()               != null ? p.getRating()               : 1200,
            p.getRatingChangeThisMonth() != null ? p.getRatingChangeThisMonth() : 0,
            p.getGamesPlayed()          != null ? p.getGamesPlayed()          : 0,
            p.getWinRate()              != null ? p.getWinRate()              : 0.0,
            p.getWins()                 != null ? p.getWins()                 : 0,
            p.getLosses()               != null ? p.getLosses()               : 0,
            p.getDraws()                != null ? p.getDraws()                : 0,
            p.getCurrentStreak()        != null ? p.getCurrentStreak()        : 0,
            p.getBestStreak()           != null ? p.getBestStreak()           : 0,
            currentUserId != null && currentUserId.equals(user.getId())
        );
    }

    private Long extractUserId(HttpServletRequest req) {
        if (req.getCookies() == null) return null;
        for (Cookie c : req.getCookies()) {
            if ("ch4e_access".equals(c.getName())) {
                try {
                    String sub = jwtService.parseToken(c.getValue()).getBody().getSubject();
                    return Long.valueOf(sub);
                } catch (Exception ignored) {}
            }
        }
        return null;
    }
}