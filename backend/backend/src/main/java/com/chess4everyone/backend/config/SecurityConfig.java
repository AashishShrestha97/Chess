package com.chess4everyone.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import com.chess4everyone.backend.security.CustomOAuth2UserService;
import com.chess4everyone.backend.security.JwtAuthenticationFilter;
import com.chess4everyone.backend.security.OAuth2SuccessHandler;

@Configuration
public class SecurityConfig {
    private final JwtAuthenticationFilter jwtFilter;
    private final CustomOAuth2UserService oAuth2UserService;
    private final OAuth2SuccessHandler successHandler;

    public SecurityConfig(JwtAuthenticationFilter jwtFilter, CustomOAuth2UserService oAuth2UserService, OAuth2SuccessHandler successHandler) {
        this.jwtFilter = jwtFilter; this.oAuth2UserService = oAuth2UserService; this.successHandler = successHandler;
    }

    @Bean public BCryptPasswordEncoder passwordEncoder(){ return new BCryptPasswordEncoder(); }

    @Bean
  public SecurityFilterChain filterChain(HttpSecurity http, ClientRegistrationRepository clientRegistrationRepository) throws Exception {
        http
          .cors(c->{})
          .csrf(csrf->csrf.disable())
          .authorizeHttpRequests(a->a
            .requestMatchers("/api/auth/**","/oauth2/**","/api/deepgram/**").permitAll()
            .anyRequest().authenticated()
          )
          .oauth2Login(o->{
            // create a logging resolver that logs the redirect URL that will be
            // sent to Google for easier debugging of redirect_uri mismatches
            OAuth2AuthorizationRequestResolver loggingResolver = new com.chess4everyone.backend.security.LoggingOAuth2AuthorizationRequestResolver(clientRegistrationRepository, "/oauth2/authorization");
            o.loginPage("/api/auth/oauth2/authorization/google")
               // Use the Spring default callback path (/login/oauth2/code/{registrationId})
               // because that's what the Google Console redirect URI is configured as.
               .redirectionEndpoint(r -> r.baseUri("/login/oauth2/code/*"))
             .authorizationEndpoint(a -> a.authorizationRequestResolver(loggingResolver))
             .userInfoEndpoint(u->u.userService(oAuth2UserService))
             .successHandler(successHandler);
          })
          .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration cfg) throws Exception {
        return cfg.getAuthenticationManager();
    }
}
