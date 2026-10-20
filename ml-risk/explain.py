from pathlib import Path
import math
import sys
import warnings
import joblib
import numpy as np
import pandas as pd
import xgboost as xgb

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from train_models import FEATURE_COLUMNS, MODEL_DIR

FEATURE_DISPLAY_NAMES = {
    "progress_variance": "Progress Variance (% points)",
    "schedule_variance": "Schedule Variance (%)",
    "payment_progress_ratio": "Payment-to-Progress Ratio",
    "milestone_delay_days": "Milestone Delay (days)",
    "change_order_frequency": "Change Order Frequency (/mo)",
    "inspection_failure_rate": "Inspection Failure Rate",
    "contractor_delay_history": "Contractor Delay History (count)",
    "cost_variance_pct": "Cost Variance (%)",
    "planned_duration_days": "Planned Duration (days)",
    "budget_crores": "Total Budget (₹ Cr)",
}


def _safe_float(val, default: float = 0.0) -> float:
    if val is None:
        return default
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return default
        return round(f, 6)
    except (TypeError, ValueError):
        return default


def explain_logistic_regression(
    model,
    row: pd.DataFrame,
    feature_names: list[str] = FEATURE_COLUMNS,
    top_n: int = 5,
) -> dict:
    """
    Computes feature attribution for a scikit-learn Pipeline with SimpleImputer,
    StandardScaler, and LogisticRegression.

    Attribution is calculated in log-odds (decision score) space:
      decision_score = intercept + sum(coef_i * x_scaled_i)
    Each feature's contribution c_i = coef_i * x_scaled_i represents its
    additive shift to the log-odds of delay risk.
    """
    imputer = model.named_steps["imputer"]
    scaler = model.named_steps["scaler"]
    classifier = model.named_steps["model"]

    x_imp = imputer.transform(row)
    x_scaled = scaler.transform(x_imp)[0]

    coefs = classifier.coef_[0]
    intercept = float(classifier.intercept_[0])

    contributions = coefs * x_scaled
    total_abs = float(np.sum(np.abs(contributions)))
    if total_abs == 0:
        total_abs = 1e-9

    all_drivers = []
    for idx, name in enumerate(feature_names):
        c_val = _safe_float(contributions[idx])
        in_val = _safe_float(row.iloc[0][name])
        mag = _safe_float((abs(c_val) / total_abs) * 100.0)

        if c_val > 1e-5:
            direction = "increases_risk"
        elif c_val < -1e-5:
            direction = "decreases_risk"
        else:
            direction = "neutral"

        all_drivers.append({
            "feature": name,
            "feature_name": FEATURE_DISPLAY_NAMES.get(name, name),
            "input_value": in_val,
            "contribution": c_val,
            "scale": "log_odds",
            "direction": direction,
            "display_magnitude": round(mag, 1),
        })

    # Rank by absolute contribution magnitude
    ranked_drivers = sorted(all_drivers, key=lambda d: abs(d["contribution"]), reverse=True)
    top_drivers = ranked_drivers[:top_n]

    return {
        "target": "delay_risk",
        "model_type": "LogisticRegression",
        "method": "linear_model_coefficients",
        "base_value": _safe_float(intercept),
        "scale": "log_odds",
        "top_drivers": top_drivers,
        "all_drivers": all_drivers,
        "note": (
            "Feature contributions are evaluated in log-odds decision space after median imputation and standard scaling. "
            "A positive contribution pushes the log-odds higher, increasing predicted delay risk."
        ),
    }


def explain_xgboost(
    model,
    row: pd.DataFrame,
    feature_names: list[str] = FEATURE_COLUMNS,
    top_n: int = 5,
) -> dict:
    """
    Computes TreeSHAP feature attribution for an XGBoost Pipeline using
    native booster.predict(dmatrix, pred_contribs=True).

    Attribution is calculated in margin (log-odds) space:
      margin = base_value + sum(shap_values_i)
    """
    imputer = model.named_steps["imputer"]
    classifier = model.named_steps["model"]

    x_imp = imputer.transform(row)
    dmat = xgb.DMatrix(x_imp, feature_names=feature_names)
    booster = classifier.get_booster()

    contribs = booster.predict(dmat, pred_contribs=True)[0]
    feat_contribs = contribs[:-1]
    base_val = float(contribs[-1])

    total_abs = float(np.sum(np.abs(feat_contribs)))
    if total_abs == 0:
        total_abs = 1e-9

    all_drivers = []
    for idx, name in enumerate(feature_names):
        c_val = _safe_float(feat_contribs[idx])
        in_val = _safe_float(row.iloc[0][name])
        mag = _safe_float((abs(c_val) / total_abs) * 100.0)

        if c_val > 1e-5:
            direction = "increases_risk"
        elif c_val < -1e-5:
            direction = "decreases_risk"
        else:
            direction = "neutral"

        all_drivers.append({
            "feature": name,
            "feature_name": FEATURE_DISPLAY_NAMES.get(name, name),
            "input_value": in_val,
            "contribution": c_val,
            "scale": "log_odds_margin",
            "direction": direction,
            "display_magnitude": round(mag, 1),
        })

    # Rank by absolute contribution magnitude
    ranked_drivers = sorted(all_drivers, key=lambda d: abs(d["contribution"]), reverse=True)
    top_drivers = ranked_drivers[:top_n]

    return {
        "target": "cost_overrun_risk",
        "model_type": "XGBClassifier",
        "method": "tree_shap",
        "base_value": _safe_float(base_val),
        "scale": "log_odds_margin",
        "top_drivers": top_drivers,
        "all_drivers": all_drivers,
        "note": (
            "TreeSHAP attributions are computed in raw margin (log-odds) space via XGBoost native pred_contribs. "
            "A positive SHAP value increases the margin towards high cost-overrun likelihood."
        ),
    }


def explain_risks(
    input_features: dict,
    delay_model=None,
    cost_model=None,
    top_n: int = 5,
) -> dict:
    """
    Generates model-based feature explanations for both delay_risk and cost_overrun_risk.
    Returns structured explanation dictionaries.
    """
    if not isinstance(input_features, dict):
        raise TypeError(f"input_features must be a dict, got {type(input_features).__name__}")

    missing = [c for c in FEATURE_COLUMNS if c not in input_features or input_features[c] is None]
    if missing:
        raise ValueError(f"Missing required features for explanation: {sorted(missing)}")

    row = pd.DataFrame([{name: float(input_features[name]) for name in FEATURE_COLUMNS}], columns=FEATURE_COLUMNS)

    if delay_model is None:
        delay_path = MODEL_DIR / "delay_risk_best.joblib"
        if not delay_path.exists():
            raise FileNotFoundError(f"Delay model artifact not found: {delay_path.name}")
        delay_model = joblib.load(delay_path)

    if cost_model is None:
        cost_path = MODEL_DIR / "cost_overrun_risk_best.joblib"
        if not cost_path.exists():
            raise FileNotFoundError(f"Cost overrun model artifact not found: {cost_path.name}")
        cost_model = joblib.load(cost_path)

    delay_explanation = explain_logistic_regression(delay_model, row, top_n=top_n)
    cost_explanation = explain_xgboost(cost_model, row, top_n=top_n)

    return {
        "delay_risk": delay_explanation,
        "cost_overrun_risk": cost_explanation,
        "warning": "Prototype explanations derived from synthetic training models; not validated real-world causal findings.",
    }
