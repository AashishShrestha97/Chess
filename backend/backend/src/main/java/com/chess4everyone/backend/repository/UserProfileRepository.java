package com.chess4everyone.backend.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.chess4everyone.backend.entity.User;
import com.chess4everyone.backend.entity.UserProfile;

public interface UserProfileRepository extends JpaRepository<UserProfile, Long> {
    Optional<UserProfile> findByUser(User user);
    Optional<UserProfile> findByUserId(Long userId);
}