// service/RefreshTokenService.java
package com.chess4everyone.backend.service;

import java.time.Instant;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.chess4everyone.backend.entity.RefreshToken;
import com.chess4everyone.backend.entity.User;
import com.chess4everyone.backend.repo.RefreshTokenRepository;

@Service
public class RefreshTokenService {
    private final RefreshTokenRepository repo;

    public RefreshTokenService(RefreshTokenRepository repo) { this.repo = repo; }

    public void save(String token, User user, Instant expiry){
        RefreshToken rt = new RefreshToken();
        rt.setToken(token);
        rt.setUser(user);
        rt.setExpiry(expiry);
        repo.save(rt);
    }

    public Optional<RefreshToken> find(String token){ return repo.findByToken(token); }
    public void delete(String token){ repo.deleteByToken(token); }
}
