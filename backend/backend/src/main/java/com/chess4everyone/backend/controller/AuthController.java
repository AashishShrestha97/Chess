// controller/AuthController.java
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
import com.chess4everyone.backend.dto.AuthResponse;
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

    public AuthController(UserRepository userRepo, UserService userService,
                          JwtService jwtService,
                          RefreshTokenService refreshService, JwtProperties props,
                          CookieUtils cookieUtils, BCryptPasswordEncoder encoder) {
        this.userRepo = userRepo; this.userService = userService;
        this.jwtService = jwtService; this.refreshService = refreshService; this.props = props;
        this.cookieUtils = cookieUtils; this.encoder = encoder;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest req){
        userService.register(req);
        return ResponseEntity.ok(new AuthResponse("Registered"));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest req, HttpServletResponse res){
        User u = userRepo.findByEmail(req.email()).orElseThrow(() -> new RuntimeException("Invalid credentials"));
        if (!encoder.matches(req.password(), u.getPassword())) throw new RuntimeException("Invalid credentials");

        String access = jwtService.generateAccessToken(u.getId().toString(), Map.of("email", u.getEmail(), "name", u.getName()));
        String refresh = jwtService.generateRefreshToken(u.getId().toString());

        // Persist refresh token (optional if you want to invalidate later)
        refreshService.save(refresh, u, Instant.now().plusSeconds(props.getRefreshTokenDays()*24L*60*60));

        cookieUtils.addHttpOnlyCookie(res,"ch4e_access", access, props.isCookieSecure(), props.getCookieDomain(), props.getAccessTokenMin()*60L, "/");
        cookieUtils.addHttpOnlyCookie(res,"ch4e_refresh", refresh, props.isCookieSecure(), props.getCookieDomain(), props.getRefreshTokenDays()*24L*60*60, "/");

        return ResponseEntity.ok(new AuthResponse("Logged in"));
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(HttpServletRequest req, HttpServletResponse res){
        String refresh = null;
        if (req.getCookies()!=null) for (Cookie c: req.getCookies()) if ("ch4e_refresh".equals(c.getName())) refresh=c.getValue();
        if (refresh==null) return ResponseEntity.status(401).body(new AuthResponse("No refresh"));

        var record = refreshService.find(refresh).orElseThrow(() -> new RuntimeException("Invalid refresh"));
        if (record.getExpiry().isBefore(Instant.now())) return ResponseEntity.status(401).body(new AuthResponse("Expired refresh"));

        User u = record.getUser();
        String newAccess = jwtService.generateAccessToken(u.getId().toString(), Map.of("email", u.getEmail(), "name", u.getName()));
        cookieUtils.addHttpOnlyCookie(res,"ch4e_access", newAccess, props.isCookieSecure(), props.getCookieDomain(), props.getAccessTokenMin()*60L, "/");
        return ResponseEntity.ok(new AuthResponse("Refreshed"));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest req, HttpServletResponse res){
        String refresh = null;
        if (req.getCookies()!=null) for (Cookie c: req.getCookies()) if ("ch4e_refresh".equals(c.getName())) refresh=c.getValue();
        if (refresh!=null) refreshService.delete(refresh);
        cookieUtils.deleteCookie(res,"ch4e_access", props.getCookieDomain(), "/");
        cookieUtils.deleteCookie(res,"ch4e_refresh", props.getCookieDomain(), "/");
        return ResponseEntity.ok(new AuthResponse("Logged out"));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(HttpServletRequest req){
        // user id stored as subject
        String subject = null;
        if (req.getCookies()!=null) for (Cookie c: req.getCookies()) if ("ch4e_access".equals(c.getName())) {
            try { subject = jwtService.parseToken(c.getValue()).getBody().getSubject(); } catch(Exception ignored){}
        }
        if (subject==null) return ResponseEntity.status(401).build();
        User u = userRepo.findById(Long.valueOf(subject)).orElseThrow();
        return ResponseEntity.ok(new UserResponse(u.getId(), u.getName(), u.getEmail(), u.getPhone(), u.getProvider()));
    }
}
