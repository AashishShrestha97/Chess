"""
ML-based Chess Player Classifier
Loads trained RandomForest models for inference
CORRECTED: Configured for 15 features to match trained models
"""

import joblib
import json
from typing import Dict, List
import pandas as pd
import os


class ChessPlayerClassifier:
    """
    ML-based classifier using trained RandomForest models
    Loads models from pickle files created in Google Colab
    """
    
    def __init__(self, model_dir='models'):
        """
        Initialize classifier
        
        Args:
            model_dir: Directory containing trained model files
        """
        self.model_dir = model_dir
        self.models = {}
        self.scalers = {}
        self.feature_columns = []
        self.categories = []
        
        # Try to load models automatically
        if os.path.exists(model_dir):
            try:
                self.load_models(model_dir)
            except Exception as e:
                print(f"WARNING: Could not auto-load models: {e}")
                print("   Call load_models() manually after initialization")
    
    def load_models(self, model_dir: str):
        """
        Load trained models and scalers from directory
        
        Args:
            model_dir: Directory containing .pkl model files and config.json
        """
        self.model_dir = model_dir
        
        print(f"Loading models from: {model_dir}")
        
        # Load configuration
        config_path = os.path.join(model_dir, 'model_config.json')
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                config = json.load(f)
                self.feature_columns = config['feature_columns']
                self.categories = config['categories']
                print(f"[OK] Loaded config: {len(self.categories)} categories")
        else:
            # Use defaults if config not found
            print("[WARNING] model_config.json not found, using defaults")
            # ✅ CORRECTED: Models were trained with ALL 15 features (including phase-specific ones)
            self.feature_columns = [
                'avg_cp_loss', 'blunder_rate', 'mistake_rate',
                'inaccuracy_rate', 'avg_move_time', 'time_pressure_moves',
                'brilliant_moves', 'best_moves', 'good_moves',
                'avg_cp_loss_opening', 'avg_cp_loss_middlegame', 'avg_cp_loss_endgame',
                'blunder_rate_opening', 'blunder_rate_middlegame', 'blunder_rate_endgame'
            ]
            self.categories = ['opening', 'middlegame', 'endgame', 
                             'tactical', 'positional', 'time_management']
        
        # Load models and scalers
        loaded_count = 0
        for category in self.categories:
            try:
                model_path = os.path.join(model_dir, f'{category}_classifier.pkl')
                scaler_path = os.path.join(model_dir, f'{category}_scaler.pkl')
                
                if os.path.exists(model_path) and os.path.exists(scaler_path):
                    self.models[category] = joblib.load(model_path)
                    self.scalers[category] = joblib.load(scaler_path)
                    loaded_count += 1
                    print(f"[OK] Loaded {category} model")
                else:
                    print(f"[WARNING] Model files not found for {category}")
                    
            except Exception as e:
                print(f"[ERROR] Failed to load {category} model: {e}")
        
        if loaded_count == 0:
            raise RuntimeError("No models loaded! Check model directory.")
        
        print(f"\n[OK] Successfully loaded {loaded_count}/{len(self.categories)} models")
        print(f"[OK] Expecting {len(self.feature_columns)} features per prediction")
    
    def predict(self, features: Dict[str, float]) -> Dict[str, Dict]:
        """
        Predict player classification for all categories
        
        Args:
            features: Dictionary of all 15 extracted features
            
        Returns:
            Dictionary mapping category to prediction details
        """
        if not self.models:
            raise RuntimeError("No models loaded. Call load_models() first.")
        
        # Validate we have at least 15 features
        if len(features) < 15:
            raise ValueError(
                f"Feature mismatch! Received {len(features)} features but need all 15. "
                f"Received: {list(features.keys())}"
            )
        
        predictions = {}
        
        # Create full feature dataframe
        X_full = pd.DataFrame([features])[self.feature_columns].fillna(0)
        
        for category in self.categories:
            if category not in self.models:
                continue
            
            model = self.models[category]
            scaler = self.scalers.get(category)
            
            # Scale using the full 15 features if scaler exists
            if scaler is not None:
                X_scaled = scaler.transform(X_full)
            else:
                # No scaler for this model, use raw features
                X_scaled = X_full.values
            
            # Get the feature names the model expects
            expected_features = list(model.feature_names_in_)
            
            # Select only the features this model was trained with
            feature_indices = [self.feature_columns.index(f) for f in expected_features if f in self.feature_columns]
            X_model_input = X_scaled[:, feature_indices]
            
            # Predict
            pred_label = model.predict(X_model_input)[0]
            pred_proba = model.predict_proba(X_model_input)[0]
            
            label_map = {0: 'weak', 1: 'average', 2: 'strong'}
            
            predictions[category] = {
                'classification': label_map[pred_label],
                'confidence': float(pred_proba[pred_label]),
                'numeric_score': int(pred_label)
            }
        
        return predictions
    
    def get_strengths_and_weaknesses(self, predictions: Dict[str, Dict]) -> Dict[str, List[str]]:
        """
        Extract strengths and weaknesses from predictions
        
        Args:
            predictions: Predictions from predict() method
            
        Returns:
            Dictionary with 'strengths' and 'weaknesses' lists
        """
        strengths = []
        weaknesses = []
        
        for category, pred in predictions.items():
            classification = pred['classification']
            confidence = pred['confidence']
            
            # STRICT: Only include very high-confidence predictions for strengths
            # Require 75% confidence to be considered a strength
            if classification == 'strong' and confidence >= 0.75:
                strengths.append(category)
            # Include both 'weak' and 'average' as weaknesses to help user improve
            # Require 60% confidence for weaknesses
            elif (classification == 'weak' or classification == 'average') and confidence >= 0.60:
                weaknesses.append(category)
        
        return {
            'strengths': strengths,
            'weaknesses': weaknesses
        }
    
    def get_model_info(self) -> Dict:
        """Get information about loaded models"""
        return {
            'model_dir': self.model_dir,
            'categories_loaded': list(self.models.keys()),
            'total_categories': len(self.categories),
            'feature_count': len(self.feature_columns),
            'features': self.feature_columns
        }


# For testing
if __name__ == "__main__":
    # Test loading models
    try:
        classifier = ChessPlayerClassifier(model_dir='models')
        info = classifier.get_model_info()
        
        print("\nModel Info:")
        print(f"  Models loaded: {len(info['categories_loaded'])}/{info['total_categories']}")
        print(f"  Categories: {', '.join(info['categories_loaded'])}") 
        print(f"  Features: {info['feature_count']}")
        print(f"  Feature names: {info['features']}")
        
    except Exception as e:
        print(f"Error: {e}")
        print("\nMake sure you have:")
        print("  1. Created 'models/' directory")
        print("  2. Placed .pkl model files in it")
        print("  3. Included model_config.json")