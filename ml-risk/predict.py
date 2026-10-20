import json
import math
import sys
import warnings
from pathlib import Path
import joblib
import pandas as pd

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

warnings.filterwarnings("ignore")

from train_models import FEATURE_COLUMNS, MODEL_DIR


def predict_risks(input_features: dict, include_explanations: bool = True) -> dict:
    if not isinstance(input_features, dict):
        raise TypeError(f"input_features must be a dict, got {type(input_features).__name__}")

    missing = [c for c in FEATURE_COLUMNS if c not in input_features or input_features[c] is None]
    if missing:
        raise ValueError(f"Missing required features: {sorted(missing)}")

    for name in FEATURE_COLUMNS:
        val = input_features[name]
        if isinstance(val, bool) or not isinstance(val, (int, float)):
            raise ValueError(f"Feature '{name}' must be a valid number, got {val!r}")
        if not math.isfinite(val):
            raise ValueError(f"Feature '{name}' must be a finite number, got {val!r}")

    if input_features["budget_crores"] <= 0:
        raise ValueError("Feature 'budget_crores' must be greater than 0")
    if input_features["planned_duration_days"] <= 0:
        raise ValueError("Feature 'planned_duration_days' must be greater than 0")
    if input_features["inspection_failure_rate"] < 0.0 or input_features["inspection_failure_rate"] > 1.0:
        raise ValueError("Feature 'inspection_failure_rate' must be between 0.0 and 1.0")
    if input_features["payment_progress_ratio"] < 0:
        raise ValueError("Feature 'payment_progress_ratio' must be non-negative")
    if input_features["change_order_frequency"] < 0:
        raise ValueError("Feature 'change_order_frequency' must be non-negative")
    if input_features["contractor_delay_history"] < 0:
        raise ValueError("Feature 'contractor_delay_history' must be non-negative")
    if input_features["milestone_delay_days"] < 0:
        raise ValueError("Feature 'milestone_delay_days' must be non-negative")

    row = pd.DataFrame([{name: float(input_features[name]) for name in FEATURE_COLUMNS}], columns=FEATURE_COLUMNS)
    result = {}
    loaded_models = {}
    for target in ("delay_risk", "cost_overrun_risk"):
        model_path = MODEL_DIR / f"{target}_best.joblib"
        if not model_path.exists():
            raise FileNotFoundError(f"Trained model not found: {model_path.name}. Run python train_models.py first.")
        model = joblib.load(model_path)
        loaded_models[target] = model
        result[target] = round(float(model.predict_proba(row)[0, 1]) * 100, 2)
    result["data_origin"] = "synthetic-development-model"
    result["warning"] = "Prototype prediction trained on synthetic data; not validated for real-world decisions."

    if include_explanations:
        try:
            from explain import explain_risks
            result["explanations"] = explain_risks(
                input_features,
                delay_model=loaded_models.get("delay_risk"),
                cost_model=loaded_models.get("cost_overrun_risk"),
            )
        except Exception as exc:
            result["explanations"] = {
                "available": False,
                "error": str(exc),
            }

    return result


def main() -> None:
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            sys.stderr.write(json.dumps({"error": "Empty input payload"}) + "\n")
            sys.stderr.flush()
            sys.exit(1)
        data = json.loads(raw)
        include_explanations = "--no-explain" not in sys.argv
        prediction = predict_risks(data, include_explanations=include_explanations)
        sys.stdout.write(json.dumps(prediction) + "\n")
        sys.stdout.flush()
    except Exception as exc:
        sys.stderr.write(json.dumps({"error": str(exc)}) + "\n")
        sys.stderr.flush()
        sys.exit(1)


if __name__ == "__main__":
    main()
