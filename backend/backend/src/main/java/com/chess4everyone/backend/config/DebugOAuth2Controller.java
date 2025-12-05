package com.chess4everyone.backend.config;

import java.util.HashMap;
import java.util.Map;

import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Small debug controller to expose the OAuth2 authorization URL the app will
 * send to Google. Visit /api/debug/oauth2/url in a browser on the same host
 * to see the exact authorizationRequestUri and redirect_uri that will be used.
 */
@RestController
public class DebugOAuth2Controller {
    private final DefaultOAuth2AuthorizationRequestResolver resolver;

    public DebugOAuth2Controller(ClientRegistrationRepository clients) {
        this.resolver = new DefaultOAuth2AuthorizationRequestResolver(clients, "/oauth2/authorization");
    }

    @GetMapping("/api/debug/oauth2/url")
    public Map<String, String> url(HttpServletRequest request) {
        OAuth2AuthorizationRequest authReq = resolver.resolve(request, "google");
        Map<String, String> out = new HashMap<>();
        if (authReq == null) {
            out.put("error", "authorization request could not be built - check client registration");
            return out;
        }
        out.put("authorizationRequestUri", authReq.getAuthorizationRequestUri());
        out.put("redirectUri", authReq.getRedirectUri());
        out.put("clientId", authReq.getClientId());
        return out;
    }
}
