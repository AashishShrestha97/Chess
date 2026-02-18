package com.chess4everyone.backend.controller;

import java.time.Instant;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.chess4everyone.backend.config.JwtProperties;
import com.chess4everyone.backend.dto.LoginRequest;
import com.chess4everyone.backend.dto.RegisterRequest;
import com.chess4everyone.backend.dto.UserResponse;
import com.chess4everyone.backend.entity.User;
import com.chess4everyone.backend.repo.UserRepository;
import com.chess4everyone.backend.security.CookieUtils;
import com.chess4everyone.backend.security.JwtService;
import com.chess4everyone.backend.service.RefreshTokenService;
import com.chess4everyone.backend.service.UserService;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepo;
    private final UserService userService;
    private final JwtService jwtService;
    private final RefreshTokenService refreshService;
    private final JwtProperties props;
    private final CookieUtils cookieUtils;
    private final BCryptPasswordEncoder encoder;

    public AuthController(UserRepository userRepo, 
                         UserService userService,
                         JwtService jwtService,
                         RefreshTokenService refreshService, 
                         JwtProperties props,
                         CookieUtils cookieUtils, 
                         BCryptPasswordEncoder encoder) {
        this.userRepo = userRepo;
        this.userService = userService;
        this.jwtService = jwtService;
        this.refreshService = refreshService;
        this.props = props;
        this.cookieUtils = cookieUtils;
        this.encoder = encoder;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest req) {
        try {
            System.out.println("📝 Register request received for: " + req.email());
            userService.register(req);
            System.out.println("✅ Registration successful for: " + req.email());
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Registration successful! You can now log in."
            ));
        } catch (IllegalArgumentException e) {
            System.out.println("❌ Registration failed: " + e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        } catch (Exception e) {
            System.out.println("❌ Unexpected error during registration: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "message", "Registration failed. Please try again."
            ));
        }
    }

    @GetMapping("/token")
    public ResponseEntity<?> getToken(HttpServletRequest req) {
        String token = null;
        if (req.getCookies() != null) {
            for (Cookie c : req.getCookies()) {
                if ("ch4e_access".equals(c.getName())) {
                    token = c.getValue();
                    break;
                }
            }
        }
        if (token == null) return ResponseEntity.status(401).body("No token");
        return ResponseEntity.ok(Map.of("token", token));
    }

    /**
     * Returns the current access token for use in WebSocket URLs.
     * WebSocket handshakes don't support Authorization headers, so the token
     * is passed as a query param: ws://...?token=JWT
     *
     * Fix: simply validate and return the existing cookie token —
     * no need to generate a new one (that was causing the 500).
     */
    @GetMapping("/ws-token")
    public ResponseEntity<?> wsToken(HttpServletRequest req) {
        String token = null;

        if (req.getCookies() != null) {
            for (Cookie c : req.getCookies()) {
                if ("ch4e_access".equals(c.getName())) {
                    token = c.getValue();
                    break;
                }
            }
        }

        if (token == null || token.isBlank()) {
            System.out.println("❌ ws-token: no ch4e_access cookie");
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        // Validate the token is still good before handing it to WebSocket
        try {
            jwtService.parseToken(token).getBody().getSubject();
        } catch (Exception e) {
            System.out.println("❌ ws-token: invalid/expired token: " + e.getMessage());
            return ResponseEntity.status(401).body(Map.of("error", "Token expired, please log in again"));
        }

        return ResponseEntity.ok(Map.of("token", token));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest req, HttpServletResponse res) {
        try {
            System.out.println("🔐 Login attempt for email: " + req.email());
            
            User u = userRepo.findByEmail(req.email())
                .orElseThrow(() -> {
                    System.out.println("❌ User not found: " + req.email());
                    return new RuntimeException("Invalid email or password");
                });
            
            System.out.println("👤 User found: " + u.getEmail() + ", Provider: " + u.getProvider());
            
            if (!"LOCAL".equals(u.getProvider())) {
                System.out.println("❌ User registered with " + u.getProvider() + ", cannot use password login");
                return ResponseEntity.status(403).body(Map.of(
                    "success", false,
                    "message", "This account is registered with " + u.getProvider() + ". Please use " + u.getProvider() + " to log in."
                ));
            }
            
            if (!u.isEnabled()) {
                System.out.println("❌ User not enabled: " + req.email());
                return ResponseEntity.status(403).body(Map.of(
                    "success", false,
                    "message", "Email not verified. Please check your inbox."
                ));
            }
            
            if (!encoder.matches(req.password(), u.getPassword())) {
                System.out.println("❌ Invalid password for: " + req.email());
                throw new RuntimeException("Invalid email or password");
            }
            
            System.out.println("✅ Password verified for: " + req.email());

            String access = jwtService.generateAccessToken(
                u.getId().toString(), 
                Map.of("email", u.getEmail(), "name", u.getName())
            );
            String refresh = jwtService.generateRefreshToken(u.getId().toString());

            System.out.println("🎫 Tokens generated for: " + req.email());

            refreshService.save(
                refresh, 
                u, 
                Instant.now().plusSeconds(props.getRefreshTokenDays() * 24L * 60 * 60)
            );

            cookieUtils.addHttpOnlyCookie(
                res, 
                "ch4e_access", 
                access, 
                props.isCookieSecure(), 
                props.getCookieDomain(), 
                props.getAccessTokenMin() * 60L, 
                "/"
            );
            cookieUtils.addHttpOnlyCookie(
                res, 
                "ch4e_refresh", 
                refresh, 
                props.isCookieSecure(), 
                props.getCookieDomain(), 
                props.getRefreshTokenDays() * 24L * 60 * 60, 
                "/"
            );

            System.out.println("✅ Login successful for: " + req.email());

            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Login successful",
                "user", Map.of(
                    "id", u.getId(),
                    "name", u.getName(),
                    "email", u.getEmail()
                )
            ));
            
        } catch (RuntimeException e) {
            System.out.println("❌ Login failed: " + e.getMessage());
            return ResponseEntity.status(401).body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        } catch (Exception e) {
            System.out.println("❌ Unexpected error during login: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "message", "Login failed. Please try again."
            ));
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(HttpServletRequest req, HttpServletResponse res) {
        try {
            System.out.println("🔄 Refresh token request received");
            
            String refresh = null;
            if (req.getCookies() != null) {
                for (Cookie c : req.getCookies()) {
                    if ("ch4e_refresh".equals(c.getName())) {
                        refresh = c.getValue();
                        break;
                    }
                }
            }
            
            if (refresh == null) {
                System.out.println("❌ No refresh token found in cookies");
                return ResponseEntity.status(401).body(Map.of(
                    "success", false,
                    "message", "No refresh token"
                ));
            }

            var record = refreshService.find(refresh)
                .orElseThrow(() -> {
                    System.out.println("❌ Invalid refresh token");
                    return new RuntimeException("Invalid refresh token");
                });
            
            if (record.getExpiry().isBefore(Instant.now())) {
                System.out.println("❌ Refresh token expired");
                return ResponseEntity.status(401).body(Map.of(
                    "success", false,
                    "message", "Refresh token expired"
                ));
            }

            User u = record.getUser();
            String newAccess = jwtService.generateAccessToken(
                u.getId().toString(), 
                Map.of("email", u.getEmail(), "name", u.getName())
            );
            
            cookieUtils.addHttpOnlyCookie(
                res, 
                "ch4e_access", 
                newAccess, 
                props.isCookieSecure(), 
                props.getCookieDomain(), 
                props.getAccessTokenMin() * 60L, 
                "/"
            );
            
            System.out.println("✅ Token refreshed for user: " + u.getEmail());
            
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Token refreshed"
            ));
            
        } catch (Exception e) {
            System.out.println("❌ Refresh failed: " + e.getMessage());
            return ResponseEntity.status(401).body(Map.of(
                "success", false,
                "message", "Session expired. Please log in again."
            ));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest req, HttpServletResponse res) {
        try {
            System.out.println("🚪 Logout request received");
            
            String refresh = null;
            Long userId = null;
            
            if (req.getCookies() != null) {
                for (Cookie c : req.getCookies()) {
                    if ("ch4e_refresh".equals(c.getName())) {
                        refresh = c.getValue();
                    }
                    if ("ch4e_access".equals(c.getName())) {
                        try {
                            String subject = jwtService.parseToken(c.getValue()).getBody().getSubject();
                            userId = Long.valueOf(subject);
                        } catch (Exception e) {
                            System.out.println("⚠️ Could not parse user ID from token");
                        }
                    }
                }
            }
            
            if (refresh != null) {
                refreshService.delete(refresh);
            }
            
            cookieUtils.deleteCookie(res, "ch4e_access", props.getCookieDomain(), "/");
            cookieUtils.deleteCookie(res, "ch4e_refresh", props.getCookieDomain(), "/");
            
            System.out.println("✅ Logout successful");
            
            String provider = "LOCAL";
            if (userId != null) {
                var user = userRepo.findById(userId);
                if (user.isPresent() && "GOOGLE".equals(user.get().getProvider())) {
                    provider = "GOOGLE";
                }
            }
            
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Logged out successfully",
                "provider", provider
            ));
        } catch (Exception e) {
            System.out.println("❌ Logout error: " + e.getMessage());
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "message", "Logout failed"
            ));
        }
    }

    @GetMapping("/check-email")
    public ResponseEntity<?> checkEmail(String email) {
        try {
            System.out.println("🔍 Checking email: " + email);
            
            if (email == null || email.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of(
                    "error", "Email is required"
                ));
            }
            
            var user = userRepo.findByEmail(email);
            
            if (user.isEmpty()) {
                System.out.println("✅ Email not registered: " + email);
                return ResponseEntity.ok(Map.of(
                    "exists", false,
                    "message", "Email not registered"
                ));
            }
            
            String provider = user.get().getProvider();
            System.out.println("✅ Email found with provider: " + provider);
            
            return ResponseEntity.ok(Map.of(
                "exists", true,
                "provider", provider,
                "message", "Email is registered with " + provider
            ));
            
        } catch (Exception e) {
            System.out.println("❌ Error checking email: " + e.getMessage());
            return ResponseEntity.status(500).body(Map.of(
                "error", "Internal server error"
            ));
        }
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(HttpServletRequest req) {
        try {
            System.out.println("👤 /me endpoint called");
            
            String subject = null;
            if (req.getCookies() != null) {
                for (Cookie c : req.getCookies()) {
                    if ("ch4e_access".equals(c.getName())) {
                        try {
                            subject = jwtService.parseToken(c.getValue()).getBody().getSubject();
                            System.out.println("✅ Token parsed, user ID: " + subject);
                        } catch (Exception e) {
                            System.out.println("❌ Token parsing failed: " + e.getMessage());
                        }
                    }
                }
            }
            
            if (subject == null) {
                System.out.println("❌ No valid token found");
                return ResponseEntity.status(401).body(Map.of(
                    "error", "Unauthorized",
                    "message", "Please log in"
                ));
            }
            
            User u = userRepo.findById(Long.valueOf(subject))
                .orElseThrow(() -> new RuntimeException("User not found"));
            
            System.out.println("✅ User found: " + u.getEmail());
            
            return ResponseEntity.ok(new UserResponse(
                u.getId(), 
                u.getName(), 
                u.getEmail(), 
                u.getPhone(), 
                u.getProvider()
            ));
            
        } catch (Exception e) {
            System.out.println("❌ /me error: " + e.getMessage());
            return ResponseEntity.status(401).body(Map.of(
                "error", "Unauthorized",
                "message", "Session invalid"
            ));
        }
    }
}