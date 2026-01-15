CREATE DATABASE IF NOT EXISTS ch4e CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE ch4e;

CREATE TABLE IF NOT EXISTS roles (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) UNIQUE NOT NULL
);
INSERT IGNORE INTO roles(name) VALUES ('ROLE_USER'), ('ROLE_ADMIN');

-- Game modes table - different chess time controls and game types
CREATE TABLE IF NOT EXISTS game_modes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  min_time_minutes INT NOT NULL,
  max_time_minutes INT NOT NULL,
  increment_seconds INT NOT NULL DEFAULT 0,
  icon VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default game modes
INSERT IGNORE INTO game_modes (name, display_name, description, min_time_minutes, max_time_minutes, increment_seconds, icon) VALUES
('BULLET', 'Bullet', 'Games with 1-2 minutes time control', 1, 2, 0, '⚡'),
('BLITZ', 'Blitz', 'Games with 3-5 minutes time control', 3, 5, 0, '🔥'),
('RAPID', 'Rapid', 'Games with 10-25 minutes time control', 10, 25, 0, '⚔️'),
('CLASSICAL', 'Classical', 'Games with 30+ minutes time control', 30, 999, 0, '👑'),
('BULLET_INC', 'Bullet +', 'Bullet games with increment', 1, 2, 1, '⚡➕'),
('BLITZ_INC', 'Blitz +', 'Blitz games with increment', 3, 5, 2, '🔥➕'),
('RAPID_INC', 'Rapid +', 'Rapid games with increment', 10, 25, 5, '⚔️➕'),
('CLASSICAL_INC', 'Classical +', 'Classical games with increment', 30, 999, 10, '👑➕');

-- Voice commands table - admin-controllable voice commands for chess
CREATE TABLE IF NOT EXISTS voice_commands (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  command_name VARCHAR(100) NOT NULL UNIQUE,
  patterns LONGTEXT NOT NULL,
  intent VARCHAR(50) NOT NULL,
  description TEXT,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default voice commands - extracted from globalVoiceParser
INSERT IGNORE INTO voice_commands (command_name, patterns, intent, description, active) VALUES
('knight', '["night","nite","bite","naight","nait","knite","neit","nyte"]', 'PIECE', 'Knight piece command', 1),
('queen', '["kween","quin","kwin","quine","qeen","kiwin","qween","kwon"]', 'PIECE', 'Queen piece command', 1),
('king', '["kink","keen","keeng","keng","kang","kyng","kiing"]', 'PIECE', 'King piece command', 1),
('rook', '["rock","brook","ruk","ruke","rok","ruck","roak","rouk"]', 'PIECE', 'Rook piece command', 1),
('bishop', '["bisop","biship","bishap","bisap","bish","bishup","bisup"]', 'PIECE', 'Bishop piece command', 1),
('pawn', '["pond","paun","pwn","pon","pown","paan","pan","porn"]', 'PIECE', 'Pawn piece command', 1),
('takes', '["take","tek","teyk","capture","captures","catch","ketch","teks"]', 'ACTION', 'Capture/take piece action', 1),
('to', '["too","two","tu","toh","tuh","toward","towards","into"]', 'DIRECTION', 'Move direction preposition', 1),
('bullet', '["bulit","bullit","bulet","bullett","bullitt","bulent"]', 'TIME_CONTROL', 'Bullet time control', 1),
('blitz', '["blits","bleetz","blets","blitzs","blitx","bliz"]', 'TIME_CONTROL', 'Blitz time control', 1),
('rapid', '["repid","rapeed","raped","rappid","rapyd","repeed"]', 'TIME_CONTROL', 'Rapid time control', 1),
('classical', '["classicle","klasikal","classic","classik","clasical","klassical"]', 'TIME_CONTROL', 'Classical time control', 1),
('castle', '["kastle","casel","kasel","castles","kassle"]', 'ACTION', 'Castling move', 1),
('kingside', '["kingsaid","king_side","kingsite","kingsyde","short"]', 'DIRECTION', 'King side direction', 1),
('queenside', '["queensaid","queen_side","queensite","queensyde","long"]', 'DIRECTION', 'Queen side direction', 1),
('play', '["plai","pley","plei","playing","playe"]', 'GAME_CONTROL', 'Start playing command', 1),
('start', '["strat","sart","sturt","starting","startt"]', 'GAME_CONTROL', 'Start game command', 1),
('random', '["rendom","randum","rondom","randome","randem"]', 'GAME_CONTROL', 'Random selection command', 1),
('friend', '["frend","frand","frient"]', 'OPPONENT_TYPE', 'Friend opponent selection', 1);

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
  white_player_id BIGINT,
  black_player_id BIGINT,
  opponent_name VARCHAR(150) NOT NULL,
  result VARCHAR(10),
  rating_change INT DEFAULT 0,
  accuracy_percentage INT,
  game_duration VARCHAR(20),
  played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  time_ago VARCHAR(50),
  pgn LONGTEXT,
  moves_json LONGTEXT,
  white_rating INT DEFAULT 1200,
  black_rating INT DEFAULT 1200,
  time_control VARCHAR(20),
  opening_name VARCHAR(255),
  game_type VARCHAR(50),
  game_mode_id BIGINT,
  termination_reason VARCHAR(100),
  move_count INT DEFAULT 0,
  total_time_white_ms BIGINT DEFAULT 0,
  total_time_black_ms BIGINT DEFAULT 0,
  CONSTRAINT fk_game_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_game_white_player FOREIGN KEY (white_player_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_game_black_player FOREIGN KEY (black_player_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_game_mode FOREIGN KEY (game_mode_id) REFERENCES game_modes(id) ON DELETE SET NULL
);

-- Game analysis table - stores analysis results for games
CREATE TABLE IF NOT EXISTS game_analysis (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  game_id BIGINT NOT NULL UNIQUE,
  analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  moves_analysis LONGTEXT,
  white_accuracy DOUBLE DEFAULT 0.0,
  black_accuracy DOUBLE DEFAULT 0.0,
  white_blunders INT DEFAULT 0,
  black_blunders INT DEFAULT 0,
  white_mistakes INT DEFAULT 0,
  black_mistakes INT DEFAULT 0,
  best_moves_by_phase LONGTEXT,
  key_moments LONGTEXT,
  opening_name VARCHAR(255),
  opening_ply INT DEFAULT 0,
  opening_score_white DOUBLE DEFAULT 0.0,
  opening_score_black DOUBLE DEFAULT 0.0,
  middlegame_score_white DOUBLE DEFAULT 0.0,
  middlegame_score_black DOUBLE DEFAULT 0.0,
  endgame_score_white DOUBLE DEFAULT 0.0,
  endgame_score_black DOUBLE DEFAULT 0.0,
  CONSTRAINT fk_analysis_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  INDEX idx_game_id (game_id)
);

SHOW TABLES;
