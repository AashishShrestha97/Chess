"""
FastAPI Server — Chess4Everyone ML Analysis
============================================
Receives PGN games from the Java backend, runs Stockfish + XGBoost
inference, and returns category-level skill predictions.

POST /analyze-player
  Request  → MLAnalysisRequest  (user_id, player_name, games[{pgn}])
  Response → MLAnalysisResponse (predictions keyed by category name)

The response shape MUST match what ChessMLAnalysisService.java expects:
  predictions = {
    "opening":         {classification, confidence, numeric_score},
    "middlegame":      {classification, confidence, numeric_score},
    "endgame":         {classification, confidence, numeric_score},
    "tactical":        {classification, confidence, numeric_score},
    "positional":      {classification, confidence, numeric_score},  ← mapped to MLPredictions.strategy
    "time_management": {classification, confidence, numeric_score},  ← mapped to MLPredictions.timeManagement
  }
"""

import logging
import warnings
from typing import Dict, List, Optional

import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from ml_inference import MLInferenceEngine

warnings.filterwarnings("ignore", category=DeprecationWarning)

# ─────────────────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# FastAPI app
# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Chess4Everyone ML Analysis API",
    description=(
        "Analyses chess games with Stockfish + trained XGBoost models. "
        "Returns skill predictions for 6 categories: opening, middlegame, "
        "endgame, tactical, positional, time_management."
    ),
    version="2.0.0",
)

ml_engine: Optional[MLInferenceEngine] = None


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic schemas
# ─────────────────────────────────────────────────────────────────────────────

class GameData(BaseModel):
    """Single chess game in PGN format."""
    pgn: str = Field(..., description="Full PGN string of the game")


class AnalysisRequest(BaseModel):
    """
    Sent by ChessMLAnalysisService.java (MLAnalysisRequest DTO).
    Fields match: user_id, player_name, games (List of {pgn}).
    """
    user_id:     str            = Field(..., description="User ID as string")
    player_name: str            = Field(..., description="Player username")
    games:       List[GameData] = Field(..., description="Up to 20 recent games")


class CategoryPrediction(BaseModel):
    """Matches MLCategoryPrediction.java DTO."""
    classification: str   = Field(..., description="excellent | average | weak")
    confidence:     float = Field(..., ge=0.0, le=1.0)
    numeric_score:  int   = Field(..., ge=0,   le=100,
                                  alias="numeric_score",
                                  description="0-100 skill level for UI bar")

    class Config:
        populate_by_name = True


class PredictionsBlock(BaseModel):
    """
    Matches the 'predictions' map that ChessMLAnalysisService.convertMapToMLAnalysisResponse
    iterates over.  Keys are normalised in Java via normalizeCategoryName().
    """
    opening:         CategoryPrediction
    middlegame:      CategoryPrediction
    endgame:         CategoryPrediction
    tactical:        CategoryPrediction
    positional:      CategoryPrediction   # Java maps this → MLPredictions.strategy
    time_management: CategoryPrediction   # Java maps this → MLPredictions.timeManagement


class AnalysisResponse(BaseModel):
    """Matches MLAnalysisResponse.java DTO (snake_case for @JsonProperty)."""
    user_id:         str                    = Field(..., alias="user_id")
    timestamp:       str
    games_analyzed:  int                    = Field(..., alias="games_analyzed")
    predictions:     PredictionsBlock
    strengths:       List[str]
    weaknesses:      List[str]
    features:        Dict[str, float]
    recommendation:  str

    class Config:
        populate_by_name = True


class HealthResponse(BaseModel):
    status:           str
    engine_loaded:    bool
    models_available: List[str]


# ─────────────────────────────────────────────────────────────────────────────
# Lifecycle
# ─────────────────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    global ml_engine
    try:
        logger.info("🚀 Starting Chess ML Analysis API v2 …")
        ml_engine = MLInferenceEngine()
        logger.info("✅ ML Engine ready  |  models: %s", list(ml_engine.models.keys()))
    except Exception as exc:
        logger.error("❌ Startup failed: %s", exc)
        raise


@app.on_event("shutdown")
async def shutdown():
    logger.info("🛑 Shutting down …")


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/", tags=["info"])
async def root():
    return {
        "name":    "Chess4Everyone ML Analysis API",
        "version": "2.0.0",
        "endpoints": {
            "health":  "GET  /health",
            "analyze": "POST /analyze-player",
            "docs":    "GET  /docs",
        },
    }


@app.get("/health", response_model=HealthResponse, tags=["info"])
async def health():
    if ml_engine is None:
        return HealthResponse(status="error", engine_loaded=False, models_available=[])
    return HealthResponse(
        status="ok",
        engine_loaded=True,
        models_available=list(ml_engine.models.keys()),
    )


@app.post("/analyze-player", response_model=AnalysisResponse, tags=["analysis"])
async def analyze_player(request: AnalysisRequest) -> AnalysisResponse:
    """
    Analyse a player's recent games.

    Steps:
      1. Validate input (1-20 games required).
      2. Run Stockfish on every PGN via ChessAnalyzer.
      3. Extract aggregate features.
      4. Predict per-category skill with XGBoost models.
      5. Return structured predictions + strengths / weaknesses.

    Raises:
      400 – no games supplied
      500 – ML engine not ready or analysis failed
    """
    if ml_engine is None:
        raise HTTPException(status_code=500, detail="ML Engine not initialised")

    if not request.games:
        raise HTTPException(status_code=400, detail="At least one game is required")

    # Cap at 20 games (matches Java maxGamesForAnalysis default)
    games = request.games[:20]
    pgn_strings = [g.pgn for g in games]

    logger.info(
        "📊 Analysing %d game(s) for user=%s  player='%s'",
        len(pgn_strings), request.user_id, request.player_name,
    )

    try:
        raw = ml_engine.analyze_games(pgn_strings, request.player_name)
    except Exception as exc:
        logger.error("❌ analysis error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}")

    raw["user_id"] = request.user_id

    # Validate all 6 categories are present (engine always returns them but be safe)
    required = {"opening", "middlegame", "endgame", "tactical", "positional", "time_management"}
    missing = required - set(raw.get("predictions", {}).keys())
    if missing:
        logger.error("Missing categories in predictions: %s", missing)
        raise HTTPException(status_code=500, detail=f"Missing predictions: {missing}")

    try:
        preds_raw = raw["predictions"]
        predictions = PredictionsBlock(
            opening         = CategoryPrediction(**preds_raw["opening"]),
            middlegame      = CategoryPrediction(**preds_raw["middlegame"]),
            endgame         = CategoryPrediction(**preds_raw["endgame"]),
            tactical        = CategoryPrediction(**preds_raw["tactical"]),
            positional      = CategoryPrediction(**preds_raw["positional"]),
            time_management = CategoryPrediction(**preds_raw["time_management"]),
        )

        response = AnalysisResponse(
            user_id        = raw["user_id"],
            timestamp      = raw["timestamp"],
            games_analyzed = raw["games_analyzed"],
            predictions    = predictions,
            strengths      = raw["strengths"],
            weaknesses     = raw["weaknesses"],
            features       = raw["features"],
            recommendation = raw["recommendation"],
        )
    except Exception as exc:
        logger.error("❌ Response construction failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Response serialisation error: {exc}")

    logger.info(
        "✅ Done  |  games=%d  strengths=%d  weaknesses=%d",
        response.games_analyzed, len(response.strengths), len(response.weaknesses),
    )
    return response


# ─────────────────────────────────────────────────────────────────────────────
# Dev launcher
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")