#!/usr/bin/env python
"""
Test script to verify Python API can start correctly
Run this BEFORE starting uvicorn to catch errors early
"""

import os
import sys
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def test_imports():
    """Test that all required modules can be imported"""
    logger.info("=" * 60)
    logger.info("TESTING PYTHON IMPORTS")
    logger.info("=" * 60)
    
    try:
        logger.info("✓ Importing fastapi...")
        import fastapi
        logger.info(f"  Version: {fastapi.__version__}")
    except ImportError as e:
        logger.error(f"✗ FastAPI not found: {e}")
        logger.error("  Run: pip install fastapi uvicorn")
        return False
    
    try:
        logger.info("✓ Importing pydantic...")
        import pydantic
        logger.info(f"  Version: {pydantic.__version__}")
    except ImportError as e:
        logger.error(f"✗ Pydantic not found: {e}")
        return False
    
    try:
        logger.info("✓ Importing chess...")
        import chess
        logger.info(f"  Version: {chess.__version__}")
    except ImportError as e:
        logger.error(f"✗ python-chess not found: {e}")
        logger.error("  Run: pip install python-chess")
        return False
    
    try:
        logger.info("✓ Importing sklearn...")
        import sklearn
        logger.info(f"  Version: {sklearn.__version__}")
    except ImportError as e:
        logger.error(f"✗ scikit-learn not found: {e}")
        logger.error("  Run: pip install scikit-learn")
        return False
    
    try:
        logger.info("✓ Importing joblib...")
        import joblib
        logger.info(f"  Version: {joblib.__version__}")
    except ImportError as e:
        logger.error(f"✗ joblib not found: {e}")
        logger.error("  Run: pip install joblib")
        return False
    
    try:
        logger.info("✓ Importing pandas...")
        import pandas
        logger.info(f"  Version: {pandas.__version__}")
    except ImportError as e:
        logger.error(f"✗ pandas not found: {e}")
        logger.error("  Run: pip install pandas")
        return False
    
    try:
        logger.info("✓ Importing numpy...")
        import numpy
        logger.info(f"  Version: {numpy.__version__}")
    except ImportError as e:
        logger.error(f"✗ numpy not found: {e}")
        logger.error("  Run: pip install numpy")
        return False
    
    logger.info("✅ All imports successful!\n")
    return True


def test_modules():
    """Test that our custom modules can be imported"""
    logger.info("=" * 60)
    logger.info("TESTING CUSTOM MODULES")
    logger.info("=" * 60)
    
    try:
        logger.info("✓ Importing chess_analyzer...")
        from chess_analyzer import ChessAnalyzer, extract_features
        logger.info("  ChessAnalyzer loaded successfully")
    except Exception as e:
        logger.error(f"✗ Failed to import chess_analyzer: {e}")
        return False
    
    try:
        logger.info("✓ Importing ml_trainer_ml_based...")
        from ml_trainer_ml_based import ChessPlayerClassifier
        logger.info("  ChessPlayerClassifier loaded successfully")
    except Exception as e:
        logger.error(f"✗ Failed to import ml_trainer_ml_based: {e}")
        logger.error(f"  Error details: {type(e).__name__}: {e}")
        return False
    
    logger.info("✅ Custom modules loaded!\n")
    return True


def test_models_directory():
    """Test that models directory and files exist"""
    logger.info("=" * 60)
    logger.info("TESTING MODELS DIRECTORY")
    logger.info("=" * 60)
    
    # Try multiple possible locations
    script_dir = os.path.dirname(os.path.abspath(__file__))
    possible_paths = [
        os.path.join(script_dir, "ai_models"),  # Same directory as script
        os.path.join(script_dir, "..", "ai_models"),  # Parent directory
        os.path.abspath(os.path.join(script_dir, "..", "ai_models")),
    ]
    
    models_dir = None
    for path in possible_paths:
        if os.path.exists(path):
            models_dir = path
            break
    
    if models_dir is None:
        logger.error(f"✗ Models directory not found!")
        logger.error(f"  Tried these paths:")
        for path in possible_paths:
            logger.error(f"  - {path}")
        logger.error(f"  Current directory: {os.getcwd()}")
        logger.error(f"  Script directory: {script_dir}")
        logger.error(f"  Files in script directory: {os.listdir(script_dir)}")
        return False
    
    logger.info(f"✓ Models directory found: {models_dir}")
    
    expected_files = [
        "opening_classifier.pkl", "opening_scaler.pkl",
        "middlegame_classifier.pkl", "middlegame_scaler.pkl",
        "endgame_classifier.pkl", "endgame_scaler.pkl",
        "tactical_classifier.pkl", "tactical_scaler.pkl",
        "positional_classifier.pkl", "positional_scaler.pkl"
    ]
    
    actual_files = os.listdir(models_dir)
    logger.info(f"Found {len(actual_files)} files in models directory:")
    
    for file in actual_files:
        size_kb = os.path.getsize(os.path.join(models_dir, file)) / 1024
        logger.info(f"  - {file} ({size_kb:.1f} KB)")
    
    missing = [f for f in expected_files if f not in actual_files]
    if missing:
        logger.error(f"✗ Missing {len(missing)} expected model files:")
        for f in missing:
            logger.error(f"  - {f}")
        return False
    
    logger.info("✅ All expected model files found!\n")
    return True


def test_classifier_init():
    """Test that classifier can be initialized"""
    logger.info("=" * 60)
    logger.info("TESTING CLASSIFIER INITIALIZATION")
    logger.info("=" * 60)
    
    try:
        from ml_trainer_ml_based import ChessPlayerClassifier
        
        # Find models directory
        script_dir = os.path.dirname(os.path.abspath(__file__))
        possible_paths = [
            os.path.join(script_dir, "ai_models"),
            os.path.join(script_dir, "..", "ai_models"),
        ]
        
        models_dir = None
        for path in possible_paths:
            if os.path.exists(path):
                models_dir = path
                break
        
        if models_dir is None:
            logger.error(f"✗ Models directory not found in any expected location")
            return False
        
        logger.info(f"Initializing ChessPlayerClassifier with models from {models_dir}")
        classifier = ChessPlayerClassifier(model_dir=models_dir)
        
        logger.info("✓ Classifier initialized successfully")
        
        info = classifier.get_model_info()
        logger.info(f"✓ Model info retrieved:")
        logger.info(f"  Categories: {', '.join(info['categories_loaded'])}")
        logger.info(f"  Total categories: {info['total_categories']}")
        logger.info(f"  Features: {info['feature_count']}")
        
        if info['total_categories'] == 0:
            logger.error("✗ No models were loaded! Check that ai_models folder contains .pkl files")
            return False
        
        logger.info("✅ Classifier ready!\n")
        return True
        
    except Exception as e:
        logger.error(f"✗ Classifier initialization failed: {e}")
        logger.error(f"  Error type: {type(e).__name__}")
        import traceback
        logger.error(f"  Traceback:\n{traceback.format_exc()}")
        return False


def main():
    """Run all tests"""
    logger.info("\n")
    logger.info("🔍 PYTHON API STARTUP DIAGNOSTIC SCRIPT")
    logger.info("=" * 60)
    logger.info("This script checks if the API can start successfully\n")
    
    results = {
        "Imports": test_imports(),
        "Custom Modules": test_modules(),
        "Models Directory": test_models_directory(),
        "Classifier Init": test_classifier_init(),
    }
    
    logger.info("=" * 60)
    logger.info("TEST SUMMARY")
    logger.info("=" * 60)
    
    all_passed = True
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        logger.info(f"{status} - {test_name}")
        if not passed:
            all_passed = False
    
    logger.info("=" * 60)
    
    if all_passed:
        logger.info("\n✅ All tests passed! You can start the API with:")
        logger.info("   python -m uvicorn api_server:app --host 0.0.0.0 --port 8000")
        return 0
    else:
        logger.error("\n❌ Some tests failed. Fix the errors above before starting the API.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
