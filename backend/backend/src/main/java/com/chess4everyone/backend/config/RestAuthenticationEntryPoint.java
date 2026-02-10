package com.chess4everyone.backend.config;

import java.io.IOException;

import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class RestAuthenticationEntryPoint implements AuthenticationEntryPoint {

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
            AuthenticationException authException) throws IOException, ServletException {
        
        // Check if this is an API request (AJAX, fetch, etc.)
        String requestedWith = request.getHeader("X-Requested-With");
        String acceptHeader = request.getHeader("Accept");
        boolean isApiRequest = "XMLHttpRequest".equals(requestedWith) 
            || (acceptHeader != null && acceptHeader.contains("application/json"));
        
        if (isApiRequest) {
            // Return 401 JSON response for API requests
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            
            ObjectMapper mapper = new ObjectMapper();
            var errorResponse = mapper.createObjectNode();
            errorResponse.put("error", "Unauthorized");
            errorResponse.put("message", "Authentication required");
            
            response.getWriter().write(mapper.writeValueAsString(errorResponse));
        } else {
            // Redirect to login for browser requests
            response.sendRedirect("/login");
        }
    }
}
