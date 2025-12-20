package com.chess4everyone.backend.security;

import java.util.Map;

import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import com.chess4everyone.backend.entity.User;
import com.chess4everyone.backend.entity.UserProfile;
import com.chess4everyone.backend.repo.RoleRepository;
import com.chess4everyone.backend.repo.UserRepository;
import com.chess4everyone.backend.repository.UserProfileRepository;

@Service
public class CustomOAuth2UserService extends DefaultOAuth2UserService {
    private final UserRepository userRepo;
    private final RoleRepository roleRepo;
    private final UserProfileRepository profileRepo;
    
    public CustomOAuth2UserService(UserRepository userRepo, 
                                  RoleRepository roleRepo,
                                  UserProfileRepository profileRepo) {
        this.userRepo = userRepo;
        this.roleRepo = roleRepo;
        this.profileRepo = profileRepo;
    }
    
    @Override
    public OAuth2User loadUser(OAuth2UserRequest req) throws OAuth2AuthenticationException {
        OAuth2User oauthUser = super.loadUser(req);
        Map<String, Object> attrs = oauthUser.getAttributes();

        String provider = req.getClientRegistration().getRegistrationId().toUpperCase();
        String sub = (String) attrs.get("sub");
        String email = (String) attrs.get("email");
        String name = (String) attrs.getOrDefault("name", email);

        System.out.println("🔐 OAuth2 login attempt - Provider: " + provider + ", Email: " + email);

        User user = userRepo.findByProviderAndProviderId(provider, sub)
            .orElseGet(() -> {
                System.out.println("🆕 Creating new OAuth2 user: " + email);
                
                User u = new User();
                u.setProvider(provider);
                u.setProviderId(sub);
                u.setEmail(email);
                u.setName(name);
                u.setEnabled(true); // ✅ OAuth users are auto-verified
                u.getRoles().add(roleRepo.findByName("ROLE_USER")
                    .orElseThrow(() -> new RuntimeException("Role ROLE_USER not found")));
                
                User savedUser = userRepo.save(u);
                
                // ✅ CREATE DEFAULT PROFILE
                createDefaultProfile(savedUser);
                
                return savedUser;
            });
        
        System.out.println("✅ OAuth2 user loaded: " + user.getEmail());
        return oauthUser;
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
        System.out.println("✅ Default profile created for OAuth user: " + user.getEmail());
    }
}