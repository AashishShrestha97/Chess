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


@dataclass
class GameAnalysis:
    """Stores complete analysis for one game"""
    player_color: str
    result: str  # '1-0', '0-1', '1/2-1/2'
    moves: List[MoveAnalysis]
    total_moves: int


class ChessAnalyzer:
    """Analyzes chess games using Stockfish engine"""
    
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
    
    def _get_game_phase(self, move_number: int) -> str:
        """Determine game phase based on move number"""
        if move_number <= 10:
            return 'opening'
        elif move_number <= 30:
            return 'middlegame'
        else:
            return 'endgame'
    
    def _eval_to_centipawns(self, eval_info) -> float:
        """
        Convert Stockfish evaluation to centipawns
        
        Args:
            eval_info: Stockfish evaluation score
            
        Returns:
            Evaluation in centipawns (positive = white advantage)
        """
        if eval_info.is_mate():
            # Mate scores: use large numbers
            mate_in = eval_info.mate()
            return 10000 if mate_in > 0 else -10000
        else:
            return eval_info.score()
    
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
        eval_cp = self._eval_to_centipawns(info["score"].white())
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
            return None
        
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
        move_number = 1
        
        for node in game.mainline():
            move = node.move
            
            # Only analyze moves by our player
            is_white_move = board.turn == chess.WHITE
            if (player_color == "white" and is_white_move) or \
               (player_color == "black" and not is_white_move):
                
                # Get evaluation before the move
                eval_before, best_move = self.analyze_position(board)
                
                # Make the move
                board.push(move)
                
                # Get evaluation after the move
                eval_after, _ = self.analyze_position(board)
                
                # Calculate centipawn loss
                # For white: positive eval is good, for black: negative eval is good
                if player_color == "white":
                    cp_loss = eval_before - eval_after
                else:
                    cp_loss = eval_after - eval_before
                
                # Ensure cp_loss is non-negative (loss is always positive)
                cp_loss = max(0, cp_loss)
                
                # Get time left (if available in PGN)
                clock_time = node.clock() if hasattr(node, 'clock') else None
                
                # Determine game phase
                full_move = (move_number + 1) // 2
                phase = self._get_game_phase(full_move)
                
                moves_analysis.append(MoveAnalysis(
                    move_number=full_move,
                    move=move.uci(),
                    eval_before=eval_before,
                    eval_after=eval_after,
                    centipawn_loss=cp_loss,
                    best_move=best_move,
                    time_left=clock_time,
                    phase=phase
                ))
            else:
                # Still push opponent's move
                board.push(move)
            
            move_number += 1
        
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
        for pgn in pgn_games:
            try:
                analysis = self.analyze_game(pgn, player_name)
                if analysis:
                    analyses.append(analysis)
            except Exception as e:
                print(f"Error analyzing game: {e}")
                continue
        return analyses


def extract_features(game_analyses: List[GameAnalysis]) -> Dict[str, float]:
    """
    Extract performance features from analyzed games
    
    Args:
        game_analyses: List of GameAnalysis objects
        
    Returns:
        Dictionary of extracted features
    """
    if not game_analyses:
        return {}
    
    all_moves = []
    opening_moves = []
    middlegame_moves = []
    endgame_moves = []
    time_pressure_moves = []  # Moves with < 60 seconds
    winning_positions = []  # Positions where eval > 200cp
    losing_positions = []  # Positions where eval < -200cp
    
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
            
            # Time pressure
            if move.time_left and move.time_left < 60:
                time_pressure_moves.append(move)
            
            # Position evaluation
            if move.eval_before > 200:
                winning_positions.append(move)
            elif move.eval_before < -200:
                losing_positions.append(move)
    
    # Calculate features
    features = {}
    
    # Average centipawn loss by phase
    features['avg_cp_loss_opening'] = np.mean([m.centipawn_loss for m in opening_moves]) if opening_moves else 0
    features['avg_cp_loss_middlegame'] = np.mean([m.centipawn_loss for m in middlegame_moves]) if middlegame_moves else 0
    features['avg_cp_loss_endgame'] = np.mean([m.centipawn_loss for m in endgame_moves]) if endgame_moves else 0
    features['avg_cp_loss_overall'] = np.mean([m.centipawn_loss for m in all_moves]) if all_moves else 0
    
    # Blunder rate (moves with > 200cp loss)
    blunders_opening = sum(1 for m in opening_moves if m.centipawn_loss > 200)
    blunders_middlegame = sum(1 for m in middlegame_moves if m.centipawn_loss > 200)
    blunders_endgame = sum(1 for m in endgame_moves if m.centipawn_loss > 200)
    
    features['blunder_rate_opening'] = blunders_opening / len(opening_moves) if opening_moves else 0
    features['blunder_rate_middlegame'] = blunders_middlegame / len(middlegame_moves) if middlegame_moves else 0
    features['blunder_rate_endgame'] = blunders_endgame / len(endgame_moves) if endgame_moves else 0
    features['blunder_rate_overall'] = sum([blunders_opening, blunders_middlegame, blunders_endgame]) / len(all_moves) if all_moves else 0
    
    # Tactical accuracy (moves with > 100cp loss)
    tactical_errors = sum(1 for m in all_moves if m.centipawn_loss > 100)
    features['tactical_error_rate'] = tactical_errors / len(all_moves) if all_moves else 0
    
    # Positional drift (small losses that accumulate)
    small_losses = [m.centipawn_loss for m in all_moves if 20 < m.centipawn_loss < 100]
    features['positional_drift'] = np.mean(small_losses) if small_losses else 0
    features['positional_error_rate'] = len(small_losses) / len(all_moves) if all_moves else 0
    
    # Time pressure performance
    if time_pressure_moves:
        time_pressure_blunders = sum(1 for m in time_pressure_moves if m.centipawn_loss > 200)
        features['time_pressure_blunder_rate'] = time_pressure_blunders / len(time_pressure_moves)
        features['avg_cp_loss_time_pressure'] = np.mean([m.centipawn_loss for m in time_pressure_moves])
    else:
        features['time_pressure_blunder_rate'] = 0
        features['avg_cp_loss_time_pressure'] = 0
    
    # Conversion rate (how well do you play when winning?)
    if winning_positions:
        winning_blunders = sum(1 for m in winning_positions if m.centipawn_loss > 100)
        features['conversion_error_rate'] = winning_blunders / len(winning_positions)
    else:
        features['conversion_error_rate'] = 0
    
    # Defensive accuracy (how well do you defend when losing?)
    if losing_positions:
        defensive_blunders = sum(1 for m in losing_positions if m.centipawn_loss > 200)
        features['defensive_blunder_rate'] = defensive_blunders / len(losing_positions)
    else:
        features['defensive_blunder_rate'] = 0
    
    # Game statistics
    features['total_games'] = len(game_analyses)
    features['total_moves'] = len(all_moves)
    features['avg_moves_per_game'] = len(all_moves) / len(game_analyses) if game_analyses else 0
    
    return features


# Example usage
if __name__ == "__main__":
    # Example PGN
    example_pgn = """
    [Event "Rated Blitz game"]
    [White "Player1"]
    [Black "Player2"]
    [Result "1-0"]
    
    1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 1-0
    """
    
    # Analyze game
    with ChessAnalyzer() as analyzer:
        analysis = analyzer.analyze_game(example_pgn, "Player1")
        if analysis:
            print(f"Analyzed {analysis.total_moves} moves")
            features = extract_features([analysis])
            print(f"Features: {features}")
