package com.chess4everyone.backend.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
public class OAuth2Config {
    @GetMapping("/api/auth/oauth2/authorization/google")
    public String forward(@RequestParam(required = false) String prompt) {
        // Use a redirect so the browser makes an explicit request to the
        // authorization endpoint. This avoids subtle differences in request
        // attributes that can affect the generated redirect_uri.
        
        // Forward the prompt parameter to Spring Security's OAuth endpoint
        if (prompt != null && !prompt.isEmpty()) {
            return "redirect:/oauth2/authorization/google?prompt=" + prompt;
        }
        
        return "redirect:/oauth2/authorization/google";
    }
}
