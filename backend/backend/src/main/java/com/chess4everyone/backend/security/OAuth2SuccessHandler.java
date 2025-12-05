package com.chess4everyone.backend.security;

import java.io.IOException;
import java.util.Map;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Component;

import com.chess4everyone.backend.config.JwtProperties;
import com.chess4everyone.backend.entity.User;
import com.chess4everyone.backend.repo.UserRepository;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class OAuth2SuccessHandler implements org.springframework.security.web.authentication.AuthenticationSuccessHandler {
    private final JwtService jwtService; private final CookieUtils cookieUtils; private final JwtProperties props; private final UserRepository userRepo;
    public OAuth2SuccessHandler(JwtService jwtService, CookieUtils cookieUtils, JwtProperties props, UserRepository userRepo) {
        this.jwtService = jwtService; this.cookieUtils = cookieUtils; this.props = props; this.userRepo = userRepo;
    }

    @Override public void onAuthenticationSuccess(HttpServletRequest req, HttpServletResponse res, Authentication auth) throws IOException {
        OAuth2User o = (OAuth2User) auth.getPrincipal();
        String email = (String) o.getAttributes().get("email");
        User user = userRepo.findByEmail(email).orElseThrow();

        String access  = jwtService.generateAccessToken(user.getId().toString(), Map.of("email", user.getEmail(), "name", user.getName()));
        String refresh = jwtService.generateRefreshToken(user.getId().toString());

        cookieUtils.addHttpOnlyCookie(res,"ch4e_access", access, props.isCookieSecure(), props.getCookieDomain(), props.getAccessTokenMin()*60L, "/");
        cookieUtils.addHttpOnlyCookie(res,"ch4e_refresh", refresh, props.isCookieSecure(), props.getCookieDomain(), props.getRefreshTokenDays()*24L*60*60, "/");

        res.sendRedirect("http://localhost:5173/home"); // your Vite dev server
    }
}
