"""
Chess Game Analyzer using Stockfish
Analyzes PGN games and extracts performance features
"""

import chess
import chess.pgn
import chess.engine
from typing import List, Dict, Tuple, Optional
import io
from dataclasses import dataclass
import numpy as np


@dataclass
class MoveAnalysis:
    """Stores analysis data for a single move"""
    move_number: int
    move: str
    eval_before: float
    eval_after: float
    centipawn_loss: float
    best_move: str
    time_left: Optional[float]
    phase: str  # 'opening', 'middlegame', 'endgame'
    is_blunder: bool
    is_mistake: bool
    is_inaccuracy: bool
    is_good: bool
    is_best: bool
    is_brilliant: bool


@dataclass
class GameAnalysis:
    """Stores complete analysis for one game"""
    player_color: str
    result: str  # '1-0', '0-1', '1/2-1/2'
    moves: List[MoveAnalysis]
    total_moves: int


class ChessAnalyzer:
    """Analyzes chess games using Stockfish engine"""
    
    # Move classification thresholds (in centipawns)
    BRILLIANT_THRESHOLD = -50  # Move that improves position significantly
    BEST_THRESHOLD = 10  # Within 10cp of best move
    GOOD_THRESHOLD = 25  # Within 25cp of best move
    INACCURACY_THRESHOLD = 50  # 50-100cp loss
    MISTAKE_THRESHOLD = 100  # 100-200cp loss
    BLUNDER_THRESHOLD = 200  # 200+ cp loss
    
    def __init__(self, stockfish_path: str = "/usr/games/stockfish"):
        """
        Initialize the chess analyzer
        
        Args:
            stockfish_path: Path to Stockfish executable
        """
        self.stockfish_path = stockfish_path
        self.engine = None
        
    def __enter__(self):
        """Context manager entry - start engine"""
        self.engine = chess.engine.SimpleEngine.popen_uci(self.stockfish_path)
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - close engine"""
        if self.engine:
            self.engine.quit()
    
    def _get_game_phase(self, board: chess.Board, move_number: int) -> str:
        """
        Determine game phase based on material and move number
        
        More accurate than just move count:
        - Opening: First 12 moves OR queens/minor pieces still developing
        - Endgame: Queens traded + limited material
        - Middlegame: Everything else
        """
        # Count pieces
        num_pieces = len(board.piece_map())
        has_queens = bool(board.queens)
        
        # Endgame criteria: few pieces OR queens traded
        if num_pieces <= 12 or (not has_queens and num_pieces <= 16):
            return 'endgame'
        
        # Opening: first 12 moves with lots of pieces
        if move_number <= 12:
            return 'opening'
        
        # Everything else is middlegame
        return 'middlegame'
    
    def _eval_to_centipawns(self, eval_info, perspective_white: bool = True) -> float:
        """
        Convert Stockfish evaluation to centipawns from perspective
        
        Args:
            eval_info: Stockfish evaluation score
            perspective_white: If True, positive = white advantage
            
        Returns:
            Evaluation in centipawns
        """
        if eval_info.is_mate():
            mate_in = eval_info.mate()
            score = 10000 if mate_in > 0 else -10000
        else:
            score = eval_info.score()
        
        # Flip if black's perspective
        if not perspective_white:
            score = -score
            
        return score
    
    def _classify_move(self, cp_loss: float, eval_before: float) -> Dict[str, bool]:
        """
        Classify move quality based on centipawn loss
        
        Args:
            cp_loss: Centipawn loss (always positive)
            eval_before: Position evaluation before move
            
        Returns:
            Dictionary of move classifications
        """
        # Handle brilliant moves (sacrifices that improve position)
        is_brilliant = cp_loss < 0 and eval_before < -100  # Sacrifice in bad position that improves things
        
        # Normal classifications
        is_best = cp_loss <= self.BEST_THRESHOLD
        is_good = cp_loss <= self.GOOD_THRESHOLD and not is_best
        is_inaccuracy = self.INACCURACY_THRESHOLD <= cp_loss < self.MISTAKE_THRESHOLD
        is_mistake = self.MISTAKE_THRESHOLD <= cp_loss < self.BLUNDER_THRESHOLD
        is_blunder = cp_loss >= self.BLUNDER_THRESHOLD
        
        return {
            'is_brilliant': is_brilliant,
            'is_best': is_best,
            'is_good': is_good,
            'is_inaccuracy': is_inaccuracy,
            'is_mistake': is_mistake,
            'is_blunder': is_blunder
        }
    
    def analyze_position(self, board: chess.Board, time_limit: float = 0.1) -> Tuple[float, str]:
        """
        Analyze a single position
        
        Args:
            board: Chess board position
            time_limit: Time limit for analysis in seconds
            
        Returns:
            Tuple of (evaluation in centipawns, best move in UCI format)
        """
        info = self.engine.analyse(board, chess.engine.Limit(time=time_limit))
        eval_cp = self._eval_to_centipawns(info["score"].white(), perspective_white=True)
        best_move = info.get("pv", [None])[0]
        best_move_str = best_move.uci() if best_move else ""
        return eval_cp, best_move_str
    
    def analyze_game(self, pgn_string: str, player_name: str) -> Optional[GameAnalysis]:
        """
        Analyze a complete game from PGN
        
        Args:
            pgn_string: Game in PGN format
            player_name: Name of player to analyze
            
        Returns:
            GameAnalysis object or None if analysis fails
        """
        if not self.engine:
            raise RuntimeError("Engine not initialized. Use 'with' statement.")
        
        # Parse PGN
        pgn = io.StringIO(pgn_string)
        game = chess.pgn.read_game(pgn)
        
        if not game:
            import logging
            logging.warning(f"❌ Could not parse PGN: {pgn_string[:100]}...")
            return None
        
        # Check if game has moves
        mainline = list(game.mainline())
        if not mainline:
            import logging
            logging.warning(f"❌ Game has no moves: {pgn_string[:100]}...")
            return None
        
        import logging
        logging.debug(f"✅ Parsed game with {len(mainline)} moves for player: {player_name}")
        
        # Determine player color
        white_player = game.headers.get("White", "")
        black_player = game.headers.get("Black", "")
        
        if player_name.lower() in white_player.lower():
            player_color = "white"
        elif player_name.lower() in black_player.lower():
            player_color = "black"
        else:
            # If name not found, assume player is white
            player_color = "white"
        
        result = game.headers.get("Result", "*")
        
        # Analyze each move
        board = game.board()
        moves_analysis = []
        move_number = 0
        
        for node in game.mainline():
            move = node.move
            
            # Only analyze moves by our player
            is_white_move = board.turn == chess.WHITE
            if (player_color == "white" and is_white_move) or \
               (player_color == "black" and not is_white_move):
                
                # Get evaluation before the move (from player's perspective)
                eval_before, best_move = self.analyze_position(board)
                if player_color == "black":
                    eval_before = -eval_before
                
                # Make the move
                board.push(move)
                move_number += 1
                
                # Get evaluation after the move
                eval_after, _ = self.analyze_position(board)
                if player_color == "black":
                    eval_after = -eval_after
                
                # Calculate centipawn loss (always positive)
                cp_loss = max(0, eval_before - eval_after)
                
                # Classify move quality
                move_quality = self._classify_move(cp_loss, eval_before)
                
                # Get time left (if available in PGN)
                clock_time = node.clock() if hasattr(node, 'clock') else None
                
                # Determine game phase
                phase = self._get_game_phase(board, move_number)
                
                moves_analysis.append(MoveAnalysis(
                    move_number=move_number,
                    move=move.uci(),
                    eval_before=eval_before,
                    eval_after=eval_after,
                    centipawn_loss=cp_loss,
                    best_move=best_move,
                    time_left=clock_time,
                    phase=phase,
                    **move_quality
                ))
            else:
                # Still push opponent's move
                board.push(move)
        
        return GameAnalysis(
            player_color=player_color,
            result=result,
            moves=moves_analysis,
            total_moves=len(moves_analysis)
        )
    
    def analyze_multiple_games(self, pgn_games: List[str], player_name: str) -> List[GameAnalysis]:
        """
        Analyze multiple games
        
        Args:
            pgn_games: List of PGN strings
            player_name: Player name to analyze
            
        Returns:
            List of GameAnalysis objects
        """
        analyses = []
        for i, pgn in enumerate(pgn_games):
            try:
                analysis = self.analyze_game(pgn, player_name)
                if analysis:
                    analyses.append(analysis)
                    print(f"Analyzed game {i+1}/{len(pgn_games)}")
            except Exception as e:
                print(f"Error analyzing game {i+1}: {e}")
                continue
        return analyses


def extract_features(game_analyses: List[GameAnalysis]) -> Dict[str, float]:
    """
    Extract performance features from analyzed games
    Aligned with ml_trainer.py feature expectations
    
    Args:
        game_analyses: List of GameAnalysis objects
        
    Returns:
        Dictionary of 10 features that ML models were trained on
    """
    # Default 15 features for models (when no games to analyze)
    default_features = {
        'avg_cp_loss': 0.0,
        'blunder_rate': 0.0,
        'mistake_rate': 0.0,
        'inaccuracy_rate': 0.0,
        'avg_move_time': 60.0,
        'time_pressure_moves': 0.0,
        'brilliant_moves': 0.0,
        'best_moves': 0.0,
        'good_moves': 0.0,
        'avg_cp_loss_opening': 0.0,
        'avg_cp_loss_middlegame': 0.0,
        'avg_cp_loss_endgame': 0.0,
        'blunder_rate_opening': 0.0,
        'blunder_rate_middlegame': 0.0,
        'blunder_rate_endgame': 0.0,
    }
    
    if not game_analyses:
        return default_features
    
    all_moves = []
    opening_moves = []
    middlegame_moves = []
    endgame_moves = []
    
    for game in game_analyses:
        for move in game.moves:
            all_moves.append(move)
            
            # Categorize by phase
            if move.phase == 'opening':
                opening_moves.append(move)
            elif move.phase == 'middlegame':
                middlegame_moves.append(move)
            else:
                endgame_moves.append(move)
    
    total_moves = len(all_moves)
    if total_moves == 0:
        import logging
        logging.error(f"❌ extract_features: Games were parsed but have no moves!")
        logging.error(f"   Game count: {len(game_analyses)}")
        for i, g in enumerate(game_analyses[:3]):
            logging.error(f"   Game {i+1}: {len(g.moves)} moves, result={g.result}")
        return default_features  # Return zeros
    
    # Core features for ML model
    features = {}
    
    # Average centipawn loss (overall quality)
    features['avg_cp_loss'] = np.mean([m.centipawn_loss for m in all_moves])
    
    # Error rates
    features['blunder_rate'] = sum(1 for m in all_moves if m.is_blunder) / total_moves
    features['mistake_rate'] = sum(1 for m in all_moves if m.is_mistake) / total_moves
    features['inaccuracy_rate'] = sum(1 for m in all_moves if m.is_inaccuracy) / total_moves
    
    # Good move rates
    features['brilliant_moves'] = sum(1 for m in all_moves if m.is_brilliant) / total_moves
    features['best_moves'] = sum(1 for m in all_moves if m.is_best) / total_moves
    features['good_moves'] = sum(1 for m in all_moves if m.is_good) / total_moves
    
    # Time management
    moves_with_time = [m for m in all_moves if m.time_left is not None]
    if moves_with_time:
        features['avg_move_time'] = np.mean([m.time_left for m in moves_with_time])
        features['time_pressure_moves'] = sum(1 for m in moves_with_time if m.time_left < 30) / len(moves_with_time)
    else:
        features['avg_move_time'] = 60.0  # Default assumption
        features['time_pressure_moves'] = 0.0
    
    # Phase-specific features (for detailed analysis)
    features['avg_cp_loss_opening'] = np.mean([m.centipawn_loss for m in opening_moves]) if opening_moves else 0
    features['avg_cp_loss_middlegame'] = np.mean([m.centipawn_loss for m in middlegame_moves]) if middlegame_moves else 0
    features['avg_cp_loss_endgame'] = np.mean([m.centipawn_loss for m in endgame_moves]) if endgame_moves else 0
    
    features['blunder_rate_opening'] = sum(1 for m in opening_moves if m.is_blunder) / len(opening_moves) if opening_moves else 0
    features['blunder_rate_middlegame'] = sum(1 for m in middlegame_moves if m.is_blunder) / len(middlegame_moves) if middlegame_moves else 0
    features['blunder_rate_endgame'] = sum(1 for m in endgame_moves if m.is_blunder) / len(endgame_moves) if endgame_moves else 0
    
    # Return all 15 features that models were trained with
    all_features = {
        'avg_cp_loss': features['avg_cp_loss'],
        'blunder_rate': features['blunder_rate'],
        'mistake_rate': features['mistake_rate'],
        'inaccuracy_rate': features['inaccuracy_rate'],
        'avg_move_time': features['avg_move_time'],
        'time_pressure_moves': features['time_pressure_moves'],
        'brilliant_moves': features['brilliant_moves'],
        'best_moves': features['best_moves'],
        'good_moves': features['good_moves'],
        'avg_cp_loss_opening': features['avg_cp_loss_opening'],
        'avg_cp_loss_middlegame': features['avg_cp_loss_middlegame'],
        'avg_cp_loss_endgame': features['avg_cp_loss_endgame'],
        'blunder_rate_opening': features['blunder_rate_opening'],
        'blunder_rate_middlegame': features['blunder_rate_middlegame'],
        'blunder_rate_endgame': features['blunder_rate_endgame'],
    }
    
    import logging
    logging.info(f"✓ extract_features returning {len(all_features)} features for ML models")
    return all_features


# Example usage
if __name__ == "__main__":
    # Example PGN
    example_pgn = """
    [Event "Rated Blitz game"]
    [White "Player1"]
    [Black "Player2"]
    [Result "1-0"]
    
    1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Na5 10. Bc2 c5 1-0
    """
    
    # Analyze game
    with ChessAnalyzer() as analyzer:
        analysis = analyzer.analyze_game(example_pgn, "Player1")
        if analysis:
            print(f"Analyzed {analysis.total_moves} moves")
            features = extract_features([analysis])
            print(f"\nExtracted features:")
            for key, value in features.items():
                print(f"  {key}: {value:.3f}")
