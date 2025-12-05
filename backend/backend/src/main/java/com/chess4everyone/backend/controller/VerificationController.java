package com.chess4everyone.backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.chess4everyone.backend.service.VerificationTokenService;

@RestController
@RequestMapping("/api/auth")
public class VerificationController {

    @Autowired
    private VerificationTokenService verificationTokenService;

    @GetMapping("/verify")
    public ResponseEntity<?> verifyUser(@RequestParam String token) {
        boolean isValid = verificationTokenService.verifyUser(token);
        
        if (isValid) {
            return ResponseEntity.ok().body("Email verified successfully!");
        } else {
            return ResponseEntity.badRequest().body("Invalid or expired verification token");
        }
    }
}