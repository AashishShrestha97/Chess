package com.chess4everyone.backend.service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.chess4everyone.backend.entity.User;
import com.chess4everyone.backend.entity.VerificationToken;
import com.chess4everyone.backend.repository.VerificationTokenRepository;

@Service
public class VerificationTokenService {

    @Autowired
    private VerificationTokenRepository tokenRepository;

    @Autowired
    private EmailService emailService;

    public void createVerificationToken(User user) {
        String token = UUID.randomUUID().toString();
        VerificationToken verificationToken = new VerificationToken(
            token,
            user,
            Instant.now().plus(24, ChronoUnit.HOURS)
        );
        
        tokenRepository.save(verificationToken);
        emailService.sendVerificationEmail(user.getEmail(), token);
    }

    public boolean verifyUser(String token) {
        return tokenRepository.findByToken(token)
            .map(verificationToken -> {
                if (verificationToken.isExpired() || verificationToken.isUsed()) {
                    return false;
                }

                User user = verificationToken.getUser();
                user.setEnabled(true);
                verificationToken.setUsed(true);
                tokenRepository.save(verificationToken);
                return true;
            })
            .orElse(false);
    }
}