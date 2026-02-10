"""
FastAPI Server for Chess Player ML Analysis
=============================================
Receives game data from Java backend, analyzes it using trained models,
and returns player strength/weakness predictions.

Endpoint:
  POST /analyze-player
  
Request format:
{
    "user_id": "123",
    "player_name": "PlayerName",
    "games": [
        {"pgn": "...PGN string..."},
        {"pgn": "...PGN string..."}
    ]
}

Response format:
{
    "user_id": "123",
    "timestamp": "2024-02-05T...",
    "games_analyzed": 10,
    "predictions": {
        "opening": {"classification": "good", "confidence": 0.82, "numeric_score": 82},
        "middlegame": {...},
        ...
    },
    "strengths": ["Strong opening play", ...],
    "weaknesses": ["Weak endgame", ...],
    "features": {...},
    "recommendation": "..."
}
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
import logging
import uvicorn
from ml_inference import MLInferenceEngine

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Chess4Everyone ML Analysis API",
    description="Analyzes chess games using trained ML models",
    version="1.0.0"
)

# Initialize ML engine globally
ml_engine: Optional[MLInferenceEngine] = None


# ============================================================
# Pydantic Models for Request/Response
# ============================================================

class GameData(BaseModel):
    """Single game in PGN format"""
    pgn: str = Field(..., description="PGN notation of the chess game")


class AnalysisRequest(BaseModel):
    """Request to analyze player games"""
    user_id: str = Field(..., description="Unique user ID")
    player_name: str = Field(..., description="Player name/username")
    games: List[GameData] = Field(..., description="List of games to analyze (up to 10)")


class PredictionResult(BaseModel):
    """Single category prediction result"""
    classification: str = Field(..., description="excellent, good, average, or weak")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score 0-1")
    numeric_score: int = Field(..., ge=0, le=100, description="Numeric score 0-100")


class AnalysisResponse(BaseModel):
    """Response with player analysis"""
    user_id: str
    timestamp: str
    games_analyzed: int
    predictions: Dict[str, PredictionResult]
    strengths: List[str]
    weaknesses: List[str]
    features: Dict[str, float]
    recommendation: str


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    engine_loaded: bool
    models_available: List[str]


# ============================================================
# Startup/Shutdown
# ============================================================

# Suppress deprecation warnings
import warnings
warnings.filterwarnings('ignore', category=DeprecationWarning)

@app.on_event("startup")
async def startup_event():
    """Initialize ML engine on startup"""
    global ml_engine
    try:
        logger.info("🚀 Starting Chess ML Analysis API...")
        ml_engine = MLInferenceEngine()
        logger.info("✅ ML Engine initialized successfully")
    except Exception as e:
        logger.error(f"❌ Failed to initialize ML Engine: {e}")
        raise


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("🛑 Shutting down Chess ML Analysis API...")


# ============================================================
# API Endpoints
# ============================================================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check if API is running and models are loaded"""
    if ml_engine is None:
        return HealthResponse(
            status="error",
            engine_loaded=False,
            models_available=[]
        )
    
    return HealthResponse(
        status="ok",
        engine_loaded=True,
        models_available=list(ml_engine.models.keys())
    )


@app.post("/analyze-player", response_model=AnalysisResponse)
async def analyze_player(request: AnalysisRequest) -> AnalysisResponse:
    """
    Analyze player's chess games using ML models
    
    Takes up to 10 recent games, analyzes them with Stockfish,
    extracts features, and classifies player strengths/weaknesses
    using trained ML models.
    
    Args:
        request: Analysis request with games and player info
        
    Returns:
        Analysis result with predictions and recommendations
        
    Raises:
        HTTPException: If no games provided or analysis fails
    """
    if ml_engine is None:
        logger.error("❌ ML Engine not initialized")
        raise HTTPException(status_code=500, detail="ML Engine not initialized")
    
    if not request.games:
        logger.warning("⚠️ Empty games list in request")
        raise HTTPException(status_code=400, detail="At least one game is required")
    
    if len(request.games) > 10:
        logger.warning(f"⚠️ Too many games: {len(request.games)}, limiting to 10")
        request.games = request.games[:10]
    
    try:
        logger.info(f"📊 Analyzing {len(request.games)} games for user: {request.user_id}")
        
        # Extract PGN strings
        pgn_games = [game.pgn for game in request.games]
        
        # Analyze games
        result = ml_engine.analyze_games(pgn_games, request.player_name)
        
        # Update user_id in result
        result['user_id'] = request.user_id
        
        logger.info(f"✅ Analysis complete for user: {request.user_id}")
        
        # Convert to response model
        response = AnalysisResponse(
            user_id=result['user_id'],
            timestamp=result['timestamp'],
            games_analyzed=result['games_analyzed'],
            predictions={
                k: PredictionResult(**v)
                for k, v in result['predictions'].items()
            },
            strengths=result['strengths'],
            weaknesses=result['weaknesses'],
            features=result['features'],
            recommendation=result['recommendation']
        )
        
        return response
        
    except Exception as e:
        logger.error(f"❌ Error analyzing player: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )


@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "name": "Chess4Everyone ML Analysis API",
        "version": "1.0.0",
        "endpoints": {
            "health": "GET /health",
            "analyze": "POST /analyze-player",
            "docs": "GET /docs"
        }
    }


# ============================================================
# Standalone server launcher
# ============================================================

if __name__ == "__main__":
    logger.info("🎯 Starting Chess ML Analysis FastAPI Server")
    
    # Run with uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )