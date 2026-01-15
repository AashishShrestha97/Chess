"""
Improved Machine Learning Training Pipeline for Chess Player Classification
Automatically calculates thresholds based on actual data distribution

KEY IMPROVEMENTS:
1. Data-driven thresholds using percentiles
2. Separate thresholds for each feature
3. Better handling of AND vs OR logic
4. Configurable strictness
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix
import xgboost as xgb
import joblib
import json
from typing import Dict, List, Tuple, Optional
import os
import warnings


class ImprovedChessPlayerClassifier:
    """
    Multi-label classifier with adaptive thresholds based on data distribution
    """
    
    def __init__(self, model_type: str = 'xgboost', 
                 strong_percentile: float = 0.25,
                 weak_percentile: float = 0.75):
        """
        Initialize classifier
        
        Args:
            model_type: 'xgboost' or 'random_forest'
            strong_percentile: Percentile threshold for 'strong' classification (default: 0.25 = top 25%)
            weak_percentile: Percentile threshold for 'weak' classification (default: 0.75 = bottom 25%)
        """
        self.model_type = model_type
        self.models = {}
        self.scalers = {}
        self.feature_names = None
        self.thresholds = {}  # Will store calculated thresholds
        self.strong_percentile = strong_percentile
        self.weak_percentile = weak_percentile
        
        self.categories = [
            'opening',
            'middlegame', 
            'endgame',
            'tactical',
            'positional',
            'time_management'
        ]
        
        # Define which features are used for each category
        self.category_features = {
            'opening': ['avg_cp_loss_opening', 'blunder_rate_opening'],
            'middlegame': ['avg_cp_loss_middlegame', 'blunder_rate_middlegame'],
            'endgame': ['avg_cp_loss_endgame', 'blunder_rate_endgame'],
            'tactical': ['tactical_error_rate', 'blunder_rate_overall'],
            'positional': ['positional_drift', 'positional_error_rate'],
            'time_management': ['time_pressure_blunder_rate', 'avg_cp_loss_time_pressure']
        }
        
    def _create_model(self):
        """Create a new model instance"""
        if self.model_type == 'xgboost':
            return xgb.XGBClassifier(
                n_estimators=100,
                max_depth=6,
                learning_rate=0.1,
                objective='multi:softmax',
                num_class=3,
                random_state=42
            )
        else:
            return RandomForestClassifier(
                n_estimators=100,
                max_depth=10,
                random_state=42,
                n_jobs=-1
            )
    
    def _calculate_thresholds(self, df: pd.DataFrame):
        """
        Calculate adaptive thresholds based on data distribution
        
        Args:
            df: DataFrame with all features
        """
        print("\nCalculating adaptive thresholds based on data distribution...")
        print(f"Using percentiles - Strong: <{self.strong_percentile*100:.0f}%, Weak: >{self.weak_percentile*100:.0f}%")
        print("-" * 80)
        
        for category, features in self.category_features.items():
            self.thresholds[category] = {}
            
            print(f"\n{category.upper()}:")
            for feature in features:
                if feature in df.columns:
                    values = df[feature].dropna()
                    
                    # For error/loss metrics, lower is better
                    strong_thresh = values.quantile(self.strong_percentile)
                    weak_thresh = values.quantile(self.weak_percentile)
                    
                    self.thresholds[category][feature] = {
                        'strong': strong_thresh,
                        'weak': weak_thresh,
                        'mean': values.mean(),
                        'median': values.median()
                    }
                    
                    print(f"  {feature}:")
                    print(f"    Strong: < {strong_thresh:.3f}")
                    print(f"    Average: {strong_thresh:.3f} - {weak_thresh:.3f}")
                    print(f"    Weak: > {weak_thresh:.3f}")
                    print(f"    (Mean: {values.mean():.3f}, Median: {values.median():.3f})")
    
    def _determine_labels(self, features: Dict[str, float]) -> Dict[str, int]:
        """
        Determine strength/weakness labels using calculated thresholds
        Uses average of feature scores for more balanced classification
        
        Args:
            features: Dictionary of extracted features
            
        Returns:
            Dictionary of labels (0=weak, 1=average, 2=strong) for each category
        """
        labels = {}
        
        for category in self.categories:
            category_thresh = self.thresholds.get(category, {})
            feature_list = self.category_features[category]
            
            # Calculate score for each feature
            scores = []
            for feature in feature_list:
                if feature in category_thresh and feature in features:
                    value = features[feature]
                    strong_thresh = category_thresh[feature]['strong']
                    weak_thresh = category_thresh[feature]['weak']
                    
                    # Score: 2 = strong, 1 = average, 0 = weak
                    if value < strong_thresh:
                        scores.append(2)
                    elif value < weak_thresh:
                        scores.append(1)
                    else:
                        scores.append(0)
            
            # Average the scores and round
            if scores:
                avg_score = np.mean(scores)
                # Round to nearest integer, but ensure we get good distribution
                if avg_score >= 1.5:
                    labels[category] = 2  # strong
                elif avg_score >= 0.75:
                    labels[category] = 1  # average
                else:
                    labels[category] = 0  # weak
            else:
                # Fallback to average if no scores
                labels[category] = 1
        
        return labels
    
    def prepare_training_data(self, features_list: List[Dict[str, float]]) -> Tuple[pd.DataFrame, Dict[str, np.ndarray]]:
        """
        Prepare training data and calculate adaptive thresholds
        
        Args:
            features_list: List of feature dictionaries from multiple players
            
        Returns:
            Tuple of (features_df, labels_dict)
        """
        # Convert features to DataFrame
        df = pd.DataFrame(features_list)
        
        # Store feature names
        self.feature_names = df.columns.tolist()
        
        # Calculate adaptive thresholds based on data
        self._calculate_thresholds(df)
        
        # Generate labels for each category
        labels_dict = {cat: [] for cat in self.categories}
        
        for features in features_list:
            labels = self._determine_labels(features)
            for cat in self.categories:
                labels_dict[cat].append(labels[cat])
        
        # Convert to numpy arrays
        for cat in self.categories:
            labels_dict[cat] = np.array(labels_dict[cat])
        
        # Show label distribution
        print("\n" + "="*80)
        print("LABEL DISTRIBUTION AFTER ADAPTIVE THRESHOLDS")
        print("="*80)
        for category in self.categories:
            unique, counts = np.unique(labels_dict[category], return_counts=True)
            dist = dict(zip(unique, counts))
            total = len(labels_dict[category])
            
            weak = dist.get(0, 0)
            avg = dist.get(1, 0)
            strong = dist.get(2, 0)
            
            print(f"\n{category}:")
            print(f"  Strong:  {strong:3d} ({strong/total*100:5.1f}%)")
            print(f"  Average: {avg:3d} ({avg/total*100:5.1f}%)")
            print(f"  Weak:    {weak:3d} ({weak/total*100:5.1f}%)")
        
        return df, labels_dict
    
    def train(self, features_df: pd.DataFrame, labels_dict: Dict[str, np.ndarray]):
        """
        Train separate models for each category
        
        Args:
            features_df: DataFrame of features
            labels_dict: Dictionary of label arrays for each category
        """
        print("\n" + "="*80)
        print("TRAINING MODELS")
        print("="*80)
        
        for category in self.categories:
            print(f"\nTraining {category} classifier...")
            
            # Create and fit scaler
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(features_df)
            self.scalers[category] = scaler
            
            # Get labels for this category
            y = labels_dict[category]
            
            # Check class distribution
            unique_classes, class_counts = np.unique(y, return_counts=True)
            print(f"  Class distribution: {dict(zip(unique_classes, class_counts))}")
            
            min_class_count = min(class_counts)
            
            # Split data with stratification if possible
            if min_class_count >= 2:
                try:
                    X_train, X_test, y_train, y_test = train_test_split(
                        X_scaled, y, test_size=0.2, random_state=42, stratify=y
                    )
                except ValueError:
                    warnings.warn(f"Stratification failed for {category}, using random split")
                    X_train, X_test, y_train, y_test = train_test_split(
                        X_scaled, y, test_size=0.2, random_state=42
                    )
            else:
                print(f"  Warning: Small dataset, skipping stratification")
                X_train, X_test, y_train, y_test = train_test_split(
                    X_scaled, y, test_size=0.2, random_state=42
                )
            
            # Train model
            model = self._create_model()
            model.fit(X_train, y_train)
            self.models[category] = model
            
            # Evaluate
            train_score = model.score(X_train, y_train)
            test_score = model.score(X_test, y_test)
            
            print(f"  Train accuracy: {train_score:.3f}")
            print(f"  Test accuracy: {test_score:.3f}")
            
            # Cross-validation
            max_folds = min(5, min_class_count)
            
            if max_folds >= 2:
                try:
                    skf = StratifiedKFold(n_splits=max_folds, shuffle=True, random_state=42)
                    cv_scores = cross_val_score(model, X_scaled, y, cv=skf)
                    print(f"  CV accuracy ({max_folds}-fold): {cv_scores.mean():.3f} (+/- {cv_scores.std() * 2:.3f})")
                except ValueError:
                    cv_scores = cross_val_score(model, X_scaled, y, cv=max_folds)
                    print(f"  CV accuracy ({max_folds}-fold): {cv_scores.mean():.3f} (+/- {cv_scores.std() * 2:.3f})")
            else:
                print(f"  CV skipped: insufficient samples per class (min={min_class_count})")
            
            # Detailed metrics
            if len(X_test) > 0 and len(np.unique(y_test)) > 1:
                y_pred = model.predict(X_test)
                print(f"\n  Classification Report:")
                
                labels_in_test = sorted(np.unique(y_test))
                target_names = ['Weak', 'Average', 'Strong']
                target_names_subset = [target_names[i] for i in labels_in_test]
                
                print(classification_report(y_test, y_pred, 
                                           labels=labels_in_test,
                                           target_names=target_names_subset,
                                           zero_division=0))
    
    def predict(self, features: Dict[str, float]) -> Dict[str, Dict]:
        """
        Predict strengths/weaknesses for a player
        
        Args:
            features: Dictionary of extracted features
            
        Returns:
            Dictionary with predictions and confidence scores
        """
        df = pd.DataFrame([features])
        
        # Ensure all training features are present
        for feat in self.feature_names:
            if feat not in df.columns:
                df[feat] = 0
        
        df = df[self.feature_names]
        
        predictions = {}
        
        for category in self.categories:
            X_scaled = self.scalers[category].transform(df)
            pred = self.models[category].predict(X_scaled)[0]
            
            if hasattr(self.models[category], 'predict_proba'):
                proba = self.models[category].predict_proba(X_scaled)[0]
                confidence = float(proba[pred])
            else:
                confidence = 1.0
            
            label_map = {0: 'weak', 1: 'average', 2: 'strong'}
            
            predictions[category] = {
                'classification': label_map[pred],
                'confidence': confidence,
                'numeric_score': int(pred)
            }
        
        return predictions
    
    def save_models(self, output_dir: str):
        """Save trained models, scalers, and thresholds"""
        os.makedirs(output_dir, exist_ok=True)
        
        for category, model in self.models.items():
            model_path = os.path.join(output_dir, f'{category}_model.pkl')
            joblib.dump(model, model_path)
        
        for category, scaler in self.scalers.items():
            scaler_path = os.path.join(output_dir, f'{category}_scaler.pkl')
            joblib.dump(scaler, scaler_path)
        
        metadata = {
            'model_type': self.model_type,
            'feature_names': self.feature_names,
            'categories': self.categories,
            'thresholds': self.thresholds,
            'strong_percentile': self.strong_percentile,
            'weak_percentile': self.weak_percentile
        }
        metadata_path = os.path.join(output_dir, 'metadata.json')
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"\nModels saved to {output_dir}")
    
    def load_models(self, model_dir: str):
        """Load trained models from disk"""
        metadata_path = os.path.join(model_dir, 'metadata.json')
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)
        
        self.model_type = metadata['model_type']
        self.feature_names = metadata['feature_names']
        self.categories = metadata['categories']
        self.thresholds = metadata['thresholds']
        self.strong_percentile = metadata.get('strong_percentile', 0.25)
        self.weak_percentile = metadata.get('weak_percentile', 0.75)
        
        for category in self.categories:
            model_path = os.path.join(model_dir, f'{category}_model.pkl')
            self.models[category] = joblib.load(model_path)
            
            scaler_path = os.path.join(model_dir, f'{category}_scaler.pkl')
            self.scalers[category] = joblib.load(scaler_path)
        
        print(f"Models loaded from {model_dir}")
    
    def get_strengths_and_weaknesses(self, predictions: Dict[str, Dict]) -> Dict[str, List[str]]:
        """Extract explicit strengths and weaknesses from predictions"""
        strengths = []
        weaknesses = []
        
        for category, pred in predictions.items():
            if pred['classification'] == 'strong':
                strengths.append(category)
            elif pred['classification'] == 'weak':
                weaknesses.append(category)
        
        return {
            'strengths': strengths,
            'weaknesses': weaknesses
        }


if __name__ == "__main__":
    import pickle
    
    print("="*80)
    print("IMPROVED CHESS PLAYER CLASSIFIER WITH ADAPTIVE THRESHOLDS")
    print("="*80)
    
    # Load actual training data
    try:
        with open("training_features.pkl", "rb") as f:
            all_features = pickle.load(f)
        print(f"\n✓ Loaded {len(all_features)} players from training_features.pkl")
    except FileNotFoundError:
        print("\n⚠️  training_features.pkl not found. Using synthetic data for demo...")
        # Generate synthetic data
        all_features = []
        for i in range(50):
            features = {
                'avg_cp_loss_opening': np.random.uniform(40, 150),
                'avg_cp_loss_middlegame': np.random.uniform(50, 180),
                'avg_cp_loss_endgame': np.random.uniform(45, 160),
                'avg_cp_loss_overall': np.random.uniform(45, 165),
                'blunder_rate_opening': np.random.uniform(0.1, 0.5),
                'blunder_rate_middlegame': np.random.uniform(0.12, 0.55),
                'blunder_rate_endgame': np.random.uniform(0.08, 0.45),
                'blunder_rate_overall': np.random.uniform(0.1, 0.5),
                'tactical_error_rate': np.random.uniform(0.2, 0.6),
                'positional_drift': np.random.uniform(40, 100),
                'positional_error_rate': np.random.uniform(0.25, 0.65),
                'time_pressure_blunder_rate': np.random.uniform(0.2, 0.7),
                'avg_cp_loss_time_pressure': np.random.uniform(60, 200),
                'total_games': 10,
            }
            all_features.append(features)
    
    # Train with adaptive thresholds
    classifier = ImprovedChessPlayerClassifier(
        model_type='xgboost',
        strong_percentile=0.25,  # Top 25% are "strong"
        weak_percentile=0.75     # Bottom 25% are "weak"
    )
    
    features_df, labels_dict = classifier.prepare_training_data(all_features)
    classifier.train(features_df, labels_dict)
    classifier.save_models('models_adaptive')
    
    # Test prediction
    print("\n" + "="*80)
    print("EXAMPLE PREDICTION")
    print("="*80)
    test_features = all_features[0]
    predictions = classifier.predict(test_features)
    
    print("\nPredictions:")
    for cat, pred in predictions.items():
        print(f"  {cat}: {pred['classification']} (confidence: {pred['confidence']:.2f})")
    
    strengths_weaknesses = classifier.get_strengths_and_weaknesses(predictions)
    print("\nStrengths:", strengths_weaknesses['strengths'])
    print("Weaknesses:", strengths_weaknesses['weaknesses'])
    
    print("\n" + "="*80)
    print("✓ Training complete! Models saved to 'models_adaptive/'")
    print("="*80)
