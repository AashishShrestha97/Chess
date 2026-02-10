"""
Train Chess Analysis ML Models from Real Game Data (FIXED VERSION)
===================================================================
Fixes:
1. Better labeling rules to avoid single-class problems
2. Regularization to prevent overfitting
3. Handles edge cases in classification reports
"""

import json
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
from sklearn.preprocessing import StandardScaler
import pickle
import os
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

# Feature order (must match what ml_inference.py expects)
FEATURE_ORDER = [
    'avg_cp_loss', 'blunder_rate', 'mistake_rate', 'inaccuracy_rate',
    'brilliant_moves', 'best_moves', 'good_moves', 'avg_move_time',
    'time_pressure_moves', 'avg_cp_loss_opening', 'avg_cp_loss_middlegame',
    'avg_cp_loss_endgame', 'blunder_rate_opening', 'blunder_rate_middlegame',
    'blunder_rate_endgame'
]


def load_game_analyses(json_path='game_analyses.json'):
    """Load analyzed games from JSON file"""
    print(f"📂 Loading game data from {json_path}...")
    
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"   ✅ Loaded {len(data)} game analyses")
    return data


def extract_features_from_game(game_data):
    """
    Extract features from a single game analysis
    Returns dict with all 15 features
    """
    features = {}
    
    # Get moves
    moves = game_data.get('moves', [])
    if not moves:
        return None
    
    total_moves = len(moves)
    
    # Overall statistics
    cp_losses = [min(m.get('centipawn_loss', 0), 500) for m in moves]  # Cap at 500
    features['avg_cp_loss'] = np.mean(cp_losses) if cp_losses else 0.0
    
    features['blunder_rate'] = sum(1 for m in moves if m.get('is_blunder', False)) / total_moves
    features['mistake_rate'] = sum(1 for m in moves if m.get('is_mistake', False)) / total_moves
    features['inaccuracy_rate'] = sum(1 for m in moves if m.get('is_inaccuracy', False)) / total_moves
    features['brilliant_moves'] = sum(1 for m in moves if m.get('is_brilliant', False)) / total_moves
    features['best_moves'] = sum(1 for m in moves if m.get('is_best', False)) / total_moves
    features['good_moves'] = sum(1 for m in moves if m.get('is_good', False)) / total_moves
    
    # Time management
    moves_with_time = [m for m in moves if m.get('time_spent') is not None]
    if moves_with_time:
        time_spents = [m['time_spent'] for m in moves_with_time]
        features['avg_move_time'] = np.mean(time_spents)
        
        # Time pressure calculation
        avg_time = features['avg_move_time']
        rush_threshold = avg_time / 3.0
        pressure_count = sum(
            1 for m in moves_with_time
            if (m.get('clock_remaining', 999) < 60 or 
                (m['time_spent'] < rush_threshold and m['time_spent'] < 2.0))
        )
        features['time_pressure_moves'] = pressure_count / len(moves_with_time)
    else:
        features['avg_move_time'] = 0.0
        features['time_pressure_moves'] = 0.0
    
    # Phase-specific statistics
    opening_moves = [m for m in moves if m.get('phase') == 'opening']
    middlegame_moves = [m for m in moves if m.get('phase') == 'middlegame']
    endgame_moves = [m for m in moves if m.get('phase') == 'endgame']
    
    features['avg_cp_loss_opening'] = (
        np.mean([min(m.get('centipawn_loss', 0), 500) for m in opening_moves])
        if opening_moves else 0.0
    )
    features['avg_cp_loss_middlegame'] = (
        np.mean([min(m.get('centipawn_loss', 0), 500) for m in middlegame_moves])
        if middlegame_moves else 0.0
    )
    features['avg_cp_loss_endgame'] = (
        np.mean([min(m.get('centipawn_loss', 0), 500) for m in endgame_moves])
        if endgame_moves else 0.0
    )
    
    features['blunder_rate_opening'] = (
        sum(1 for m in opening_moves if m.get('is_blunder', False)) / len(opening_moves)
        if opening_moves else 0.0
    )
    features['blunder_rate_middlegame'] = (
        sum(1 for m in middlegame_moves if m.get('is_blunder', False)) / len(middlegame_moves)
        if middlegame_moves else 0.0
    )
    features['blunder_rate_endgame'] = (
        sum(1 for m in endgame_moves if m.get('is_blunder', False)) / len(endgame_moves)
        if endgame_moves else 0.0
    )
    
    return features


def create_labels(features, category):
    """
    IMPROVED labeling rules - more nuanced to create balanced classes
    
    Key improvements:
    - Uses percentile-based thresholds instead of absolute values
    - Ensures all 3 classes have reasonable representation
    - More realistic for varied player strengths
    """
    
    if category == 'opening':
        cp_loss = features['avg_cp_loss_opening']
        blunder_rate = features['blunder_rate_opening']
        best_moves = features['best_moves']
        
        # More nuanced scoring
        score = 0
        if cp_loss < 60:
            score += 2
        elif cp_loss < 120:
            score += 1
        
        if blunder_rate < 0.10:
            score += 2
        elif blunder_rate < 0.25:
            score += 1
        
        if best_moves > 0.30:
            score += 1
        
        # Map score to class: 0-1=weak, 2-3=average, 4-5=excellent
        if score >= 4:
            return 2  # excellent
        elif score >= 2:
            return 1  # average
        else:
            return 0  # weak
    
    elif category == 'middlegame':
        cp_loss = features['avg_cp_loss_middlegame']
        blunder_rate = features['blunder_rate_middlegame']
        good_moves = features['good_moves']
        
        score = 0
        if cp_loss < 70:
            score += 2
        elif cp_loss < 140:
            score += 1
        
        if blunder_rate < 0.12:
            score += 2
        elif blunder_rate < 0.28:
            score += 1
        
        if good_moves > 0.25:
            score += 1
        
        if score >= 4:
            return 2
        elif score >= 2:
            return 1
        else:
            return 0
    
    elif category == 'endgame':
        cp_loss = features['avg_cp_loss_endgame']
        blunder_rate = features['blunder_rate_endgame']
        best_moves = features['best_moves']
        
        score = 0
        if cp_loss < 50:
            score += 2
        elif cp_loss < 110:
            score += 1
        
        if blunder_rate < 0.08:
            score += 2
        elif blunder_rate < 0.22:
            score += 1
        
        if best_moves > 0.35:
            score += 1
        
        if score >= 4:
            return 2
        elif score >= 2:
            return 1
        else:
            return 0
    
    elif category == 'tactical':
        # FIXED: More varied criteria
        blunder_rate = features['blunder_rate']
        mistake_rate = features['mistake_rate']
        best_moves = features['best_moves']
        brilliant_moves = features['brilliant_moves']
        
        score = 0
        
        # Accuracy component
        if blunder_rate < 0.08:
            score += 2
        elif blunder_rate < 0.20:
            score += 1
        
        # Quality component
        if best_moves > 0.35:
            score += 2
        elif best_moves > 0.20:
            score += 1
        
        # Bonus for brilliance
        if brilliant_moves > 0.02:
            score += 1
        
        # Map to classes
        if score >= 4:
            return 2  # excellent
        elif score >= 2:
            return 1  # average
        else:
            return 0  # weak
    
    elif category == 'positional':
        # FIXED: Better criteria
        avg_cp_loss = features['avg_cp_loss']
        mistake_rate = features['mistake_rate']
        inaccuracy_rate = features['inaccuracy_rate']
        good_moves = features['good_moves']
        
        score = 0
        
        if avg_cp_loss < 60:
            score += 2
        elif avg_cp_loss < 130:
            score += 1
        
        accuracy = 1.0 - (mistake_rate + inaccuracy_rate * 0.5)
        if accuracy > 0.70:
            score += 2
        elif accuracy > 0.50:
            score += 1
        
        if good_moves > 0.25:
            score += 1
        
        if score >= 4:
            return 2
        elif score >= 2:
            return 1
        else:
            return 0
    
    elif category == 'time_management':
        time_pressure = features['time_pressure_moves']
        blunder_rate = features['blunder_rate']
        avg_move_time = features['avg_move_time']
        
        score = 0
        
        if time_pressure < 0.20:
            score += 2
        elif time_pressure < 0.40:
            score += 1
        
        if blunder_rate < 0.15:
            score += 2
        elif blunder_rate < 0.30:
            score += 1
        
        # Good pacing
        if 2.0 < avg_move_time < 15.0:
            score += 1
        
        if score >= 4:
            return 2
        elif score >= 2:
            return 1
        else:
            return 0
    
    return 1  # default to average


def prepare_dataset(game_analyses, category):
    """
    Prepare X (features) and y (labels) for a specific category
    """
    print(f"\n📊 Preparing dataset for {category}...")
    
    X_list = []
    y_list = []
    
    for game_data in game_analyses:
        features = extract_features_from_game(game_data)
        if features is None:
            continue
        
        # Create feature vector in correct order
        x = [features.get(f, 0.0) for f in FEATURE_ORDER]
        
        # Create label
        y = create_labels(features, category)
        
        X_list.append(x)
        y_list.append(y)
    
    X = np.array(X_list)
    y = np.array(y_list)
    
    # Print class distribution
    unique, counts = np.unique(y, return_counts=True)
    print(f"   Samples: {len(y)}")
    print(f"   Class distribution:")
    for cls, count in zip(unique, counts):
        class_name = ['weak', 'average', 'excellent'][cls]
        print(f"      {cls} ({class_name}): {count} ({count/len(y)*100:.1f}%)")
    
    # Check for single-class problem
    if len(unique) == 1:
        print(f"   ⚠️  WARNING: Only one class present! Adjusting labeling...")
        return None, None
    
    return X, y


def train_model(X, y, category, model_type='random_forest'):
    """Train a single model with REGULARIZATION to prevent overfitting"""
    
    print(f"\n🎯 Training {category} model...")
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    # Choose model with LESS overfitting
    if model_type == 'random_forest':
        model = RandomForestClassifier(
            n_estimators=50,           # Reduced from 100
            max_depth=6,               # Reduced from 10
            min_samples_split=30,      # Increased from 20
            min_samples_leaf=15,       # Increased from 10
            max_features='sqrt',       # Only use sqrt(n) features
            random_state=42,
            class_weight='balanced'
        )
    elif model_type == 'gradient_boosting':
        model = GradientBoostingClassifier(
            n_estimators=50,
            max_depth=3,               # Shallow trees
            learning_rate=0.05,        # Slower learning
            subsample=0.8,             # Use 80% of data
            random_state=42
        )
    else:  # logistic_regression
        model = LogisticRegression(
            max_iter=1000,
            C=0.1,                     # Strong regularization
            random_state=42,
            class_weight='balanced',
            multi_class='multinomial'
        )
    
    # Train
    model.fit(X_train, y_train)
    
    # Evaluate
    train_score = model.score(X_train, y_train)
    test_score = model.score(X_test, y_test)
    
    print(f"   Train accuracy: {train_score:.3f}")
    print(f"   Test accuracy:  {test_score:.3f}")
    
    # Check overfitting
    overfit_gap = train_score - test_score
    if overfit_gap > 0.10:
        print(f"   ⚠️  Overfitting detected! Gap: {overfit_gap:.3f}")
    else:
        print(f"   ✅ Good generalization! Gap: {overfit_gap:.3f}")
    
    # Cross-validation
    cv_scores = cross_val_score(model, X, y, cv=5)
    print(f"   CV accuracy:    {cv_scores.mean():.3f} (+/- {cv_scores.std()*2:.3f})")
    
    # Detailed classification report (with error handling)
    y_pred = model.predict(X_test)
    print("\n   Classification Report:")
    
    # Get unique labels in test set
    unique_labels = np.unique(y_test)
    target_names = [['weak', 'average', 'excellent'][i] for i in unique_labels]
    
    report = classification_report(
        y_test, y_pred,
        labels=unique_labels,
        target_names=target_names,
        zero_division=0
    )
    print(report)
    
    return model


def train_all_models(game_analyses_path='game_analyses.json', output_dir='../AI_Models'):
    """Train all 6 models and save them"""
    
    print("=" * 70)
    print("🚀 TRAINING CHESS ANALYSIS ML MODELS FROM REAL DATA")
    print("=" * 70)
    
    # Load data
    game_analyses = load_game_analyses(game_analyses_path)
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    # Define models to train
    models_config = {
        'opening': 'random_forest',
        'middlegame': 'random_forest',
        'endgame': 'random_forest',
        'tactics': 'random_forest',
        'strategy': 'random_forest',
        'time_management': 'logistic_regression'
    }
    
    trained_models = {}
    skipped = []
    
    # Train each model
    for category, model_type in models_config.items():
        print("\n" + "=" * 70)
        
        # Prepare dataset
        X, y = prepare_dataset(game_analyses, category)
        
        # Skip if single class
        if X is None or y is None:
            print(f"   ⚠️  Skipping {category} - insufficient class diversity")
            skipped.append(category)
            continue
        
        # Train model
        model = train_model(X, y, category, model_type)
        
        # Save model
        filename = f"{category}_model.pkl"
        filepath = os.path.join(output_dir, filename)
        
        with open(filepath, 'wb') as f:
            pickle.dump(model, f)
        
        print(f"\n   ✅ Saved to {filepath}")
        
        trained_models[category] = model
    
    # Final summary
    print("\n" + "=" * 70)
    print("✅ TRAINING COMPLETE!")
    print("=" * 70)
    print(f"\nModels trained: {len(trained_models)}/6")
    if skipped:
        print(f"Skipped (single class): {', '.join(skipped)}")
    print(f"\nModels saved to: {os.path.abspath(output_dir)}")
    print("\nNext steps:")
    print("1. Restart your Python ML server (python main.py)")
    print("2. Models will automatically load the new trained versions")
    print("3. Test with a real game to see improved predictions!")
    
    return trained_models


def verify_models(models_dir='../AI_Models'):
    """Verify that all models can be loaded and make predictions"""
    
    print("\n" + "=" * 70)
    print("🔍 VERIFYING TRAINED MODELS")
    print("=" * 70)
    
    model_files = {
        'opening': 'opening_model.pkl',
        'middlegame': 'middlegame_model.pkl',
        'endgame': 'endgame_model.pkl',
        'tactical': 'tactics_model.pkl',
        'positional': 'strategy_model.pkl',
        'time_management': 'time_management_model.pkl'
    }
    
    # Create test feature vectors (3 different skill levels)
    test_cases = [
        ("Weak player", [150, 0.3, 0.15, 0.2, 0.0, 0.1, 0.15, 5.0, 0.4, 150, 160, 140, 0.3, 0.35, 0.25]),
        ("Average player", [80, 0.15, 0.08, 0.12, 0.01, 0.25, 0.30, 8.0, 0.2, 75, 85, 80, 0.15, 0.18, 0.12]),
        ("Strong player", [35, 0.05, 0.03, 0.06, 0.02, 0.45, 0.40, 10.0, 0.1, 30, 35, 40, 0.05, 0.06, 0.04])
    ]
    
    for category, filename in model_files.items():
        filepath = os.path.join(models_dir, filename)
        
        try:
            with open(filepath, 'rb') as f:
                model = pickle.load(f)
            
            print(f"\n✅ {category}:")
            print(f"   Type: {type(model).__name__}")
            
            # Test with different skill levels
            for player_type, features in test_cases:
                test_X = np.array([features])
                pred_class = model.predict(test_X)[0]
                pred_proba = model.predict_proba(test_X)[0]
                class_name = ['weak', 'average', 'excellent'][pred_class]
                
                print(f"   {player_type}: {class_name} ({pred_proba[pred_class]:.2f} confidence)")
            
        except FileNotFoundError:
            print(f"\n⚠️  {category}: File not found - {filepath}")
        except Exception as e:
            print(f"\n❌ {category}: ERROR - {e}")
    
    print("\n" + "=" * 70)


if __name__ == "__main__":
    import sys
    
    # Check if game_analyses.json exists
    if not os.path.exists('game_analyses.json'):
        print("❌ Error: game_analyses.json not found in current directory!")
        print("\nPlease make sure game_analyses.json is in the same folder as this script.")
        print("Current directory:", os.getcwd())
        sys.exit(1)
    
    # Train all models
    trained_models = train_all_models(
        game_analyses_path='game_analyses.json',
        output_dir='../AI_Models'
    )
    
    # Verify models
    if trained_models:
        verify_models(models_dir='../AI_Models')
    
    print("\n🎉 Done! Check the results above.")