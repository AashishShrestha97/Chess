"""
ML Inference Engine for Chess Analysis
========================================
Loads trained models and analyzes chess games using Stockfish
"""

import pickle
import numpy as np
import logging
from pathlib import Path
from typing import List, Dict, Optional
import os
import platform
import shutil

try:
    from joblib import load as joblib_load
    JOBLIB_AVAILABLE = True
except ImportError:
    JOBLIB_AVAILABLE = False

from chess_analyzer import ChessAnalyzer, extract_features

logger = logging.getLogger(__name__)


# ============================================================================
# Feature Mappings - Define which features each model expects
# ============================================================================

FEATURE_MAPPINGS = {
    'opening': [
        'avg_cp_loss_opening',
        'blunder_rate_opening'
    ],
    'middlegame': [
        'avg_cp_loss_middlegame',
        'blunder_rate_middlegame',
        'mistake_rate',
        'best_moves',
        'good_moves'
    ],
    'endgame': [
        'avg_cp_loss_endgame',
        'blunder_rate_endgame',
        'inaccuracy_rate'
    ],
    'tactical': [
        'blunder_rate',
        'brilliant_moves',
        'best_moves',
        'mistake_rate',
        'inaccuracy_rate'
    ],
    'positional': [
        'avg_cp_loss',
        'blunder_rate',
        'mistake_rate',
        'best_moves',
        'good_moves',
        'inaccuracy_rate',
        'brilliant_moves'
    ],
    'time_management': [
        'avg_move_time',
        'time_pressure_moves',
        'blunder_rate',
        'mistake_rate',
        'avg_cp_loss'
    ]
}


# ============================================================================
# MLInferenceEngine Class
# ============================================================================

class MLInferenceEngine:
    """
    Handles loading ML models and making predictions on chess games
    """
    
    def __init__(self, stockfish_path: Optional[str] = None):
        """
        Initialize ML engine by loading all models
        
        Args:
            stockfish_path: Path to Stockfish executable (auto-detected if None)
        """
        self.models = {}
        self.stockfish_path = stockfish_path or self._find_stockfish_path()
        self._load_models()
    
    def _find_stockfish_path(self) -> str:
        """Detect Stockfish location based on OS"""
        common_paths = {
            'Windows': [
                'C:\\Program Files\\Stockfish\\stockfish.exe',
                'C:\\Program Files (x86)\\Stockfish\\stockfish.exe',
                'C:\\stockfish\\stockfish.exe',
                'stockfish.exe'
            ],
            'Linux': [
                '/usr/games/stockfish',
                '/usr/bin/stockfish',
                '/usr/local/bin/stockfish'
            ],
            'Darwin': [  # macOS
                '/usr/local/bin/stockfish',
                '/opt/homebrew/bin/stockfish'
            ]
        }
        
        system = platform.system()
        paths_to_check = common_paths.get(system, [])
        
        # Check common locations
        for path in paths_to_check:
            if os.path.exists(path) or shutil.which(path):
                return path
        
        # Try PATH
        stockfish = shutil.which('stockfish')
        if stockfish:
            return stockfish
        
        # Default fallback
        return 'stockfish.exe' if system == 'Windows' else '/usr/games/stockfish'
    
    def _load_models(self):
        """Load all trained models from disk"""
        logger.info("🔄 Loading ML models...")
        
        logger.info(f"✅ Stockfish found at: {self.stockfish_path}")
        
        # Determine models directory
        script_dir = os.path.dirname(os.path.abspath(__file__))
        models_dir = os.path.join(script_dir, "..", "AI_Models")
        
        model_files = {
            'opening': 'opening_model.pkl',
            'middlegame': 'middlegame_model.pkl',
            'endgame': 'endgame_model.pkl',
            'tactical': 'tactics_model.pkl',
            'positional': 'strategy_model.pkl',
            'time_management': 'time_management_model.pkl'
        }
        
        for key, filename in model_files.items():
            path = os.path.join(models_dir, filename)
            try:
                if JOBLIB_AVAILABLE:
                    try:
                        self.models[key] = joblib_load(path)
                    except Exception as e:
                        logger.warning(f"Joblib failed for {filename}, trying pickle: {e}")
                        with open(path, 'rb') as f:
                            self.models[key] = pickle.load(f)
                else:
                    with open(path, 'rb') as f:
                        self.models[key] = pickle.load(f)
                logger.info(f"  ✅ Loaded {key} model")
            except FileNotFoundError:
                logger.error(f"  ❌ Model not found: {path}")
                raise
            except Exception as e:
                logger.error(f"  ❌ Error loading {filename}: {e}")
                raise
        
        logger.info(f"✅ All {len(self.models)} models loaded successfully")
        
        # Verify models
        logger.info("🔍 Verifying loaded models...")
        for key, model in self.models.items():
            logger.info(f"   {key}:")
            logger.info(f"      Type: {type(model).__name__}")
            logger.info(f"      Has predict: {hasattr(model, 'predict')}")
            logger.info(f"      Has predict_proba: {hasattr(model, 'predict_proba')}")
    
    def analyze_games(self, pgn_games: List[str], player_name: str) -> Dict:
        """
        Analyze multiple games using ML models
        
        Args:
            pgn_games: List of PGN strings
            player_name: Name of the player to analyze
            
        Returns:
            Dict with predictions, strengths, weaknesses, and recommendations
        """
        logger.info(f"🔍 Starting analysis for {player_name} with {len(pgn_games)} games")
        
        try:
            with ChessAnalyzer(self.stockfish_path) as analyzer:
                game_analyses = analyzer.analyze_multiple_games(pgn_games, player_name)
        except Exception as e:
            logger.error(f"❌ Error analyzing games: {e}")
            raise
        
        if not game_analyses:
            logger.error("❌ No games analyzed successfully")
            return {}
        
        features = extract_features(game_analyses)
        logger.info(f"✅ Extracted features from {len(game_analyses)} games")
        
        predictions = self._get_predictions(features)
        strengths = self._determine_strengths(predictions)
        weaknesses = self._determine_weaknesses(predictions)
        
        logger.info(f"📊 Analysis complete: {len(strengths)} strengths, {len(weaknesses)} weaknesses")
        
        return {
            'user_id': player_name,
            'timestamp': str(np.datetime64('now')),
            'games_analyzed': len(game_analyses),
            'predictions': predictions,
            'strengths': strengths,
            'weaknesses': weaknesses,
            'features': features,
            'recommendation': self._generate_recommendation(weaknesses, predictions)
        }
    
    def _get_predictions(self, features: Dict[str, float]) -> Dict[str, Dict]:
        """
        Run features through ML models and get predictions
        
        Returns dict with structure:
        {
            'opening': {'classification': 'good', 'confidence': 0.82, 'numeric_score': 82},
            'middlegame': {...},
            ...
        }
        """
        predictions = {}
        
        logger.info("📊 Input features for analysis:")
        for feature_name, feature_value in features.items():
            logger.info(f"   {feature_name}: {feature_value:.4f}")
        
        # Check if models are actual ML models or just dicts
        use_rule_based = False
        if self.models:
            first_model = list(self.models.values())[0]
            if isinstance(first_model, dict) or not hasattr(first_model, 'predict'):
                logger.warning("⚠️ Models are not trained ML models - using rule-based analysis")
                use_rule_based = True
        
        # Get predictions for each category
        for category in ['opening', 'middlegame', 'endgame', 'tactical', 'positional', 'time_management']:
            logger.info(f"🔮 Analyzing {category}...")
            
            if use_rule_based:
                predictions[category] = self._classify_prediction_rule_based(category, features)
            else:
                predictions[category] = self._classify_prediction(category, features)
                
            logger.info(f"   Result: {predictions[category]}")
        
        return predictions
    
    def _classify_prediction(self, category: str, features_dict: Dict[str, float]) -> Dict:
        """
        Get classification from model using the correct subset of features
        
        Args:
            category: Category to analyze (opening, middlegame, etc.)
            features_dict: Dictionary of all available features
        
        Returns:
            {
                'classification': 'good',  # excellent, good, average, weak
                'confidence': 0.82,        # 0.0-1.0
                'numeric_score': 82        # 0-100
            }
        """
        try:
            # Map category to model key
            model_key_map = {
                'opening': 'opening',
                'middlegame': 'middlegame',
                'endgame': 'endgame',
                'tactical': 'tactical',
                'positional': 'positional',
                'time_management': 'time_management'
            }
            
            model_key = model_key_map.get(category, category)
            model = self.models.get(model_key)
            
            logger.info(f"🔍 Model check for {category}: model_key={model_key}, model_exists={model is not None}")
            
            if model is None:
                logger.warning(f"⚠️ Model {model_key} not loaded - using default")
                return self._default_classification()
            
            # Get the specific features this model expects
            feature_names = FEATURE_MAPPINGS.get(model_key)
            
            if feature_names is None:
                logger.error(f"❌ No feature mapping defined for {model_key}")
                return self._default_classification()
            
            # Build feature array in the correct order for this specific model
            X = np.array([[features_dict.get(f, 0.0) for f in feature_names]])
            
            logger.info(f"📊 Features for {category} ({len(feature_names)} features):")
            for i, f in enumerate(feature_names):
                logger.info(f"   {f}: {X[0][i]:.4f}")
            
            # Get prediction from model
            if hasattr(model, 'predict_proba'):
                # Classification model - returns probabilities for each class
                proba = model.predict_proba(X)[0]
                predicted_class = int(np.argmax(proba))
                confidence = float(np.max(proba))
                
                logger.info(f"   predict_proba: {proba}, class={predicted_class}, conf={confidence:.3f}")
                
                # Map class to classification and numeric score
                # Assuming: 0=weak, 1=average, 2=excellent/good
                if predicted_class == 0:
                    classification = 'weak'
                    numeric_score = int(confidence * 33)  # 0-33 range
                elif predicted_class == 1:
                    classification = 'average'  
                    numeric_score = 34 + int(confidence * 33)  # 34-67 range
                else:  # predicted_class == 2
                    classification = 'excellent'
                    numeric_score = 68 + int(confidence * 32)  # 68-100 range
                
                logger.info(f"✅ {category}: class={predicted_class} -> {classification}, score={numeric_score}, conf={confidence:.2f}")
                
            elif hasattr(model, 'predict'):
                # Regression model - returns continuous value
                prediction = model.predict(X)[0]
                
                logger.info(f"   predict: {prediction} (type: {type(prediction)})")
                
                # Normalize prediction to 0-1 range
                if isinstance(prediction, (int, float)):
                    # Assuming model outputs 0-1 range (adjust if your models output different range)
                    normalized = max(0.0, min(1.0, float(prediction)))
                    numeric_score = int(normalized * 100)
                    confidence = normalized
                    
                    # Determine classification from score
                    if numeric_score >= 68:
                        classification = 'excellent'
                    elif numeric_score >= 34:
                        classification = 'average'
                    else:
                        classification = 'weak'
                    
                    logger.info(f"✅ {category}: regression={prediction:.3f} -> score={numeric_score}, class={classification}")
                else:
                    logger.warning(f"⚠️ Unexpected prediction type: {type(prediction)}")
                    return self._default_classification()
            else:
                logger.warning(f"⚠️ Model {model_key} has no predict method")
                return self._default_classification()
            
            # Final safety clamps
            confidence = max(0.0, min(1.0, confidence))
            numeric_score = max(0, min(100, numeric_score))
            
            return {
                'classification': classification,
                'confidence': float(np.round(confidence, 2)),
                'numeric_score': numeric_score
            }
            
        except Exception as e:
            logger.error(f"❌ Error predicting with {category}: {e}")
            import traceback
            traceback.print_exc()
            return self._default_classification()
    
    def _classify_prediction_rule_based(self, category: str, features: Dict[str, float]) -> Dict:
        """
        Rule-based classification when ML models aren't available
        Uses game statistics to determine player strength in each category
        """
        
        # Extract key metrics
        avg_cp_loss = features.get('avg_cp_loss', 0.0)
        blunder_rate = features.get('blunder_rate', 0.0)
        mistake_rate = features.get('mistake_rate', 0.0)
        best_moves = features.get('best_moves', 0.0)
        brilliant_moves = features.get('brilliant_moves', 0.0)
        good_moves = features.get('good_moves', 0.0)
        
        # Category-specific features
        if category == 'opening':
            avg_loss = features.get('avg_cp_loss_opening', avg_cp_loss)
            blunders = features.get('blunder_rate_opening', blunder_rate)
        elif category == 'middlegame':
            avg_loss = features.get('avg_cp_loss_middlegame', avg_cp_loss)
            blunders = features.get('blunder_rate_middlegame', blunder_rate)
        elif category == 'endgame':
            avg_loss = features.get('avg_cp_loss_endgame', avg_cp_loss)
            blunders = features.get('blunder_rate_endgame', blunder_rate)
        elif category == 'tactical':
            # Tactical strength: low blunders + high best moves = good
            accuracy = 1.0 - blunder_rate - mistake_rate * 0.5
            tactical_score = accuracy * 60 + best_moves * 30 + brilliant_moves * 10
            return self._score_to_result(max(0, min(100, tactical_score)))
        elif category == 'positional':
            # Positional: overall game quality
            accuracy = 1.0 - blunder_rate - mistake_rate * 0.7
            quality = best_moves * 0.3 + good_moves * 0.2
            positional_score = accuracy * 70 + quality * 100
            return self._score_to_result(max(0, min(100, positional_score)))
        elif category == 'time_management':
            time_pressure = features.get('time_pressure_moves', 0.0)
            time_score = (1.0 - time_pressure) * 70 + (1.0 - blunder_rate) * 30
            return self._score_to_result(max(0, min(100, time_score)))
        else:
            avg_loss = avg_cp_loss
            blunders = blunder_rate
        
        # Calculate score for phase-based categories (opening, middlegame, endgame)
        if category in ['opening', 'middlegame', 'endgame']:
            if avg_loss < 30 and blunders < 0.05:
                base_score = 85
                bonus = (30 - avg_loss) * 0.5
                blunder_penalty = blunders * 200
                score = base_score + bonus - blunder_penalty
            elif avg_loss < 80 and blunders < 0.15:
                base_score = 70
                bonus = (80 - avg_loss) * 0.3
                blunder_penalty = blunders * 100
                score = base_score + bonus - blunder_penalty
            elif avg_loss < 150 and blunders < 0.30:
                base_score = 50
                bonus = (150 - avg_loss) * 0.2
                blunder_penalty = blunders * 60
                score = base_score + bonus - blunder_penalty
            else:
                base_score = 25
                penalty = (avg_loss - 150) * 0.15 + blunders * 50
                score = base_score - penalty
            
            return self._score_to_result(max(0, min(100, score)))
        
        # Default fallback
        return self._score_to_result(50)
    
    def _score_to_result(self, score: float) -> Dict:
        """Convert numeric score (0-100) to classification result"""
        score = max(0.0, min(100.0, float(score)))
        
        if score >= 68:
            classification = 'excellent'
        elif score >= 34:
            classification = 'average'
        else:
            classification = 'weak'
        
        confidence = score / 100.0
        
        return {
            'classification': classification,
            'confidence': round(confidence, 2),
            'numeric_score': int(score)
        }
    
    def _default_classification(self) -> Dict:
        """Return default classification when prediction fails"""
        return {
            'classification': 'average',
            'confidence': 0.5,
            'numeric_score': 50
        }
    
    def _determine_strengths(self, predictions: Dict[str, Dict]) -> List[str]:
        """Identify player strengths from predictions"""
        strengths = []
        
        category_names = {
            'opening': 'Opening',
            'middlegame': 'Middlegame',
            'endgame': 'Endgame',
            'tactical': 'Tactical play',
            'positional': 'Positional understanding',
            'time_management': 'Time management'
        }
        
        for category, prediction in predictions.items():
            classification = prediction.get('classification', 'average')
            confidence = prediction.get('confidence', 0.5)
            
            if classification in ['excellent', 'good']:
                strength_text = f"{category_names.get(category, category)} - {classification.capitalize()}"
                strengths.append(strength_text)
        
        return strengths if strengths else ["Balanced performance overall"]
    
    def _determine_weaknesses(self, predictions: Dict[str, Dict]) -> List[str]:
        """Identify player weaknesses from predictions"""
        weaknesses = []
        
        category_names = {
            'opening': 'Opening',
            'middlegame': 'Middlegame',
            'endgame': 'Endgame',
            'tactical': 'Tactical play',
            'positional': 'Positional understanding',
            'time_management': 'Time management'
        }
        
        for category, prediction in predictions.items():
            classification = prediction.get('classification', 'average')
            
            if classification in ['weak', 'average']:
                weaknesses.append(category_names.get(category, category))
        
        return weaknesses if weaknesses else ["No significant weaknesses - well-rounded player!"]
    
    def _generate_recommendation(self, weaknesses: List[str], predictions: Dict[str, Dict]) -> str:
        """Generate personalized recommendation based on analysis"""
        if not weaknesses or len(weaknesses) <= 1:
            return "Maintain your high level of play. Continue analyzing your games and challenging stronger opponents."
        
        # Find weakest category
        weakest_category = min(
            predictions.items(),
            key=lambda x: x[1].get('confidence', 0.5)
        )[0]
        
        recommendations = {
            'opening': "Study opening theory and common opening lines for your preferred styles.",
            'middlegame': "Focus on middlegame planning and piece coordination strategies.",
            'endgame': "Practice fundamental endgame techniques (king and pawn, piece endgames, etc.)",
            'tactical': "Solve tactical puzzles daily to sharpen your tactical vision.",
            'positional': "Work on positional understanding and pawn structure knowledge.",
            'time_management': "Manage time better - avoid rushing in critical positions."
        }
        
        return recommendations.get(
            weakest_category,
            "Work on improving your identified weak areas to become a stronger player."
        )