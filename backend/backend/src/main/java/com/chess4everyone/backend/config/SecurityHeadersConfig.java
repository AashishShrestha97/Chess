package com.chess4everyone.backend.config;

import java.io.IOException;

import org.springframework.stereotype.Component;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Filter to add Cross-Origin headers required for SharedArrayBuffer support
 * This enables Stockfish WASM multi-threading in web workers
 * Using a Filter instead of HandlerInterceptor ensures headers are set on ALL responses
 */
@Component
public class SecurityHeadersConfig implements Filter {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletResponse httpResponse = (HttpServletResponse) response;
        
        // Enable SharedArrayBuffer for WASM multi-threading
        httpResponse.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        httpResponse.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
        
        // Additional security headers
        httpResponse.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        
        // Debug logging
        System.out.println("✅ SecurityHeadersConfig - COOP/COEP headers set on response");
        
        chain.doFilter(request, response);
    }
}
