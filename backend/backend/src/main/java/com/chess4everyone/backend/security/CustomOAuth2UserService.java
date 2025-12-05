package com.chess4everyone.backend.security;

import java.util.Map;

import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import com.chess4everyone.backend.entity.User;
import com.chess4everyone.backend.repo.RoleRepository;
import com.chess4everyone.backend.repo.UserRepository;

@Service
public class CustomOAuth2UserService extends DefaultOAuth2UserService {
    private final UserRepository userRepo;
    private final RoleRepository roleRepo;
    public CustomOAuth2UserService(UserRepository userRepo, RoleRepository roleRepo) {
        this.userRepo = userRepo; this.roleRepo = roleRepo;
    }
    @Override
    public OAuth2User loadUser(OAuth2UserRequest req) throws OAuth2AuthenticationException {
        OAuth2User user = super.loadUser(req);
        Map<String, Object> attrs = user.getAttributes();

        String provider = req.getClientRegistration().getRegistrationId().toUpperCase();
        String sub = (String) attrs.get("sub");
        String email = (String) attrs.get("email");
        String name  = (String) attrs.getOrDefault("name", email);

        userRepo.findByProviderAndProviderId(provider, sub).orElseGet(() -> {
            User u = new User();
            u.setProvider(provider);
            u.setProviderId(sub);
            u.setEmail(email);
            u.setName(name);
            u.getRoles().add(roleRepo.findByName("ROLE_USER").orElseThrow());
            return userRepo.save(u);
        });
        return user; // tokens minted in success handler
    }
}
