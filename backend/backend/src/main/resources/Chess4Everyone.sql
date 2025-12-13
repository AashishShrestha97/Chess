CREATE DATABASE IF NOT EXISTS ch4e CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE ch4e;

CREATE TABLE IF NOT EXISTS roles (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) UNIQUE NOT NULL
);
INSERT IGNORE INTO roles(name) VALUES ('ROLE_USER'), ('ROLE_ADMIN');

CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(150) UNIQUE,
  phone VARCHAR(30) UNIQUE,
  password VARCHAR(255),
  provider VARCHAR(20) NOT NULL DEFAULT 'LOCAL',
  provider_id VARCHAR(255),
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id BIGINT NOT NULL,
  role_id BIGINT NOT NULL,
  PRIMARY KEY (user_id, role_id),
  CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  token VARCHAR(512) NOT NULL UNIQUE,
  user_id BIGINT NOT NULL,
  expiry TIMESTAMP NOT NULL,
  CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User profiles - extended user statistics and performance metrics
CREATE TABLE IF NOT EXISTS user_profiles (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL UNIQUE,
  rating INT DEFAULT 1200,
  rating_change_this_month INT DEFAULT 0,
  global_rank BIGINT DEFAULT 0,
  games_played INT DEFAULT 0,
  win_rate DOUBLE DEFAULT 0.0,
  current_streak INT DEFAULT 0,
  best_streak INT DEFAULT 0,
  time_played_minutes BIGINT DEFAULT 0,
  favorite_opening VARCHAR(100) DEFAULT 'N/A',
  wins INT DEFAULT 0,
  draws INT DEFAULT 0,
  losses INT DEFAULT 0,
  opening_score INT DEFAULT 50,
  middle_game_score INT DEFAULT 50,
  endgame_score INT DEFAULT 50,
  tactics_score INT DEFAULT 50,
  time_management_score INT DEFAULT 50,
  blunder_avoidance_score INT DEFAULT 50,
  opening_score_change INT DEFAULT 0,
  middle_game_score_change INT DEFAULT 0,
  endgame_score_change INT DEFAULT 0,
  tactics_score_change INT DEFAULT 0,
  time_management_score_change INT DEFAULT 0,
  blunder_avoidance_score_change INT DEFAULT 0,
  CONSTRAINT fk_up_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Games table - game history and statistics
CREATE TABLE IF NOT EXISTS games (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  opponent_name VARCHAR(150),
  result VARCHAR(10),
  rating_change INT DEFAULT 0,
  accuracy_percentage INT,
  game_duration VARCHAR(20),
  played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  time_ago VARCHAR(50),
  CONSTRAINT fk_game_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

SHOW TABLES;
