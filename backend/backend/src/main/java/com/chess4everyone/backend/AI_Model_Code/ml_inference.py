"""
ML Inference Engine for Chess Analysis
=========================================
Loads trained XGBoost models (+ scalers + label encoders) and runs
predictions on Stockfish-extracted chess game features.

Model files expected in ../AI_Models/:
  opening_model.pkl          opening_scaler.pkl          opening_label_encoder.pkl
  middlegame_model.pkl       middlegame_scaler.pkl       middlegame_label_encoder.pkl
  endgame_model.pkl          endgame_scaler.pkl          endgame_label_encoder.pkl
  tactical_model.pkl         tactical_scaler.pkl         tactical_label_encoder.pkl
  positional_model.pkl       positional_scaler.pkl       positional_label_encoder.pkl
  time_management_model.pkl  time_management_scaler.pkl  time_management_label_encoder.pkl

Label classes (from training): 'average', 'excellent', 'weak'
  → mapped to API output:      'average', 'excellent',  'weak'
  → numeric_score ranges:       34-67,      68-100,      0-33
"""

import os
import platform
import shutil
import logging
import numpy as np
from pathlib import Path
from typing import List, Dict, Optional

try:
    from joblib import load as joblib_load
    JOBLIB_AVAILABLE = True
except ImportError:
    JOBLIB_AVAILABLE = False

import pickle

from chess_analyzer import ChessAnalyzer, extract_features

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Feature sets per model – MUST match the columns used during training
# (see final_training.py FEATURE_SETS dict, Cell 2)
# ─────────────────────────────────────────────────────────────────────────────
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
        "brilliant_moves",
        "inaccuracy_rate",
    ],
    "endgame": [
        "avg_cp_loss_endgame",
        "blunder_rate_endgame",
        "best_moves",
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

# Save-name used when persisting model artefacts (matches training script)
_SAVE_NAME: Dict[str, str] = {
    "opening":         "opening",
    "middlegame":      "middlegame",
    "endgame":         "endgame",
    "tactical":        "tactical",
    "positional":      "positional",
    "time_management": "time_management",
}

# Human-readable display names for strengths / weaknesses lists
_DISPLAY_NAMES: Dict[str, str] = {
    "opening":         "Opening",
    "middlegame":      "Middlegame",
    "endgame":         "Endgame",
    "tactical":        "Tactical play",
    "positional":      "Positional understanding",
    "time_management": "Time management",
}


# ─────────────────────────────────────────────────────────────────────────────
# Helper: load a single .pkl file (joblib preferred, pickle fallback)
# ─────────────────────────────────────────────────────────────────────────────
def _load_pkl(path: str):
    if JOBLIB_AVAILABLE:
        try:
            return joblib_load(path)
        except Exception:
            pass
    with open(path, "rb") as f:
        return pickle.load(f)


# ─────────────────────────────────────────────────────────────────────────────
# Main inference engine
# ─────────────────────────────────────────────────────────────────────────────
class MLInferenceEngine:
    """Load trained XGBoost models and produce per-category predictions."""

    def __init__(self, stockfish_path: Optional[str] = None):
        self.stockfish_path = stockfish_path or self._find_stockfish()
        self.models: Dict[str, object] = {}
        self.scalers: Dict[str, object] = {}
        self.label_encoders: Dict[str, object] = {}
        self._load_all_artefacts()

    # ── Stockfish path detection ──────────────────────────────────────────
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

    # ── Load all artefacts ────────────────────────────────────────────────
    def _load_all_artefacts(self):
        logger.info("🔄 Loading ML model artefacts …")
        logger.info("   Stockfish: %s", self.stockfish_path)

        script_dir = os.path.dirname(os.path.abspath(__file__))
        models_dir = os.path.join(script_dir, "..", "AI_Models")

        for key in FEATURE_MAPPINGS:
            save_name = _SAVE_NAME[key]
            model_path   = os.path.join(models_dir, f"{save_name}_model.pkl")
            scaler_path  = os.path.join(models_dir, f"{save_name}_scaler.pkl")
            encoder_path = os.path.join(models_dir, f"{save_name}_label_encoder.pkl")

            try:
                self.models[key]         = _load_pkl(model_path)
                self.scalers[key]        = _load_pkl(scaler_path)
                self.label_encoders[key] = _load_pkl(encoder_path)
                logger.info("   ✅ %s", key)
            except FileNotFoundError as exc:
                logger.error("   ❌ Missing artefact for '%s': %s", key, exc)
                raise
            except Exception as exc:
                logger.error("   ❌ Failed to load '%s': %s", key, exc)
                raise

        logger.info("✅ All %d models loaded.", len(self.models))

    # ── Public API ────────────────────────────────────────────────────────
    def analyze_games(self, pgn_games: List[str], player_name: str) -> Dict:
        """
        Run Stockfish on every PGN, extract features, predict per-category
        skill level, and return the full response dict consumed by main.py.
        """
        logger.info("🔍 Analyzing %d game(s) for '%s'", len(pgn_games), player_name)

        with ChessAnalyzer(self.stockfish_path, silent=True) as analyzer:
            analyses = analyzer.analyze_multiple_games(pgn_games, player_name)

        if not analyses:
            raise RuntimeError("No games could be analysed (Stockfish returned nothing).")

        features = extract_features(analyses, silent=True)
        logger.info("✅ Features extracted from %d game(s)", len(analyses))

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
            "features":      {k: float(v) for k, v in features.items()},
            "recommendation": recommendation,
        }

    # ── Per-category prediction ───────────────────────────────────────────
    def _predict_all(self, features: Dict[str, float]) -> Dict[str, Dict]:
        return {cat: self._predict_one(cat, features) for cat in FEATURE_MAPPINGS}

    def _predict_one(self, category: str, features: Dict[str, float]) -> Dict:
        """
        1. Build the feature vector for this category.
        2. Scale it with the saved StandardScaler.
        3. Predict with the XGBoost model.
        4. Decode the label via the saved LabelEncoder.
        5. Return {classification, confidence, numeric_score}.
        """
        try:
            feat_names = FEATURE_MAPPINGS[category]
            X_raw = np.array([[features.get(f, 0.0) for f in feat_names]])

            scaler  = self.scalers.get(category)
            model   = self.models.get(category)
            le      = self.label_encoders.get(category)

            if model is None or scaler is None or le is None:
                logger.warning("⚠️  Missing artefact for '%s', returning default.", category)
                return self._default()

            X_scaled = scaler.transform(X_raw)

            if hasattr(model, "predict_proba"):
                proba = model.predict_proba(X_scaled)[0]
                class_idx   = int(np.argmax(proba))
                confidence  = float(np.max(proba))
            else:
                # Regression fallback (shouldn't happen with XGBoost classifier)
                raw = float(model.predict(X_scaled)[0])
                confidence = max(0.0, min(1.0, raw))
                class_idx  = int(round(confidence * (len(le.classes_) - 1)))

            # Decode label  (le.classes_ is sorted alpha: ['average','excellent','weak'])
            label_str = str(le.inverse_transform([class_idx])[0])

            # Map training label → classification + numeric_score
            # Training labels: 'weak' / 'average' / 'excellent'
            classification, numeric_score = self._label_to_output(label_str, confidence)

            return {
                "classification": classification,
                "confidence":     round(confidence, 3),
                "numeric_score":  numeric_score,
            }

        except Exception as exc:
            logger.error("❌ Prediction failed for '%s': %s", category, exc, exc_info=True)
            return self._default()

    # ── Label → output mapping ────────────────────────────────────────────
    @staticmethod
    def _label_to_output(label: str, confidence: float):
        """
        Convert the training label to the classification string and a
        0-100 numeric_score that the Java backend / frontend can display.

        Score bands:
          weak      →  0 – 33   (centre ~17, scaled by confidence)
          average   → 34 – 67   (centre ~50, scaled by confidence)
          excellent → 68 – 100  (centre ~84, scaled by confidence)
        """
        label = label.strip().lower()
        if label == "excellent":
            classification = "excellent"
            numeric_score  = 68 + int(confidence * 32)   # 68 – 100
        elif label == "weak":
            classification = "weak"
            numeric_score  = int(confidence * 33)          # 0 – 33
        else:  # "average"
            classification = "average"
            numeric_score  = 34 + int(confidence * 33)    # 34 – 67

        return classification, max(0, min(100, numeric_score))

    # ── Strengths / weaknesses / recommendation ───────────────────────────
    def _strengths(self, predictions: Dict[str, Dict]) -> List[str]:
        result = []
        for cat, pred in predictions.items():
            if pred["classification"] == "excellent":
                result.append(f"{_DISPLAY_NAMES[cat]} - Excellent")
        return result or ["Balanced performance overall"]

    def _weaknesses(self, predictions: Dict[str, Dict]) -> List[str]:
        result = []
        for cat, pred in predictions.items():
            if pred["classification"] == "weak":
                result.append(_DISPLAY_NAMES[cat])
        return result or ["No significant weaknesses — well-rounded player!"]

    def _recommendation(self, predictions: Dict[str, Dict]) -> str:
        recs = {
            "opening":         "Study opening theory and common opening lines.",
            "middlegame":      "Focus on middlegame planning and piece coordination.",
            "endgame":         "Practice fundamental endgame techniques (K+P, piece endings).",
            "tactical":        "Solve tactical puzzles daily to sharpen your vision.",
            "positional":      "Work on positional understanding and pawn structures.",
            "time_management": "Manage time better — avoid rushing in critical positions.",
        }
        # Weakest category by confidence
        weakest = min(
            ((cat, p) for cat, p in predictions.items() if p["classification"] != "excellent"),
            key=lambda x: x[1]["numeric_score"],
            default=None,
        )
        if weakest is None:
            return "Excellent all round — keep challenging stronger opponents!"
        return recs.get(weakest[0], "Keep analysing your games to improve.")

    # ── Default (error fallback) ──────────────────────────────────────────
    @staticmethod
    def _default() -> Dict:
        return {"classification": "average", "confidence": 0.5, "numeric_score": 50}