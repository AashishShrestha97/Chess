package com.chess4everyone.backend.security;

import java.util.Objects;

import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Delegates to DefaultOAuth2AuthorizationRequestResolver and logs the generated
 * authorization redirect URI to help debug redirect_uri mismatches with Google.
 */
public class LoggingOAuth2AuthorizationRequestResolver implements OAuth2AuthorizationRequestResolver {
    private final DefaultOAuth2AuthorizationRequestResolver delegate;

    public LoggingOAuth2AuthorizationRequestResolver(org.springframework.security.oauth2.client.registration.ClientRegistrationRepository repo, String authorizationRequestBaseUri) {
        this.delegate = new DefaultOAuth2AuthorizationRequestResolver(repo, authorizationRequestBaseUri);
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
        OAuth2AuthorizationRequest req = delegate.resolve(request);
        log(req);
        return req;
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String clientRegistrationId) {
        OAuth2AuthorizationRequest req = delegate.resolve(request, clientRegistrationId);
        log(req);
        return req;
    }

    private void log(OAuth2AuthorizationRequest req) {
        if (req == null) return;
        String uri = req.getAuthorizationRequestUri();
        System.out.println("[OAuth2] AuthorizationRequest URI: " + Objects.toString(uri, "<null>"));
        System.out.println("[OAuth2] client_id: " + req.getAdditionalParameters().get("client_id") + ", redirect_uri: " + req.getRedirectUri());
    }
}
