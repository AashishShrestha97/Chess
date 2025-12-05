package com.chess4everyone.backend.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class OAuth2Config {
    @GetMapping("/api/auth/oauth2/authorization/google")
    public String forward() {
        // Use a redirect so the browser makes an explicit request to the
        // authorization endpoint. This avoids subtle differences in request
        // attributes that can affect the generated redirect_uri.
        return "redirect:/oauth2/authorization/google";
    }
}
