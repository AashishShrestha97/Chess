"""
FastAPI Inference Server for Chess Player Analysis
Production-ready microservice that accepts PGN games and returns player analysis
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
import uvicorn
from datetime import datetime
import logging

from chess_analyzer import ChessAnalyzer, extract_features
from ml_trainer import ChessPlayerClassifier

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Chess Player Analysis API",
    description="AI-powered chess player analysis microservice",
    version="1.0.0"
)

# Add CORS middleware for Spring Boot integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global classifier instance (loaded once at startup)
classifier = None
STOCKFISH_PATH = "/usr/games/stockfish"  # Update for your system
MODEL_DIR = "models"


# Request/Response models
class GameData(BaseModel):
    """Single PGN game"""
    pgn: str = Field(..., description="PGN string of the chess game")


class AnalysisRequest(BaseModel):
    """Request model for player analysis"""
    user_id: str = Field(..., description="Unique user identifier")
    player_name: str = Field(..., description="Player name to analyze in PGN")
    games: List[GameData] = Field(..., min_items=1, max_items=20, 
                                   description="List of PGN games (1-20 games)")


class CategoryPrediction(BaseModel):
    """Prediction for a single category"""
    classification: str = Field(..., description="strong, average, or weak")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score")
    numeric_score: int = Field(..., ge=0, le=2, description="0=weak, 1=average, 2=strong")


class AnalysisResponse(BaseModel):
    """Response model for player analysis"""
    user_id: str
    timestamp: str
    games_analyzed: int
    predictions: Dict[str, CategoryPrediction]
    strengths: List[str]
    weaknesses: List[str]
    features: Dict[str, float]
    recommendation: str


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    stockfish_available: bool
    model_loaded: bool
    timestamp: str


# Startup event - load models
@app.on_event("startup")
async def startup_event():
    """Load ML models on startup"""
    global classifier
    
    try:
        logger.info("Loading ML models...")
        classifier = ChessPlayerClassifier()
        classifier.load_models(MODEL_DIR)
        logger.info("Models loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load models: {e}")
        logger.warning("Server starting without models - training may be required")


# Health check endpoint
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint
    Returns server status and availability of required components
    """
    import os
    
    stockfish_available = os.path.exists(STOCKFISH_PATH)
    model_loaded = classifier is not None and len(classifier.models) > 0
    
    return HealthResponse(
        status="healthy" if (stockfish_available and model_loaded) else "degraded",
        stockfish_available=stockfish_available,
        model_loaded=model_loaded,
        timestamp=datetime.utcnow().isoformat()
    )


# Main analysis endpoint
@app.post("/analyze-player", response_model=AnalysisResponse)
async def analyze_player(request: AnalysisRequest):
    """
    Analyze a chess player's games and return strengths/weaknesses
    
    This endpoint:
    1. Accepts 1-20 PGN games
    2. Analyzes each game with Stockfish
    3. Extracts performance features
    4. Runs ML inference
    5. Returns detailed player profile
    """
    if classifier is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Please train and deploy models first."
        )
    
    try:
        logger.info(f"Analyzing {len(request.games)} games for user {request.user_id}")
        
        # Extract PGN strings
        pgn_strings = [game.pgn for game in request.games]
        
        # Analyze games with Stockfish
        with ChessAnalyzer(stockfish_path=STOCKFISH_PATH) as analyzer:
            game_analyses = analyzer.analyze_multiple_games(pgn_strings, request.player_name)
        
        if not game_analyses:
            raise HTTPException(
                status_code=400,
                detail="Failed to analyze any games. Check PGN format."
            )
        
        logger.info(f"Successfully analyzed {len(game_analyses)} games")
        
        # Extract features
        features = extract_features(game_analyses)
        
        # Run ML inference
        predictions = classifier.predict(features)
        
        # Extract strengths and weaknesses
        strengths_weaknesses = classifier.get_strengths_and_weaknesses(predictions)
        
        # Generate recommendation
        recommendation = generate_recommendation(
            strengths_weaknesses['strengths'],
            strengths_weaknesses['weaknesses'],
            features
        )
        
        # Convert predictions to response model
        prediction_models = {
            category: CategoryPrediction(**pred_data)
            for category, pred_data in predictions.items()
        }
        
        return AnalysisResponse(
            user_id=request.user_id,
            timestamp=datetime.utcnow().isoformat(),
            games_analyzed=len(game_analyses),
            predictions=prediction_models,
            strengths=strengths_weaknesses['strengths'],
            weaknesses=strengths_weaknesses['weaknesses'],
            features=features,
            recommendation=recommendation
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )


@app.post("/batch-analyze")
async def batch_analyze(
    requests: List[AnalysisRequest],
    background_tasks: BackgroundTasks
):
    """
    Batch analysis endpoint for processing multiple players
    Returns immediately with task IDs, processes in background
    """
    # This is a simplified version - in production, use Celery or similar
    task_ids = []
    
    for req in requests:
        task_id = f"task_{req.user_id}_{datetime.utcnow().timestamp()}"
        task_ids.append(task_id)
        background_tasks.add_task(process_analysis_background, req, task_id)
    
    return {
        "message": "Batch analysis started",
        "task_ids": task_ids,
        "count": len(task_ids)
    }


async def process_analysis_background(request: AnalysisRequest, task_id: str):
    """Background task for processing analysis"""
    try:
        # This would typically store results in a database
        result = await analyze_player(request)
        logger.info(f"Task {task_id} completed successfully")
        # Store result in database here
    except Exception as e:
        logger.error(f"Task {task_id} failed: {e}")


def generate_recommendation(strengths: List[str], weaknesses: List[str], features: Dict[str, float]) -> str:
    """
    Generate personalized training recommendation
    
    Args:
        strengths: List of strong categories
        weaknesses: List of weak categories
        features: Feature dictionary
        
    Returns:
        Personalized recommendation string
    """
    if not weaknesses:
        return "Excellent performance across all areas! Focus on maintaining consistency and challenging yourself with stronger opponents."
    
    recommendations = []
    
    # Opening recommendations
    if 'opening' in weaknesses:
        opening_loss = features.get('avg_cp_loss_opening', 0)
        if opening_loss > 70:
            recommendations.append(
                "Opening: Study opening theory and principles. Your opening moves show significant inaccuracies. "
                "Focus on 2-3 openings and learn the key ideas, not just memorize moves."
            )
        else:
            recommendations.append(
                "Opening: Review opening principles. Practice maintaining equality in the opening phase."
            )
    
    # Middlegame recommendations
    if 'middlegame' in weaknesses:
        tactical_errors = features.get('tactical_error_rate', 0)
        if tactical_errors > 0.35:
            recommendations.append(
                "Middlegame: Focus on tactical training. Solve 20-30 tactical puzzles daily. "
                "Your middlegame shows frequent tactical oversights."
            )
        else:
            recommendations.append(
                "Middlegame: Improve planning and strategy. Study master games in your openings."
            )
    
    # Endgame recommendations
    if 'endgame' in weaknesses:
        endgame_loss = features.get('avg_cp_loss_endgame', 0)
        if endgame_loss > 70:
            recommendations.append(
                "Endgame: Study fundamental endgames (K+P, K+R vs K, basic pawn endgames). "
                "Your endgame technique needs significant improvement."
            )
        else:
            recommendations.append(
                "Endgame: Practice converting winning positions and holding draws. Review endgame principles."
            )
    
    # Tactical recommendations
    if 'tactical' in weaknesses:
        blunder_rate = features.get('blunder_rate_overall', 0)
        recommendations.append(
            f"Tactics: Your blunder rate is {blunder_rate:.1%}. Slow down and double-check moves. "
            "Practice tactical pattern recognition with puzzles."
        )
    
    # Positional recommendations
    if 'positional' in weaknesses:
        recommendations.append(
            "Positional Play: Study classical games focusing on pawn structure and piece placement. "
            "Learn to evaluate positions without concrete tactics."
        )
    
    # Time management recommendations
    if 'time_management' in weaknesses:
        time_blunders = features.get('time_pressure_blunder_rate', 0)
        if time_blunders > 0.4:
            recommendations.append(
                "Time Management: You make significantly more blunders in time pressure. "
                "Practice playing with increments and allocate time more evenly throughout the game."
            )
    
    # Highlight strengths
    if strengths:
        strength_str = ", ".join(strengths)
        recommendations.append(f"\nYour strengths are: {strength_str}. Continue leveraging these!")
    
    return " ".join(recommendations)


# Additional utility endpoints
@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "service": "Chess Player Analysis API",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "analyze": "/analyze-player",
            "batch": "/batch-analyze",
            "docs": "/docs"
        }
    }


if __name__ == "__main__":
    # Run server
    uvicorn.run(
        "api_server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Set to False in production
        log_level="info"
    )
