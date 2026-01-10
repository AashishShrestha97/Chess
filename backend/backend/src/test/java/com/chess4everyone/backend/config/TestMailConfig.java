package com.chess4everyone.backend.config;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

/**
 * Test configuration to provide JavaMailSender bean for tests.
 * Uses a no-op implementation to avoid needing actual mail server configuration.
 */
@TestConfiguration
public class TestMailConfig {
    
    @Bean
    @Primary
    public JavaMailSender javaMailSender() {
        JavaMailSenderImpl mailSender = new JavaMailSenderImpl();
        mailSender.setHost("localhost");
        mailSender.setPort(1025); // Dummy port for testing
        return mailSender;
    }
}
