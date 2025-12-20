package com.chess4everyone.backend.security;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import com.chess4everyone.backend.config.JwtProperties;
import com.chess4everyone.backend.entity.User;
import com.chess4everyone.backend.entity.UserProfile;
import com.chess4everyone.backend.repo.UserRepository;
import com.chess4everyone.backend.repository.UserProfileRepository;
import com.chess4everyone.backend.service.RefreshTokenService;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {
    
    private final UserRepository userRepo;
    private final JwtService jwtService;
    private final RefreshTokenService refreshService;
    private final JwtProperties props;
    private final CookieUtils cookieUtils;
    private final UserProfileRepository profileRepo;

    public OAuth2SuccessHandler(
            UserRepository userRepo,
            JwtService jwtService,
            RefreshTokenService refreshService,
            JwtProperties props,
            CookieUtils cookieUtils,
            UserProfileRepository profileRepo) {
        this.userRepo = userRepo;
        this.jwtService = jwtService;
        this.refreshService = refreshService;
        this.props = props;
        this.cookieUtils = cookieUtils;
        this.profileRepo = profileRepo;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
            Authentication authentication) throws IOException, ServletException {
        
        try {
            System.out.println("🔐 OAuth2 authentication successful");
            
            OAuth2User oauthUser = (OAuth2User) authentication.getPrincipal();
            Map<String, Object> attrs = oauthUser.getAttributes();
            
            String provider = "GOOGLE";
            String sub = (String) attrs.get("sub");
            String email = (String) attrs.get("email");
            
            System.out.println("👤 OAuth user - Provider: " + provider + ", Email: " + email);
            
            User user = userRepo.findByProviderAndProviderId(provider, sub)
                .orElseThrow(() -> new RuntimeException("User should have been created by CustomOAuth2UserService"));
            
            System.out.println("✅ User found: " + user.getEmail());
            
            // ✅ Check if profile exists, create if not
            if (!profileRepo.existsByUserId(user.getId())) {
                System.out.println("🆕 Creating profile for OAuth user: " + user.getEmail());
                createDefaultProfile(user);
            } else {
                System.out.println("✅ Profile already exists for: " + user.getEmail());
            }
            
            // Generate tokens
            String accessToken = jwtService.generateAccessToken(
                user.getId().toString(),
                Map.of("email", user.getEmail(), "name", user.getName())
            );
            
            String refreshToken = jwtService.generateRefreshToken(user.getId().toString());
            
            System.out.println("🎫 Tokens generated for OAuth user");
            
            // Save refresh token
            refreshService.save(
                refreshToken,
                user,
                Instant.now().plusSeconds(props.getRefreshTokenDays() * 24L * 60 * 60)
            );
            
            // Set cookies
            cookieUtils.addHttpOnlyCookie(
                response,
                "ch4e_access",
                accessToken,
                props.isCookieSecure(),
                props.getCookieDomain(),
                props.getAccessTokenMin() * 60L,
                "/"
            );
            
            cookieUtils.addHttpOnlyCookie(
                response,
                "ch4e_refresh",
                refreshToken,
                props.isCookieSecure(),
                props.getCookieDomain(),
                props.getRefreshTokenDays() * 24L * 60 * 60,
                "/"
            );
            
            System.out.println("✅ OAuth login successful, redirecting to frontend");
            
            // Redirect to frontend
            response.sendRedirect("http://localhost:5173/home");
            
        } catch (Exception e) {
            System.err.println("❌ OAuth success handler error: " + e.getMessage());
            e.printStackTrace();
            response.sendRedirect("http://localhost:5173/login?error=oauth_failed");
        }
    }
    
    private void createDefaultProfile(User user) {
        UserProfile profile = new UserProfile();
        profile.setUser(user);
        profile.setRating(1200);
        profile.setRatingChangeThisMonth(0);
        profile.setGlobalRank(999999L);
        profile.setGamesPlayed(0);
        profile.setWinRate(0.0);
        profile.setCurrentStreak(0);
        profile.setBestStreak(0);
        profile.setTimePlayedMinutes(0L);
        profile.setFavoriteOpening("N/A");
        profile.setWins(0);
        profile.setDraws(0);
        profile.setLosses(0);
        profile.setOpeningScore(50);
        profile.setMiddleGameScore(50);
        profile.setEndgameScore(50);
        profile.setTacticsScore(50);
        profile.setTimeManagementScore(50);
        profile.setBlunderAvoidanceScore(50);
        profile.setOpeningScoreChange(0);
        profile.setMiddleGameScoreChange(0);
        profile.setEndgameScoreChange(0);
        profile.setTacticsScoreChange(0);
        profile.setTimeManagementScoreChange(0);
        profile.setBlunderAvoidanceScoreChange(0);
        
        profileRepo.save(profile);
        System.out.println("✅ Profile created for OAuth user: " + user.getEmail());
    }
}