// backend/.../repository/RatingHistoryRepository.java
package com.chess4everyone.backend.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.chess4everyone.backend.entity.RatingHistory;
import com.chess4everyone.backend.entity.User;

@Repository
public interface RatingHistoryRepository
        extends JpaRepository<RatingHistory, Long> {

    /** Most-recent N entries for a user (for profile sparkline). */
    List<RatingHistory> findTop20ByUserOrderByRecordedAtDesc(User user);

    /** All history for a user ordered chronologically. */
    List<RatingHistory> findByUserOrderByRecordedAtAsc(User user);
}