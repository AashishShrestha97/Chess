"""
Inspect pickled models to see what features they actually expect
"""
import joblib
import os

models_dir = os.path.join(os.path.dirname(__file__), "..", "ai_models")

print(f"\n{'='*60}")
print(f"INSPECTING TRAINED MODELS")
print(f"{'='*60}")

for category in ['opening', 'middlegame', 'endgame', 'tactical', 'positional', 'time_management']:
    model_path = os.path.join(models_dir, f'{category}_classifier.pkl')
    scaler_path = os.path.join(models_dir, f'{category}_scaler.pkl')
    
    if os.path.exists(model_path):
        try:
            model = joblib.load(model_path)
            scaler = joblib.load(scaler_path)
            
            print(f"\n[{category.upper()}]")
            print(f"  Model type: {type(model).__name__}")
            print(f"  n_features_in_: {model.n_features_in_}")
            
            if hasattr(model, 'feature_names_in_'):
                print(f"  feature_names_in_: {list(model.feature_names_in_)}")
            else:
                print(f"  feature_names_in_: NOT SET (model expects features in specific order)")
            
            print(f"  Scaler type: {type(scaler).__name__}")
            print(f"  Scaler n_features_in_: {scaler.n_features_in_}")
            if hasattr(scaler, 'feature_names_in_'):
                print(f"  Scaler feature_names_in_: {list(scaler.feature_names_in_)}")
            
        except Exception as e:
            print(f"  ERROR: {e}")
    else:
        print(f"\n[{category.upper()}] - NOT FOUND at {model_path}")

print(f"\n{'='*60}\n")
