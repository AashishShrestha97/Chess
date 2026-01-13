package com.chess4everyone.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.chess4everyone.backend.dto.UpdateProfileRequest;
import com.chess4everyone.backend.dto.UserResponse;
import com.chess4everyone.backend.entity.User;
import com.chess4everyone.backend.repo.UserRepository;
import com.chess4everyone.backend.security.JwtService;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {

    private final UserRepository userRepo;
    private final JwtService jwtService;

    public ProfileController(UserRepository userRepo, 
                           JwtService jwtService) {
        this.userRepo = userRepo;
        this.jwtService = jwtService;
    }

    private Long getUserIdFromRequest(HttpServletRequest req) {
        System.out.println("🔍 Extracting user ID from request");
        
        // Log all cookies
        if (req.getCookies() != null) {
            System.out.println("🍪 Total cookies: " + req.getCookies().length);
            for (Cookie cookie : req.getCookies()) {
                System.out.println("  Cookie: " + cookie.getName() + " = " + 
                    (cookie.getName().startsWith("ch4e_") ? "[TOKEN]" : cookie.getValue()));
            }
        } else {
            System.out.println("⚠️ No cookies in request");
        }
        
        String subject = null;
        if (req.getCookies() != null) {
            for (Cookie c : req.getCookies()) {
                if ("ch4e_access".equals(c.getName())) {
                    try {
                        subject = jwtService.parseToken(c.getValue()).getBody().getSubject();
                        System.out.println("✅ Token parsed, user ID: " + subject);
                    } catch (Exception e) {
                        System.out.println("❌ Token parsing failed: " + e.getMessage());
                        e.printStackTrace();
                    }
                }
            }
        }
        
        if (subject == null) {
            System.out.println("❌ No valid token found");
            return null;
        }
        
        return Long.valueOf(subject);
    }

    @PutMapping("/update")
    public ResponseEntity<?> updateProfile(HttpServletRequest req, @RequestBody UpdateProfileRequest updateRequest) {
        Long userId = getUserIdFromRequest(req);
        if (userId == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        User user = userRepo.findById(userId).orElseThrow();

        // Update name if provided
        if (updateRequest.name() != null && !updateRequest.name().trim().isEmpty()) {
            user.setName(updateRequest.name().trim());
        }

        // Update phone if provided
        if (updateRequest.phone() != null && !updateRequest.phone().trim().isEmpty()) {
            user.setPhone(updateRequest.phone().trim());
        }

        @SuppressWarnings("null")
        User saved = userRepo.save(user);

        // Return updated user info
        UserResponse response = new UserResponse(
            saved.getId(),
            saved.getName(),
            saved.getEmail(),
            saved.getPhone(),
            saved.getProvider()
        );

        return ResponseEntity.ok(response);
    }

    @GetMapping("/user-info")
    public ResponseEntity<?> getUserInfo(HttpServletRequest req) {
        Long userId = getUserIdFromRequest(req);
        if (userId == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        User user = userRepo.findById(userId).orElseThrow();

        UserResponse response = new UserResponse(
            user.getId(),
            user.getName(),
            user.getEmail(),
            user.getPhone(),
            user.getProvider()
        );

        return ResponseEntity.ok(response);
    }
}