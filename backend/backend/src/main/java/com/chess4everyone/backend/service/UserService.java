// service/UserService.java
package com.chess4everyone.backend.service;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.Assert;

import com.chess4everyone.backend.dto.RegisterRequest;
import com.chess4everyone.backend.dto.UserResponse;
import com.chess4everyone.backend.entity.User;
import com.chess4everyone.backend.repo.RoleRepository;
import com.chess4everyone.backend.repo.UserRepository;

@Service
public class UserService {
    private final UserRepository userRepo;
    private final RoleRepository roleRepo;
    private final BCryptPasswordEncoder encoder;

    public UserService(UserRepository userRepo, RoleRepository roleRepo, BCryptPasswordEncoder encoder) {
        this.userRepo = userRepo; this.roleRepo = roleRepo; this.encoder = encoder;
    }

    public User register(RegisterRequest req) {
        Assert.isTrue(req.password().equals(req.confirmPassword()), "Passwords do not match");
        if (userRepo.existsByEmail(req.email())) throw new IllegalArgumentException("Email already in use");
        if (req.phone()!=null && !req.phone().isBlank() && userRepo.existsByPhone(req.phone()))
            throw new IllegalArgumentException("Phone already in use");

        User u = new User();
        u.setName(req.name());
        u.setEmail(req.email());
        u.setPhone(req.phone());
        u.setPassword(encoder.encode(req.password()));
        u.setProvider("LOCAL");
        u.getRoles().add(roleRepo.findByName("ROLE_USER").orElseThrow());
        return userRepo.save(u);
    }

    public UserResponse toResponse(User u){
        return new UserResponse(u.getId(), u.getName(), u.getEmail(), u.getPhone(), u.getProvider());
    }
}
