package com.chess4everyone.backend.service;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.Assert;

import com.chess4everyone.backend.dto.RegisterRequest;
import com.chess4everyone.backend.dto.UserResponse;
import com.chess4everyone.backend.entity.User;
import com.chess4everyone.backend.entity.UserProfile;
import com.chess4everyone.backend.repo.RoleRepository;
import com.chess4everyone.backend.repo.UserRepository;
import com.chess4everyone.backend.repository.UserProfileRepository;

@Service
public class UserService {
    private final UserRepository userRepo;
    private final RoleRepository roleRepo;
    private final BCryptPasswordEncoder encoder;
    private final PasswordValidator passwordValidator;
    private final UserProfileRepository profileRepo;

    public UserService(UserRepository userRepo, 
                      RoleRepository roleRepo, 
                      BCryptPasswordEncoder encoder,
                      PasswordValidator passwordValidator,
                      UserProfileRepository profileRepo) {
        this.userRepo = userRepo;
        this.roleRepo = roleRepo;
        this.encoder = encoder;
        this.passwordValidator = passwordValidator;
        this.profileRepo = profileRepo;
    }

    public User register(RegisterRequest req) {
        System.out.println("📝 Registration attempt for email: " + req.email());
        
        // Validate passwords match
        Assert.isTrue(req.password().equals(req.confirmPassword()), 
                     "Passwords do not match");
        
        // ✅ VALIDATE PASSWORD STRENGTH
        passwordValidator.validatePassword(req.password());
        
        // Check if email already exists
        if (userRepo.existsByEmail(req.email())) {
            System.out.println("❌ Email already in use: " + req.email());
            throw new IllegalArgumentException("Email already in use");
        }
        
        // Check if phone already exists (if provided)
        if (req.phone() != null && !req.phone().isBlank() && userRepo.existsByPhone(req.phone())) {
            System.out.println("❌ Phone already in use: " + req.phone());
            throw new IllegalArgumentException("Phone already in use");
        }

        // Create new user
        User u = new User();
        u.setName(req.name());
        u.setEmail(req.email());
        u.setPhone(req.phone());
        u.setPassword(encoder.encode(req.password()));
        u.setProvider("LOCAL");
        u.setEnabled(true); // ✅ TEMPORARY: Enable immediately for testing
        // TODO: Set to false and implement email verification
        
        u.getRoles().add(roleRepo.findByName("ROLE_USER")
            .orElseThrow(() -> new RuntimeException("Role ROLE_USER not found")));
        
        User savedUser = userRepo.save(u);
        System.out.println("✅ User registered successfully: " + savedUser.getEmail());
        
        // ✅ CREATE DEFAULT USER PROFILE
        createDefaultProfile(savedUser);
        
        return savedUser;
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
        
        profileRepo.save(profile);
        System.out.println("✅ Default profile created for user: " + user.getEmail());
    }

    public UserResponse toResponse(User u) {
        return new UserResponse(u.getId(), u.getName(), u.getEmail(), u.getPhone(), u.getProvider());
    }
}