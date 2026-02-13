"""
ML Inference Engine - ULTRA DETERMINISTIC VERSION
==================================================
Maximum determinism for tactical and positional predictions.

Key fixes:
1. Explicit random seed everywhere
2. Sorted dictionary operations
3. Decimal precision for XGBoost inputs
4. Deterministic argmax with tie-breaking
5. Feature vector type enforcement
"""

import os
import platform
import shutil
import logging
import numpy as np
from pathlib import Path
from typing import List, Dict, Optional
from decimal import Decimal, ROUND_HALF_UP

try:
    from joblib import load as joblib_load
    JOBLIB_AVAILABLE = True
except ImportError:
    JOBLIB_AVAILABLE = False

import pickle

from chess_analyzer import ChessAnalyzer, extract_features

logger = logging.getLogger(__name__)

# Set seeds globally
RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)
import random
random.seed(RANDOM_SEED)


FEATURE_MAPPINGS: Dict[str, List[str]] = {
    "opening": [
        "avg_cp_loss_opening",
        "blunder_rate_opening",
    ],
    "middlegame": [
        "avg_cp_loss_middlegame",
        "blunder_rate_middlegame",
        "mistake_rate",
        "best_moves",
        "good_moves",
    ],
    "endgame": [
        "avg_cp_loss_endgame",
        "blunder_rate_endgame",
        "best_moves",
        "good_moves",
        "brilliant_moves",
        "avg_cp_loss",
    ],
    "tactical": [
        "blunder_rate",
        "brilliant_moves",
        "best_moves",
        "mistake_rate",
        "good_moves",
    ],
    "positional": [
        "avg_cp_loss",
        "blunder_rate",
        "mistake_rate",
        "best_moves",
        "good_moves",
        "brilliant_moves",
    ],
    "time_management": [
        "avg_move_time",
        "time_pressure_moves",
        "blunder_rate",
        "mistake_rate",
        "avg_cp_loss",
    ],
}

_SAVE_NAME: Dict[str, str] = {
    "opening":         "opening",
    "middlegame":      "middlegame",
    "endgame":         "endgame",
    "tactical":        "tactical",
    "positional":      "positional",
    "time_management": "time_management",
}

_DISPLAY_NAMES: Dict[str, str] = {
    "opening":         "Opening",
    "middlegame":      "Middlegame",
    "endgame":         "Endgame",
    "tactical":        "Tactical play",
    "positional":      "Positional understanding",
    "time_management": "Time management",
}


def _load_pkl(path: str):
    if JOBLIB_AVAILABLE:
        try:
            return joblib_load(path)
        except Exception:
            pass
    with open(path, "rb") as f:
        return pickle.load(f)


def ultra_round(value: float, decimals: int = 8) -> float:
    """Ultra-precise rounding using Decimal"""
    d = Decimal(str(value))
    return float(d.quantize(Decimal(10) ** -decimals, rounding=ROUND_HALF_UP))


class MLInferenceEngine:
    """ULTRA DETERMINISTIC ML inference engine"""
    
    RANDOM_SEED = 42
    
    def __init__(self, stockfish_path: Optional[str] = None):
        # Reset all random seeds
        np.random.seed(self.RANDOM_SEED)
        random.seed(self.RANDOM_SEED)
        
        self.stockfish_path = stockfish_path or self._find_stockfish()
        self.models: Dict[str, object] = {}
        self.scalers: Dict[str, object] = {}
        self.label_encoders: Dict[str, object] = {}
        self._load_all_artefacts()

    def _find_stockfish(self) -> str:
        candidates = {
            "Windows": [
                "C:\\Program Files\\Stockfish\\stockfish.exe",
                "C:\\stockfish\\stockfish.exe",
                "stockfish.exe",
            ],
            "Linux": ["/usr/games/stockfish", "/usr/bin/stockfish", "/usr/local/bin/stockfish"],
            "Darwin": ["/usr/local/bin/stockfish", "/opt/homebrew/bin/stockfish"],
        }
        system = platform.system()
        for p in candidates.get(system, []):
            if os.path.exists(p) or shutil.which(p):
                return p
        found = shutil.which("stockfish")
        if found:
            return found
        return "stockfish.exe" if system == "Windows" else "/usr/games/stockfish"

    def _load_all_artefacts(self):
        logger.info("🔄 Loading ML model artefacts (ULTRA DETERMINISTIC MODE) …")
        logger.info("   Stockfish: %s", self.stockfish_path)
        logger.info("   Random Seed: %d", self.RANDOM_SEED)

        script_dir = os.path.dirname(os.path.abspath(__file__))
        models_dir = os.path.join(script_dir, "..", "AI_Models")

        # Load in sorted order for consistency
        for key in sorted(FEATURE_MAPPINGS.keys()):
            save_name = _SAVE_NAME[key]
            model_path   = os.path.join(models_dir, f"{save_name}_model.pkl")
            scaler_path  = os.path.join(models_dir, f"{save_name}_scaler.pkl")
            encoder_path = os.path.join(models_dir, f"{save_name}_label_encoder.pkl")

            try:
                model = _load_pkl(model_path)
                
                # Force deterministic settings on XGBoost model
                if hasattr(model, 'random_state'):
                    model.random_state = self.RANDOM_SEED
                if hasattr(model, 'n_jobs'):
                    model.n_jobs = 1  # Single thread
                if hasattr(model, 'set_params'):
                    try:
                        model.set_params(random_state=self.RANDOM_SEED, n_jobs=1)
                    except:
                        pass
                
                self.models[key] = model
                self.scalers[key] = _load_pkl(scaler_path)
                self.label_encoders[key] = _load_pkl(encoder_path)
                
                scaler = self.scalers[key]
                if hasattr(scaler, 'n_features_in_'):
                    expected_features = scaler.n_features_in_
                    provided_features = len(FEATURE_MAPPINGS[key])
                    logger.info(f"   ✅ {key}: expects {expected_features} features, mapping provides {provided_features}")
                    
                    if expected_features != provided_features:
                        logger.error(f"   ❌ MISMATCH for {key}!")
                        raise ValueError(f"Feature count mismatch for {key}")
                else:
                    logger.info("   ✅ %s", key)
                    
            except FileNotFoundError as exc:
                logger.error("   ❌ Missing artefact for '%s': %s", key, exc)
                raise
            except Exception as exc:
                logger.error("   ❌ Failed to load '%s': %s", key, exc)
                raise

        logger.info("✅ All %d models loaded in ULTRA DETERMINISTIC mode.", len(self.models))

    def analyze_games(self, pgn_games: List[str], player_name: str) -> Dict:
        """
        ULTRA DETERMINISTIC analysis
        """
        logger.info("🔍 Analyzing %d game(s) for '%s' (DETERMINISTIC)", len(pgn_games), player_name)

        with ChessAnalyzer(self.stockfish_path, silent=True) as analyzer:
            analyses = analyzer.analyze_multiple_games(pgn_games, player_name)

        if not analyses:
            raise RuntimeError("No games could be analysed.")

        features = extract_features(analyses, silent=True)
        logger.info("✅ Features extracted from %d game(s)", len(analyses))
        
        # Log features in sorted order
        logger.info("📊 Extracted features (sorted):")
        for feat_key in sorted(features.keys()):
            logger.info(f"   - {feat_key}: {features[feat_key]:.8f}")

        predictions   = self._predict_all(features)
        strengths     = self._strengths(predictions)
        weaknesses    = self._weaknesses(predictions)
        recommendation = self._recommendation(predictions)

        return {
            "user_id":       player_name,
            "timestamp":     str(np.datetime64("now")),
            "games_analyzed": len(analyses),
            "predictions":   predictions,
            "strengths":     strengths,
            "weaknesses":    weaknesses,
            "features":      {k: ultra_round(v) for k, v in features.items()},
            "recommendation": recommendation,
        }

    def _predict_all(self, features: Dict[str, float]) -> Dict[str, Dict]:
        """Predict in SORTED order"""
        return {cat: self._predict_one(cat, features) 
                for cat in sorted(FEATURE_MAPPINGS.keys())}

    def _predict_one(self, category: str, features: Dict[str, float]) -> Dict:
        """
        ULTRA DETERMINISTIC prediction
        """
        try:
            feat_names = FEATURE_MAPPINGS[category]
            
            # Build feature vector with ultra-precise rounding
            feature_values = []
            for f in feat_names:
                if f not in features:
                    logger.warning(f"⚠️  Feature '{f}' missing for {category}, using 0.0")
                    feature_values.append(0.0)
                else:
                    # Ultra-precise rounding
                    feature_values.append(ultra_round(features[f]))
            
            # Check for insufficient phase data
            if category in ['opening', 'middlegame', 'endgame']:
                phase_prefix = category
                phase_features = [f for f in feat_names if phase_prefix in f]
                if phase_features:
                    phase_values = [features.get(f, 0.0) for f in phase_features]
                    if all(v == 0.0 for v in phase_values):
                        logger.warning(f"⚠️  No {category} data, returning neutral")
                        return {
                            "classification": "average",
                            "confidence": 0.5,
                            "numeric_score": 50,
                        }
            
            # Strict dtype enforcement
            X_raw = np.array([feature_values], dtype=np.float64)
            
            logger.debug(f"   {category}: {feat_names}")
            logger.debug(f"   {category}: {feature_values}")

            scaler  = self.scalers.get(category)
            model   = self.models.get(category)
            le      = self.label_encoders.get(category)

            if model is None or scaler is None or le is None:
                logger.warning("⚠️  Missing artefact for '%s'", category)
                return self._default()

            # Scale with strict precision
            X_scaled = scaler.transform(X_raw)
            X_scaled = X_scaled.astype(np.float64)

            if hasattr(model, "predict_proba"):
                # Get probabilities
                proba = model.predict_proba(X_scaled)[0]
                
                # DETERMINISTIC argmax with tie-breaking
                max_prob = np.max(proba)
                max_indices = np.where(proba == max_prob)[0]
                
                # If tie, use first index (deterministic)
                class_idx = int(max_indices[0])
                confidence = float(max_prob)
                
                # Ultra-precise rounding
                confidence = ultra_round(confidence, decimals=6)
            else:
                # Regression fallback
                raw = float(model.predict(X_scaled)[0])
                confidence = max(0.0, min(1.0, raw))
                confidence = ultra_round(confidence, decimals=6)
                class_idx  = int(round(confidence * (len(le.classes_) - 1)))

            # Decode label
            label_str = str(le.inverse_transform([class_idx])[0])
            classification, numeric_score = self._label_to_output(label_str, confidence)

            result = {
                "classification": classification,
                "confidence":     confidence,
                "numeric_score":  numeric_score,
            }
            
            logger.info(f"   ✅ {category}: {classification} (conf={confidence:.6f}, score={numeric_score})")
            return result

        except Exception as exc:
            logger.error("❌ Prediction failed for '%s': %s", category, exc, exc_info=True)
            return self._default()
    
    @staticmethod
    def _label_to_output(label: str, confidence: float):
        """Deterministic label to output conversion"""
        label = label.strip().lower()
        
        # Use Decimal for exact calculation
        conf_decimal = Decimal(str(confidence))
        
        if label == "excellent":
            classification = "excellent"
            score_calc = 68 + int((conf_decimal * 32).to_integral_value(rounding=ROUND_HALF_UP))
            numeric_score = score_calc
        elif label == "weak":
            classification = "weak"
            score_calc = int((conf_decimal * 33).to_integral_value(rounding=ROUND_HALF_UP))
            numeric_score = score_calc
        else:  # "average"
            classification = "average"
            score_calc = 34 + int((conf_decimal * 33).to_integral_value(rounding=ROUND_HALF_UP))
            numeric_score = score_calc

        return classification, max(0, min(100, numeric_score))

    def _strengths(self, predictions: Dict[str, Dict]) -> List[str]:
        """Extract strengths in sorted order"""
        result = []
        for cat in sorted(predictions.keys()):
            pred = predictions[cat]
            if pred["classification"] == "excellent":
                result.append(f"{_DISPLAY_NAMES[cat]} - Excellent")
        return result or ["Balanced performance overall"]

    def _weaknesses(self, predictions: Dict[str, Dict]) -> List[str]:
        """Extract weaknesses in sorted order"""
        result = []
        for cat in sorted(predictions.keys()):
            pred = predictions[cat]
            if pred["classification"] == "weak":
                result.append(_DISPLAY_NAMES[cat])
        return result or ["No significant weaknesses — well-rounded player!"]

    def _recommendation(self, predictions: Dict[str, Dict]) -> str:
        """Deterministic recommendation"""
        recs = {
            "opening":         "Study opening theory and common opening lines.",
            "middlegame":      "Focus on middlegame planning and piece coordination.",
            "endgame":         "Practice fundamental endgame techniques (K+P, piece endings).",
            "tactical":        "Solve tactical puzzles daily to sharpen your vision.",
            "positional":      "Work on positional understanding and pawn structures.",
            "time_management": "Manage time better — avoid rushing in critical positions.",
        }
        
        # Get non-excellent categories
        weak_cats = [(cat, p) for cat, p in predictions.items() 
                     if p["classification"] != "excellent"]
        
        if not weak_cats:
            return "Excellent all round — keep challenging stronger opponents!"
        
        # Sort by numeric_score (ascending), then by category name
        weak_cats.sort(key=lambda x: (x[1]["numeric_score"], x[0]))
        weakest_cat = weak_cats[0][0]
        
        return recs.get(weakest_cat, "Keep analysing your games to improve.")

    @staticmethod
    def _default() -> Dict:
        return {"classification": "average", "confidence": 0.5, "numeric_score": 50}