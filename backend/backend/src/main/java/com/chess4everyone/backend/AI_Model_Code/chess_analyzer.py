"""
Chess Game Analyzer using Stockfish - OPTIMIZED FOR TRAINING
=============================================================
Improvements over original:
1. Silent mode option (no debug prints during batch processing)
2. Better error handling for corrupted games
3. More efficient CP loss capping
4. Mate score handling improvements
"""

import chess
import chess.pgn
import chess.engine
from typing import List, Dict, Tuple, Optional
import io
import re
from dataclasses import dataclass
import numpy as np


@dataclass
class MoveAnalysis:
    move_number: int
    move: str
    eval_before: float
    eval_after: float
    centipawn_loss: float
    best_move: str
    time_spent: Optional[float]
    clock_remaining: Optional[float]
    phase: str
    is_blunder: bool
    is_mistake: bool
    is_inaccuracy: bool
    is_good: bool
    is_best: bool
    is_brilliant: bool


@dataclass
class GameAnalysis:
    player_color: str
    result: str
    moves: List[MoveAnalysis]
    total_moves: int


def _parse_clk(comment: str) -> Optional[float]:
    """Extract remaining clock seconds from [%clk H:MM:SS.ss] comment."""
    if not comment:
        return None
    match = re.search(r'\[%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)\]', comment)
    if match:
        h, m, s = int(match.group(1)), int(match.group(2)), float(match.group(3))
        return h * 3600 + m * 60 + s
    return None


class ChessAnalyzer:
    BEST_THRESHOLD = 10
    GOOD_THRESHOLD = 25
    INACCURACY_THRESHOLD = 50
    MISTAKE_THRESHOLD = 100
    BLUNDER_THRESHOLD = 200
    BRILLIANT_GAIN = 50
    MAX_CP_LOSS = 500  # Cap for mate scenarios

    def __init__(self, stockfish_path: str = "/usr/games/stockfish", silent: bool = False):
        """
        Initialize analyzer
        
        Args:
            stockfish_path: Path to Stockfish executable
            silent: If True, suppress debug output (useful for batch processing)
        """
        self.stockfish_path = stockfish_path
        self.engine = None
        self.silent = silent

    def __enter__(self):
        self.engine = chess.engine.SimpleEngine.popen_uci(self.stockfish_path)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.engine:
            self.engine.quit()

    def _get_game_phase(self, board: chess.Board, move_number: int) -> str:
        num_pieces = len(board.piece_map())
        has_queens = bool(board.queens)
        if num_pieces <= 12 or (not has_queens and num_pieces <= 16):
            return 'endgame'
        if move_number <= 12:
            return 'opening'
        return 'middlegame'

    def _eval_to_centipawns(self, eval_info, perspective_white: bool = True) -> float:
        """
        Convert evaluation to centipawns, capping mate scores
        """
        if eval_info.is_mate():
            # Cap mate scores to avoid extreme values
            mate_moves = eval_info.mate()
            if mate_moves > 0:
                score = min(10000, 10000)  # Positive mate
            else:
                score = max(-10000, -10000)  # Negative mate
        else:
            score = eval_info.score()
        
        if not perspective_white:
            score = -score
        return score

    def _classify_move(self, cp_loss: float, eval_before: float, eval_after: float) -> Dict[str, bool]:
        """
        Classify move quality with improved logic
        """
        # Cap cp_loss for classification
        cp_loss = min(cp_loss, self.MAX_CP_LOSS)
        eval_gain = eval_after - eval_before

        is_brilliant = eval_gain >= self.BRILLIANT_GAIN
        is_best = cp_loss <= self.BEST_THRESHOLD
        is_good = self.BEST_THRESHOLD < cp_loss <= self.GOOD_THRESHOLD
        is_inaccuracy = self.INACCURACY_THRESHOLD <= cp_loss < self.MISTAKE_THRESHOLD
        is_mistake = self.MISTAKE_THRESHOLD <= cp_loss < self.BLUNDER_THRESHOLD
        is_blunder = cp_loss >= self.BLUNDER_THRESHOLD

        return {
            'is_brilliant': is_brilliant,
            'is_best': is_best,
            'is_good': is_good,
            'is_inaccuracy': is_inaccuracy,
            'is_mistake': is_mistake,
            'is_blunder': is_blunder,
        }

    def analyze_position(self, board: chess.Board, time_limit: float = 0.1) -> Tuple[float, str]:
        """Analyze a single position"""
        try:
            info = self.engine.analyse(board, chess.engine.Limit(time=time_limit))
            eval_cp = self._eval_to_centipawns(info["score"].white(), perspective_white=True)
            best_move = info.get("pv", [None])[0]
            return eval_cp, (best_move.uci() if best_move else "")
        except Exception as e:
            if not self.silent:
                print(f"⚠️ Position analysis error: {e}")
            return 0.0, ""

    def analyze_game(self, pgn_string: str, player_name: str) -> Optional[GameAnalysis]:
        """
        Analyze a complete game
        
        Args:
            pgn_string: PGN notation of the game
            player_name: Name of the player to analyze
            
        Returns:
            GameAnalysis object or None if analysis fails
        """
        if not self.engine:
            raise RuntimeError("Engine not initialized. Use 'with' statement.")

        try:
            game = chess.pgn.read_game(io.StringIO(pgn_string))
            if not game:
                return None
        except Exception as e:
            if not self.silent:
                print(f"⚠️ Failed to parse PGN: {e}")
            return None

        white_player = game.headers.get("White", "")
        black_player = game.headers.get("Black", "")
        
        if player_name.lower() in white_player.lower():
            player_color = "white"
        elif player_name.lower() in black_player.lower():
            player_color = "black"
        else:
            player_color = "white"  # Default

        result = game.headers.get("Result", "*")

        # Clock tracking
        prev_clock_white: Optional[float] = None
        prev_clock_black: Optional[float] = None

        board = game.board()
        moves_analysis = []
        move_number = 0
        
        abnormal_count = 0

        try:
            for node in game.mainline():
                move = node.move
                is_white_move = board.turn == chess.WHITE

                # Extract clock
                current_clock = node.clock()
                if current_clock is None:
                    current_clock = _parse_clk(node.comment)

                # Compute time spent
                time_spent: Optional[float] = None
                if current_clock is not None:
                    prev = prev_clock_white if is_white_move else prev_clock_black
                    if prev is not None:
                        time_spent = max(0.0, prev - current_clock)
                    
                    if is_white_move:
                        prev_clock_white = current_clock
                    else:
                        prev_clock_black = current_clock

                # Only analyze player's moves
                if (player_color == "white" and is_white_move) or \
                   (player_color == "black" and not is_white_move):

                    eval_before, best_move = self.analyze_position(board)
                    if player_color == "black":
                        eval_before = -eval_before

                    board.push(move)
                    move_number += 1

                    eval_after, _ = self.analyze_position(board)
                    if player_color == "black":
                        eval_after = -eval_after

                    # Calculate and cap CP loss
                    cp_loss = max(0, eval_before - eval_after)
                    cp_loss = min(cp_loss, self.MAX_CP_LOSS)
                    
                    # Track abnormal evals (for debugging only)
                    if abs(eval_before) > 1000 or abs(eval_after) > 1000:
                        abnormal_count += 1
                    
                    move_quality = self._classify_move(cp_loss, eval_before, eval_after)
                    phase = self._get_game_phase(board, move_number)

                    moves_analysis.append(MoveAnalysis(
                        move_number=move_number,
                        move=move.uci(),
                        eval_before=eval_before,
                        eval_after=eval_after,
                        centipawn_loss=cp_loss,
                        best_move=best_move,
                        time_spent=time_spent,
                        clock_remaining=current_clock,
                        phase=phase,
                        **move_quality
                    ))
                else:
                    board.push(move)
        
        except Exception as e:
            if not self.silent:
                print(f"⚠️ Error during move analysis: {e}")
            # Return partial analysis if we got some moves
            if len(moves_analysis) < 5:
                return None

        # Only print warnings if not in silent mode and there are issues
        if not self.silent and abnormal_count > 0:
            print(f"⚠️ {abnormal_count} moves with extreme evals (mate scenarios) - capped at {self.MAX_CP_LOSS}cp")

        if len(moves_analysis) == 0:
            return None

        return GameAnalysis(
            player_color=player_color,
            result=result,
            moves=moves_analysis,
            total_moves=len(moves_analysis)
        )

    def analyze_multiple_games(self, pgn_games: List[str], player_name: str) -> List[GameAnalysis]:
        """Analyze multiple games"""
        analyses = []
        for i, pgn in enumerate(pgn_games):
            try:
                analysis = self.analyze_game(pgn, player_name)
                if analysis:
                    analyses.append(analysis)
                    if not self.silent:
                        print(f"Analyzed game {i+1}/{len(pgn_games)}")
            except Exception as e:
                if not self.silent:
                    print(f"Error analyzing game {i+1}: {e}")
                continue
        return analyses


def extract_features(game_analyses: List, silent: bool = False) -> Dict[str, float]:
    """
    Extract performance features as RATES (0.0–1.0)
    
    Args:
        game_analyses: List of GameAnalysis objects
        silent: If True, suppress output
        
    Returns:
        Dictionary of feature values
    """
    if not game_analyses:
        return {
            'avg_cp_loss': 0.0, 'blunder_rate': 0.0, 'mistake_rate': 0.0,
            'inaccuracy_rate': 0.0, 'brilliant_moves': 0.0,
            'best_moves': 0.0, 'good_moves': 0.0,
            'avg_move_time': 0.0, 'time_pressure_moves': 0.0,
            'avg_cp_loss_opening': 0.0, 'avg_cp_loss_middlegame': 0.0,
            'avg_cp_loss_endgame': 0.0, 'blunder_rate_opening': 0.0,
            'blunder_rate_middlegame': 0.0, 'blunder_rate_endgame': 0.0,
        }

    all_moves, opening_moves, middlegame_moves, endgame_moves = [], [], [], []

    for game in game_analyses:
        for move in game.moves:
            all_moves.append(move)
            phase = move.phase
            if phase == 'opening':
                opening_moves.append(move)
            elif phase == 'middlegame':
                middlegame_moves.append(move)
            else:
                endgame_moves.append(move)

    total_moves = len(all_moves)
    if total_moves == 0:
        return extract_features([])

    features = {}

    # Core features (CP loss already capped in analysis)
    raw_cp_losses = [m.centipawn_loss for m in all_moves]
    
    features['avg_cp_loss'] = np.mean(raw_cp_losses)
    features['blunder_rate'] = sum(1 for m in all_moves if m.is_blunder) / total_moves
    features['mistake_rate'] = sum(1 for m in all_moves if m.is_mistake) / total_moves
    features['inaccuracy_rate'] = sum(1 for m in all_moves if m.is_inaccuracy) / total_moves
    features['brilliant_moves'] = sum(1 for m in all_moves if m.is_brilliant) / total_moves
    features['best_moves'] = sum(1 for m in all_moves if m.is_best) / total_moves
    features['good_moves'] = sum(1 for m in all_moves if m.is_good) / total_moves

    # Time management
    moves_with_time = [m for m in all_moves if getattr(m, 'time_spent', None) is not None]

    if moves_with_time:
        time_spents = [m.time_spent for m in moves_with_time]
        avg_time = np.mean(time_spents)
        features['avg_move_time'] = avg_time

        rush_threshold = avg_time / 3.0
        pressure_count = 0
        for m in moves_with_time:
            clock_low = (getattr(m, 'clock_remaining', None) is not None
                        and m.clock_remaining < 60)
            rushed = m.time_spent < rush_threshold and m.time_spent < 2.0
            if clock_low or rushed:
                pressure_count += 1
        features['time_pressure_moves'] = pressure_count / len(moves_with_time)
    else:
        features['avg_move_time'] = 0.0
        features['time_pressure_moves'] = 0.0

    # Phase-specific (already capped)
    opening_cp = [m.centipawn_loss for m in opening_moves]
    middlegame_cp = [m.centipawn_loss for m in middlegame_moves]
    endgame_cp = [m.centipawn_loss for m in endgame_moves]
    
    features['avg_cp_loss_opening'] = np.mean(opening_cp) if opening_cp else 0.0
    features['avg_cp_loss_middlegame'] = np.mean(middlegame_cp) if middlegame_cp else 0.0
    features['avg_cp_loss_endgame'] = np.mean(endgame_cp) if endgame_cp else 0.0

    features['blunder_rate_opening'] = sum(1 for m in opening_moves if m.is_blunder) / len(opening_moves) if opening_moves else 0.0
    features['blunder_rate_middlegame'] = sum(1 for m in middlegame_moves if m.is_blunder) / len(middlegame_moves) if middlegame_moves else 0.0
    features['blunder_rate_endgame'] = sum(1 for m in endgame_moves if m.is_blunder) / len(endgame_moves) if endgame_moves else 0.0

    # Print summary unless silent
    if not silent:
        print(f"\n📊 FEATURE EXTRACTION SUMMARY:")
        print(f"   Total moves: {total_moves}")
        print(f"   Avg CP loss: {features['avg_cp_loss']:.1f}")
        print(f"   Blunder rate: {features['blunder_rate']:.2%}")
        print(f"   Best move rate: {features['best_moves']:.2%}")
    
    return features


# Standalone test
if __name__ == "__main__":
    example_pgn = """[Event "Rated Blitz game"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 { [%clk 0:04:58.23] } 1... e5 { [%clk 0:04:57.80] } 2. Nf3 { [%clk 0:04:55.10] } 2... Nc6 { [%clk 0:04:54.20] } 1-0
"""
    with ChessAnalyzer(silent=False) as analyzer:
        analysis = analyzer.analyze_game(example_pgn, "Player1")
        if analysis:
            print(f"Analyzed {analysis.total_moves} moves")
            features = extract_features([analysis])
            print("\nExtracted features:")
            for k, v in features.items():
                print(f"  {k:30s} {v:.4f}")