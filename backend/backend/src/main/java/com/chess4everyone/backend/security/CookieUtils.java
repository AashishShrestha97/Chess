package com.chess4everyone.backend.security;

import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import jakarta.servlet.http.HttpServletResponse;

@Component
public class CookieUtils {
    public void addHttpOnlyCookie(HttpServletResponse res, String name, String value,
                                  boolean secure, String domain, long maxAgeSeconds, String path) {
    ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from(name, value)
        .httpOnly(true).secure(secure).path(path).maxAge(maxAgeSeconds);

    // For localhost it's preferable to avoid setting the Domain attribute
    // because some browsers reject cookies with Domain=localhost. Also,
    // when your frontend runs on a different origin (e.g. localhost:5173)
    // you need SameSite=None and Secure=true for cookies to be sent with
    // cross-site XHR requests. For local development it's common to keep
    // SameSite=None and secure=false — this may work in some browsers but
    // not all. If you run into issues, consider running frontend via HTTPS
    // or using a dev proxy so requests are same-site.
    if (domain != null && !domain.isBlank() && !"localhost".equals(domain)) {
        builder.domain(domain);
    }

    // Prefer None so client-side XHR from another origin can send cookies.
    // Note: browsers require Secure when SameSite=None; set `secure` in
    // application properties when running over HTTPS.
    builder.sameSite("None");

    ResponseCookie cookie = builder.build();
    res.addHeader("Set-Cookie", cookie.toString());
    }
    public void deleteCookie(HttpServletResponse res, String name, String domain, String path){
    ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from(name, "")
        .httpOnly(true).secure(false).path(path).maxAge(0);
    if (domain != null && !domain.isBlank() && !"localhost".equals(domain)) builder.domain(domain);
    builder.sameSite("None");
    ResponseCookie cookie = builder.build();
    res.addHeader("Set-Cookie", cookie.toString());
    }
}
