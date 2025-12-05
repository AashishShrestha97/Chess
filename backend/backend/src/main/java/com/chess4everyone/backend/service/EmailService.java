package com.chess4everyone.backend.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailService {
    @Autowired
    private JavaMailSender mailSender;

    public void sendVerificationEmail(String to, String token) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(to);
        message.setSubject("Complete Registration for Chess4Anyone");
        message.setText("To confirm your account, please click here: "
                + "http://localhost:5173/verify?token=" + token
                + "\n\nThis link will expire in 24 hours.");
        
        mailSender.send(message);
    }
}