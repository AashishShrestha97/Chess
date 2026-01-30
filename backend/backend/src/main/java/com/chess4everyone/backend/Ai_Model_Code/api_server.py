"""
FastAPI Inference Server for Chess Player Analysis
Production-ready microservice that accepts PGN games and returns player analysis
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel, Field, field_validator
from typing import List, Dict, Optional
import uvicorn
from datetime import datetime
import logging
import os

from chess_analyzer import ChessAnalyzer, extract_features
from ml_trainer_ml_based import ChessPlayerClassifier

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Lifespan context manager for startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    # Startup
    await startup_event()
    yield
    # Shutdown (cleanup if needed)
    logger.info("🛑 Shutting down API server...")

# Initialize FastAPI app with lifespan
app = FastAPI(
    title="Chess Player Analysis API",
    description="AI-powered chess player analysis microservice with rule-based classification",
    version="2.0.0",
    lifespan=lifespan
)

# Add CORS middleware for Spring Boot integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8080"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global classifier instance
classifier = None

# Stockfish path - check multiple locations
def get_stockfish_path():
    """Find Stockfish executable in common locations"""
    # Try to get path from stockfish Python package first
    try:
        import stockfish
        # Get the stockfish executable location from the package
        stockfish_dir = os.path.dirname(stockfish.__file__)
        stockfish_exe = os.path.join(stockfish_dir, "engines")
        if os.path.exists(stockfish_exe):
            return stockfish_exe
    except ImportError:
        pass
    
    possible_paths = [
        os.getenv("STOCKFISH_PATH"),  # Environment variable
        "C:\\stockfish\\stockfish.exe",  # Windows default install
        "/usr/games/stockfish",  # Linux
        "C:\\Program Files\\stockfish\\stockfish.exe",  # Windows Program Files
        "stockfish",  # System PATH
    ]
    
    # Add relative path from project
    script_dir = os.path.dirname(__file__)
    relative_paths = [
        os.path.join(script_dir, "..", "..", "..", "..", "stockfish-windows-x86-64-avx2.exe"),
        os.path.join(script_dir, "stockfish"),
    ]
    possible_paths.extend(relative_paths)
    
    for path in possible_paths:
        if path and os.path.exists(path):
            return path
    
    # Return first option if none found (will warn at startup)
    return os.getenv("STOCKFISH_PATH", "/usr/games/stockfish")

STOCKFISH_PATH = get_stockfish_path()

# Path to trained models - relative to this script
# The models are located at: backend/src/main/java/com/chess4everyone/backend/ai_models
# And this script is at:    backend/src/main/java/com/chess4everyone/backend/Ai_Model_Code/api_server.py
# So we need to go up one level: ../ai_models
MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "ai_models")

# Also try environment variable for flexibility
if not os.path.exists(MODELS_DIR):
    MODELS_DIR = os.getenv("MODELS_DIR", MODELS_DIR)


# Request/Response models
class GameData(BaseModel):
    """Single PGN game"""
    pgn: str = Field(..., description="PGN string of the chess game")
    
    @field_validator('pgn')
    @classmethod
    def validate_pgn(cls, v):
        if not v or len(v.strip()) < 10:
            raise ValueError("PGN must not be empty")
        return v.strip()


class AnalysisRequest(BaseModel):
    """Request model for player analysis"""
    user_id: str = Field(..., description="Unique user identifier")
    player_name: str = Field(..., description="Player name to analyze in PGN")
    games: List[GameData] = Field(..., min_length=1, max_length=20, 
                                   description="List of PGN games (1-20 games)")
    
    @field_validator('games')
    @classmethod
    def validate_games_count(cls, v):
        if len(v) < 1:
            raise ValueError("At least 1 game required")
        if len(v) > 20:
            raise ValueError("Maximum 20 games allowed")
        return v


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
    detailed_feedback: Dict[str, str]


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    stockfish_available: bool
    classifier_ready: bool
    timestamp: str
    version: str


# Lifespan context manager for startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    # Startup
    await startup_event()
    yield
    # Shutdown (cleanup if needed)
    logger.info("🛑 Shutting down API server...")


# Initialize FastAPI app with lifespan
app = FastAPI(
    title="Chess Player Analysis API",
    description="AI-powered chess player analysis microservice with rule-based classification",
    version="2.0.0",
    lifespan=lifespan
)

# Add CORS middleware for Spring Boot integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Startup event (called by lifespan context manager)
async def startup_event():
    """Initialize services on startup"""
    global classifier
    
    try:
        logger.info("🚀 Initializing chess player classifier with trained models...")
        logger.info(f"   Looking for models in: {MODELS_DIR}")
        
        # Load classifier with trained models
        classifier = ChessPlayerClassifier(model_dir=MODELS_DIR)
        logger.info("✓ Classifier ready with trained RandomForest models")
        
        # Log model info
        info = classifier.get_model_info()
        logger.info(f"✓ Models loaded: {len(info['categories_loaded'])}/{info['total_categories']}")
        logger.info(f"   Categories: {', '.join(info['categories_loaded'])}")
        logger.info(f"   Features: {info['feature_count']}")
        
        # Test Stockfish availability
        if os.path.exists(STOCKFISH_PATH):
            logger.info(f"✓ Stockfish found at {STOCKFISH_PATH}")
        else:
            logger.warning(f"⚠ Stockfish not found at {STOCKFISH_PATH}")
            logger.warning("   Please install Stockfish:")
            logger.warning("   Windows: Download from https://stockfishchess.org/download/")
            logger.warning("   Linux: sudo apt-get install stockfish")
            logger.warning("   macOS: brew install stockfish")
            logger.warning(f"   Or set STOCKFISH_PATH environment variable")
        
    except Exception as e:
        logger.error(f"✗ Startup failed: {e}")
        logger.error(f"   Models directory: {MODELS_DIR}")
        logger.error(f"   Directory exists: {os.path.exists(MODELS_DIR)}")
        if os.path.exists(MODELS_DIR):
            logger.error(f"   Files in directory: {os.listdir(MODELS_DIR)}")
        raise


# Health check endpoint
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint
    Returns server status and availability of required components
    """
    stockfish_available = os.path.exists(STOCKFISH_PATH)
    classifier_ready = classifier is not None
    
    status = "healthy" if (stockfish_available and classifier_ready) else "degraded"
    
    if not stockfish_available:
        logger.warning("Health check: Stockfish not available")
    if not classifier_ready:
        logger.warning("Health check: Classifier not ready")
    
    return HealthResponse(
        status=status,
        stockfish_available=stockfish_available,
        classifier_ready=classifier_ready,
        timestamp=datetime.utcnow().isoformat(),
        version="2.0.0"
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
    4. Runs rule-based classification
    5. Returns detailed player profile with personalized recommendations
    """
    if classifier is None:
        raise HTTPException(
            status_code=503,
            detail="Classifier not initialized. Server may be starting up."
        )
    
    if not os.path.exists(STOCKFISH_PATH):
        raise HTTPException(
            status_code=503,
            detail=f"Stockfish not found at {STOCKFISH_PATH}. Please install stockfish."
        )
    
    try:
        logger.info(f"📊 Analyzing {len(request.games)} games for user {request.user_id}")
        
        # Extract PGN strings
        pgn_strings = [game.pgn for game in request.games]
        logger.info(f"   PGN games received: {len(pgn_strings)}")
        
        # Validate PGNs before analysis
        valid_pgns = []
        for i, pgn in enumerate(pgn_strings):
            if pgn and len(pgn.strip()) > 50:  # Minimum PGN length check
                valid_pgns.append(pgn)
            else:
                logger.warning(f"   ⚠️ Skipping game {i+1}: PGN too short ({len(pgn) if pgn else 0} bytes)")
        
        if not valid_pgns:
            logger.error("❌ No valid PGNs found after validation")
            raise HTTPException(
                status_code=400,
                detail="All games have empty or invalid PGN. Check that games were recorded properly."
            )
        
        logger.info(f"   Valid PGNs after filtering: {len(valid_pgns)}")
        for i, pgn in enumerate(valid_pgns[:2]):  # Log first 2
            pgn_len = len(pgn)
            move_count = pgn.count('.')
            logger.debug(f"   Game {i+1}: {pgn_len} bytes, ~{move_count} moves")
        
        # Analyze games with Stockfish
        with ChessAnalyzer(stockfish_path=STOCKFISH_PATH) as analyzer:
            game_analyses = analyzer.analyze_multiple_games(valid_pgns, request.player_name)
        
        logger.info(f"   Game analyses returned: {len(game_analyses) if game_analyses else 'None'}")
        if not game_analyses:
            logger.error("❌ game_analyses is None or empty after Stockfish analysis")
            raise HTTPException(
                status_code=400,
                detail="Failed to analyze any games. PGNs may be malformed or have no moves."
            )
        
        logger.info(f"✓ Successfully analyzed {len(game_analyses)} games")
        
        # Extract features
        features = extract_features(game_analyses)
        logger.info(f"✓ Extracted {len(features)} features")
        logger.debug(f"Feature values: {features}")
        
        if len(features) != 15:
            logger.error(f"ERROR: Extracted {len(features)} features but need exactly 15!")
            raise HTTPException(
                status_code=400,
                detail=f"Feature extraction failed: got {len(features)} features, need 15."
            )
        
        # Try to predict
        try:
            logger.info("Calling classifier.predict() with all 15 features...")
            predictions = classifier.predict(features)
            logger.info(f"✓ Generated predictions for {len(predictions)} categories")
        except ValueError as e:
            logger.error(f"❌ ValueError in classifier: {str(e)}")
            logger.error(f"   Features dict had {len(features)} features")
            logger.error(f"   Expected columns: {classifier.feature_columns}")
            raise HTTPException(
                status_code=400,
                detail=f"Classifier error: {str(e)}. Feature mismatch?"
            )
        except Exception as e:
            logger.error(f"❌ Unexpected error in classifier: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Classification error: {str(e)}"
            )
        
        # Extract strengths and weaknesses
        strengths_weaknesses = classifier.get_strengths_and_weaknesses(predictions)
        
        # Generate comprehensive recommendation
        recommendation = generate_recommendation(
            strengths_weaknesses['strengths'],
            strengths_weaknesses['weaknesses'],
            features,
            predictions
        )
        
        # Generate detailed feedback for each category
        detailed_feedback = generate_detailed_feedback(predictions, features)
        
        # Convert predictions to response model
        prediction_models = {
            category: CategoryPrediction(**pred_data)
            for category, pred_data in predictions.items()
        }
        
        response = AnalysisResponse(
            user_id=request.user_id,
            timestamp=datetime.utcnow().isoformat(),
            games_analyzed=len(game_analyses),
            predictions=prediction_models,
            strengths=strengths_weaknesses['strengths'],
            weaknesses=strengths_weaknesses['weaknesses'],
            features=features,
            recommendation=recommendation,
            detailed_feedback=detailed_feedback
        )
        
        logger.info(f"✓ Analysis complete for user {request.user_id}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"✗ Analysis failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )


def generate_detailed_feedback(predictions: Dict, features: Dict[str, float]) -> Dict[str, str]:
    """
    Generate detailed feedback for each category
    
    Args:
        predictions: Category predictions
        features: Feature dictionary
        
    Returns:
        Dictionary mapping category to detailed feedback
    """
    feedback = {}
    
    # Opening feedback
    opening_class = predictions['opening']['classification']
    opening_cp = features.get('avg_cp_loss_opening', 0)
    opening_blunders = features.get('blunder_rate_opening', 0)
    
    if opening_class == 'strong':
        feedback['opening'] = f"Excellent opening play! Your moves are accurate (avg loss: {opening_cp:.1f}cp) with minimal errors ({opening_blunders:.1%} blunders). Continue studying opening theory."
    elif opening_class == 'weak':
        feedback['opening'] = f"Opening needs work. Average loss of {opening_cp:.1f}cp and {opening_blunders:.1%} blunders suggest you should focus on basic opening principles and study 2-3 solid openings."
    else:
        feedback['opening'] = f"Decent opening play with {opening_cp:.1f}cp average loss. Study opening principles more deeply and learn the ideas behind your openings, not just moves."
    
    # Middlegame feedback
    mg_class = predictions['middlegame']['classification']
    mg_cp = features.get('avg_cp_loss_middlegame', 0)
    mg_blunders = features.get('blunder_rate_middlegame', 0)
    
    if mg_class == 'strong':
        feedback['middlegame'] = f"Strong middlegame play! Loss of {mg_cp:.1f}cp per move with {mg_blunders:.1%} blunders shows good tactical awareness and planning."
    elif mg_class == 'weak':
        feedback['middlegame'] = f"Middlegame is your weakest phase ({mg_cp:.1f}cp loss, {mg_blunders:.1%} blunders). Focus on tactical puzzles and study attacking/defensive patterns."
    else:
        feedback['middlegame'] = f"Average middlegame performance. {mg_cp:.1f}cp loss suggests room for improvement in tactics and strategic planning."
    
    # Endgame feedback
    eg_class = predictions['endgame']['classification']
    eg_cp = features.get('avg_cp_loss_endgame', 0)
    eg_blunders = features.get('blunder_rate_endgame', 0)
    
    if eg_class == 'strong':
        feedback['endgame'] = f"Solid endgame technique! {eg_cp:.1f}cp average loss with {eg_blunders:.1%} blunders. You know how to convert advantages and hold difficult positions."
    elif eg_class == 'weak':
        feedback['endgame'] = f"Endgame needs significant work ({eg_cp:.1f}cp loss, {eg_blunders:.1%} blunders). Study fundamental endgames: K+P, Rook endgames, and basic checkmates."
    else:
        feedback['endgame'] = f"Acceptable endgame play but room for improvement. {eg_cp:.1f}cp loss suggests you should practice converting winning positions."
    
    # Tactical feedback
    tac_class = predictions['tactical']['classification']
    mistake_rate = features.get('mistake_rate', 0)
    blunder_rate = features.get('blunder_rate', 0)
    
    if tac_class == 'strong':
        feedback['tactical'] = f"Excellent tactical awareness! Low mistake rate ({mistake_rate:.1%}) and blunder rate ({blunder_rate:.1%}). Keep solving puzzles to maintain sharpness."
    elif tac_class == 'weak':
        feedback['tactical'] = f"Tactics need urgent attention. {mistake_rate:.1%} mistakes and {blunder_rate:.1%} blunders indicate missing tactical patterns. Solve 30-50 puzzles daily."
    else:
        feedback['tactical'] = f"Decent tactical play but inconsistent. {mistake_rate:.1%} mistake rate shows you miss some opportunities. Regular puzzle training will help."
    
    # Positional feedback
    pos_class = predictions['positional']['classification']
    avg_cp = features.get('avg_cp_loss', 0)
    good_moves = features.get('good_moves', 0)
    
    if pos_class == 'strong':
        feedback['positional'] = f"Strong positional understanding! {avg_cp:.1f}cp average loss and {good_moves:.1%} good moves show you understand pawn structures and piece placement."
    elif pos_class == 'weak':
        feedback['positional'] = f"Positional play needs development. {avg_cp:.1f}cp loss and only {good_moves:.1%} good moves suggest studying classical games and strategic concepts."
    else:
        feedback['positional'] = f"Average positional sense. {good_moves:.1%} good moves is decent, but study pawn structures and piece coordination to improve."
    
    # Time management feedback
    time_class = predictions['time_management']['classification']
    time_pressure = features.get('time_pressure_moves', 0)
    avg_time = features.get('avg_move_time', 60)
    
    if time_class == 'strong':
        feedback['time_management'] = f"Excellent time control! Only {time_pressure:.1%} moves in time pressure with {avg_time:.1f}s average. You pace yourself well."
    elif time_class == 'weak':
        feedback['time_management'] = f"Time management is problematic. {time_pressure:.1%} moves in time pressure means you're rushing critical decisions. Practice allocating time better."
    else:
        feedback['time_management'] = f"Acceptable time usage. {time_pressure:.1%} time pressure moves suggests room to improve pacing, especially in complex positions."
    
    return feedback


def generate_recommendation(
    strengths: List[str], 
    weaknesses: List[str], 
    features: Dict[str, float],
    predictions: Dict
) -> str:
    """
    Generate personalized training recommendation
    
    Args:
        strengths: List of strong categories
        weaknesses: List of weak categories
        features: Feature dictionary
        predictions: Category predictions
        
    Returns:
        Personalized recommendation string
    """
    if not weaknesses:
        return "🎉 Excellent performance across all areas! You're playing at a consistently high level. To continue improving: challenge yourself with stronger opponents, analyze your games deeply, and consider working with a coach to identify subtle improvements. Keep up the outstanding work!"
    
    recommendations = []
    
    # Priority 1: Critical weaknesses (weak classification)
    critical_areas = []
    for category in weaknesses:
        if predictions[category]['classification'] == 'weak' and predictions[category]['confidence'] > 0.70:
            critical_areas.append(category)
    
    if critical_areas:
        recommendations.append(f"🎯 **Priority Focus Areas**: {', '.join(critical_areas)}")
    
    # Specific recommendations by category
    if 'opening' in weaknesses:
        opening_loss = features.get('avg_cp_loss_opening', 0)
        if opening_loss > 70:
            recommendations.append(
                "\n📖 **Opening**: Your opening play shows significant room for improvement (avg loss: {:.1f}cp). "
                "Action plan: (1) Choose 2-3 solid openings for White and 2 defenses for Black, "
                "(2) Study the key ideas and typical plans, not just memorization, "
                "(3) Review your opening games to find where you deviate from theory.".format(opening_loss)
            )
        else:
            recommendations.append(
                "\n📖 **Opening**: Brush up on opening principles. Study master games in your repertoire and "
                "understand the middlegame plans that arise from your openings."
            )
    
    if 'middlegame' in weaknesses:
        mg_loss = features.get('avg_cp_loss_middlegame', 0)
        mistake_rate = features.get('mistake_rate', 0)
        if mistake_rate > 0.30:
            recommendations.append(
                "\n⚔️ **Middlegame**: Your middlegame shows frequent tactical oversights ({:.1%} mistakes). "
                "Action plan: (1) Solve 20-30 tactical puzzles daily on Chess.com or Lichess, "
                "(2) Before each move, check: 'What does my opponent's last move threaten?', "
                "(3) Look for hanging pieces and tactical motifs (pins, forks, skewers).".format(mistake_rate)
            )
        else:
            recommendations.append(
                "\n⚔️ **Middlegame**: Focus on strategic planning. Study annotated master games, "
                "practice creating and executing plans, and work on candidate move selection."
            )
    
    if 'endgame' in weaknesses:
        eg_loss = features.get('avg_cp_loss_endgame', 0)
        if eg_loss > 80:
            recommendations.append(
                "\n♔ **Endgame**: Your endgame technique needs fundamental work (avg loss: {:.1f}cp). "
                "Action plan: (1) Master basic endgames: King and Pawn vs King, Rook vs Pawn, Lucena/Philidor positions, "
                "(2) Study '100 Endgames You Must Know' by Jesus de la Villa, "
                "(3) Practice endgame positions against computer until you can win/hold automatically.".format(eg_loss)
            )
        else:
            recommendations.append(
                "\n♔ **Endgame**: Sharpen endgame skills. Practice converting winning positions, "
                "learn defensive resources, and study practical endgame techniques."
            )
    
    if 'tactical' in weaknesses:
        blunder_rate = features.get('blunder_rate', 0)
        if blunder_rate > 0.25:
            recommendations.append(
                "\n🎯 **Tactics**: High blunder rate ({:.1%}) is preventing you from reaching your potential. "
                "Action plan: (1) SLOW DOWN - spend 20-30 seconds minimum on each move, "
                "(2) Use a 'blunder check' before moving: 'Can this piece be captured? Do I leave anything hanging?', "
                "(3) Solve easier tactical puzzles (800-1200 rating) to build pattern recognition.".format(blunder_rate)
            )
        else:
            recommendations.append(
                "\n🎯 **Tactics**: Inconsistent tactical play. Regular puzzle training (15-20 min daily) "
                "will help solidify pattern recognition and reduce calculation errors."
            )
    
    if 'positional' in weaknesses:
        good_moves = features.get('good_moves', 0)
        recommendations.append(
            "\n🏰 **Positional Play**: Develop strategic understanding. "
            "Action plan: (1) Study games by positional masters (Karpov, Capablanca, Carlsen), "
            "(2) Learn to evaluate positions based on pawn structure, piece activity, king safety, "
            "(3) Practice identifying and exploiting weaknesses in opponent's position."
        )
    
    if 'time_management' in weaknesses:
        time_pressure = features.get('time_pressure_moves', 0)
        if time_pressure > 0.40:
            recommendations.append(
                "\n⏱️ **Time Management**: You make {:.1%} of moves in time pressure, leading to rushed decisions. "
                "Action plan: (1) Use increment time controls (10+5 or 15+10) to practice steady pacing, "
                "(2) Allocate time by position complexity, not move number, "
                "(3) In practice games, aim to finish with 20-25% of starting time remaining.".format(time_pressure)
            )
        else:
            recommendations.append(
                "\n⏱️ **Time Management**: Improve time allocation. Practice playing at a steady pace "
                "and reserve extra time for critical positions."
            )
    
    # Highlight strengths with encouragement
    if strengths:
        strength_str = ', '.join(strengths)
        recommendations.append(
            f"\n\n💪 **Your Strengths**: {strength_str}. These are solid foundations! "
            "Continue leveraging these skills while working on weaker areas."
        )
    
    # Overall training plan
    recommendations.append(
        "\n\n📅 **Recommended Training Schedule**:\n"
        "• Daily: 30 min tactical puzzles + 1-2 rated games\n"
        "• Weekly: Analyze 2-3 of your games with engine + study 1 master game\n"
        "• Monthly: Review progress, adjust openings if needed, work on identified weaknesses"
    )
    
    return "".join(recommendations)


# Additional utility endpoints
@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "service": "Chess Player Analysis API",
        "version": "2.0.0",
        "classifier": "Rule-based (no training required)",
        "endpoints": {
            "health": "/health",
            "analyze": "/analyze-player",
            "docs": "/docs",
            "openapi": "/openapi.json"
        },
        "features": [
            "Stockfish-powered game analysis",
            "6 category player assessment",
            "Personalized recommendations",
            "No training data required"
        ]
    }


@app.get("/categories")
async def get_categories():
    """Get available analysis categories and their descriptions"""
    return {
        "categories": {
            "opening": "Performance in the first 12 moves of the game",
            "middlegame": "Complex positions with many pieces, typically moves 13-30",
            "endgame": "Final phase with reduced material",
            "tactical": "Ability to spot combinations and avoid blunders",
            "positional": "Strategic understanding and long-term planning",
            "time_management": "Efficient use of clock and decision-making under pressure"
        },
        "classifications": {
            "strong": "Above average performance in this area",
            "average": "Typical performance, room for improvement",
            "weak": "Area needing focused practice and study"
        }
    }


if __name__ == "__main__":
    # Run server
    port = int(os.getenv("PORT", "8000"))
    
    uvicorn.run(
        "api_server:app",
        host="0.0.0.0",
        port=port,
        reload=False,  # Set to True for development
        log_level="info"
    )
