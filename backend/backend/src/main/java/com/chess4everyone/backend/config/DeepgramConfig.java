package com.chess4everyone.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DeepgramConfig {

    @Value("${deepgram.api.key:}")
    private String apiKey;

    @Value("${deepgram.api.url:https://api.deepgram.com}")
    private String apiUrl;

    public String getApiKey() {
        return apiKey != null ? apiKey : "";
    }

    public String getApiUrl() {
        return apiUrl;
    }

    // STT Configuration
    public String getSttEndpoint() {
        return apiUrl + "/v1/listen";
    }

    // TTS Configuration
    public String getTtsEndpoint() {
        return apiUrl + "/v1/speak";
    }
}
