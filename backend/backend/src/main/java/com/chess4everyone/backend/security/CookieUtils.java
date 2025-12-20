package com.chess4everyone.backend.security;

import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import jakarta.servlet.http.HttpServletResponse;

@Component
public class CookieUtils {

    public void addHttpOnlyCookie(
            HttpServletResponse response,
            String name,
            String value,
            boolean secure,
            String domain,
            long maxAgeSeconds,
            String path) {
        
        // ✅ Use ResponseCookie for better control
        ResponseCookie cookie = ResponseCookie.from(name, value)
            .httpOnly(true)
            .secure(secure)
            .domain(domain)
            .path(path)
            .maxAge(maxAgeSeconds)
            .sameSite("Lax") // ✅ CRITICAL: Add SameSite attribute
            .build();
        
        response.addHeader("Set-Cookie", cookie.toString());
        
        System.out.println("🍪 Cookie set: " + name + " (maxAge: " + maxAgeSeconds + "s, secure: " + secure + ", domain: " + domain + ")");
    }

    public void deleteCookie(HttpServletResponse response, String name, String domain, String path) {
        ResponseCookie cookie = ResponseCookie.from(name, "")
            .httpOnly(true)
            .secure(false)
            .domain(domain)
            .path(path)
            .maxAge(0)
            .sameSite("Lax")
            .build();
        
        response.addHeader("Set-Cookie", cookie.toString());
        
        System.out.println("🗑️ Cookie deleted: " + name);
    }
}