"""
ML-based Chess Player Classifier
Loads trained RandomForest models for inference
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
                print(f"⚠️  Could not auto-load models: {e}")
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
                print(f"✓ Loaded config: {len(self.categories)} categories")
        else:
            # Use defaults if config not found
            print("⚠️  model_config.json not found, using defaults")
            # 15 features that models were trained with
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
                    print(f"✓ Loaded {category} model")
                else:
                    print(f"⚠️  Model files not found for {category}")
                    
            except Exception as e:
                print(f"✗ Failed to load {category} model: {e}")
        
        if loaded_count == 0:
            raise RuntimeError("No models loaded! Check model directory.")
        
        print(f"\n✓ Successfully loaded {loaded_count}/{len(self.categories)} models")
    
    def predict(self, features: Dict[str, float]) -> Dict[str, Dict]:
        """
        Predict player classification for all categories
        
        Args:
            features: Dictionary of extracted features
            
        Returns:
            Dictionary mapping category to prediction details
        """
        if not self.models:
            raise RuntimeError("No models loaded. Call load_models() first.")
        
        predictions = {}
        
        # Prepare feature vector
        X_input = pd.DataFrame([features])[self.feature_columns].fillna(0)
        
        for category in self.categories:
            if category not in self.models:
                continue
            
            model = self.models[category]
            scaler = self.scalers[category]
            
            # Scale features
            X_scaled = scaler.transform(X_input)
            
            # Predict
            pred_label = model.predict(X_scaled)[0]
            pred_proba = model.predict_proba(X_scaled)[0]
            
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
            
            # Only include high-confidence predictions
            if confidence >= 0.65:
                if classification == 'strong':
                    strengths.append(category)
                elif classification == 'weak':
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
        
        print("\\nModel Info:")
        print(f"  Models loaded: {len(info['categories_loaded'])}/{info['total_categories']}")
        print(f"  Categories: {', '.join(info['categories_loaded'])}") 
        print(f"  Features: {info['feature_count']}")
        
    except Exception as e:
        print(f"Error: {e}")
        print("\\nMake sure you have:")
        print("  1. Created 'models/' directory")
        print("  2. Placed .pkl model files in it")
        print("  3. Included model_config.json")
