import json
import math
import subprocess
import sys
from pathlib import Path
import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import joblib
from explain import (
    FEATURE_DISPLAY_NAMES,
    explain_logistic_regression,
    explain_risks,
    explain_xgboost,
)
from predict import predict_risks
from train_models import FEATURE_COLUMNS, MODEL_DIR

VALID_INPUT = {
    "progress_variance": -8.0,
    "schedule_variance": 4.26,
    "payment_progress_ratio": 1.05,
    "milestone_delay_days": 23,
    "change_order_frequency": 1.2,
    "inspection_failure_rate": 0.1,
    "contractor_delay_history": 1,
    "cost_variance_pct": 4.5,
    "planned_duration_days": 540,
    "budget_crores": 18.46,
}


def test_explain_risks_returns_valid_schema():
    res = explain_risks(VALID_INPUT)
    assert isinstance(res, dict)
    assert "delay_risk" in res
    assert "cost_overrun_risk" in res
    assert "warning" in res

    for target in ("delay_risk", "cost_overrun_risk"):
        exp = res[target]
        assert exp["target"] == target
        assert isinstance(exp["model_type"], str)
        assert isinstance(exp["method"], str)
        assert isinstance(exp["base_value"], float)
        assert isinstance(exp["scale"], str)
        assert isinstance(exp["top_drivers"], list)
        assert isinstance(exp["all_drivers"], list)
        assert len(exp["top_drivers"]) <= 5
        assert len(exp["all_drivers"]) == len(FEATURE_COLUMNS)
        assert isinstance(exp["note"], str)

        for driver in exp["all_drivers"]:
            assert driver["feature"] in FEATURE_COLUMNS
            assert driver["feature_name"] == FEATURE_DISPLAY_NAMES[driver["feature"]]
            assert isinstance(driver["input_value"], float)
            assert isinstance(driver["contribution"], float)
            assert driver["scale"] == exp["scale"]
            assert driver["direction"] in ("increases_risk", "decreases_risk", "neutral")
            assert 0.0 <= driver["display_magnitude"] <= 100.0


def test_logistic_regression_attribution_correctness():
    delay_model = joblib.load(MODEL_DIR / "delay_risk_best.joblib")
    row = pd.DataFrame([{c: float(VALID_INPUT[c]) for c in FEATURE_COLUMNS}], columns=FEATURE_COLUMNS)
    exp = explain_logistic_regression(delay_model, row)

    assert exp["model_type"] == "LogisticRegression"
    assert exp["method"] == "linear_model_coefficients"
    assert exp["scale"] == "log_odds"

    # Verify mathematical consistency
    imputer = delay_model.named_steps["imputer"]
    scaler = delay_model.named_steps["scaler"]
    clf = delay_model.named_steps["model"]

    x_scaled = scaler.transform(imputer.transform(row))[0]
    expected_contributions = clf.coef_[0] * x_scaled

    for idx, driver in enumerate(exp["all_drivers"]):
        feat_name = driver["feature"]
        feat_idx = FEATURE_COLUMNS.index(feat_name)
        assert pytest.approx(driver["contribution"], abs=1e-5) == expected_contributions[feat_idx]


def test_xgboost_attribution_correctness():
    cost_model = joblib.load(MODEL_DIR / "cost_overrun_risk_best.joblib")
    row = pd.DataFrame([{c: float(VALID_INPUT[c]) for c in FEATURE_COLUMNS}], columns=FEATURE_COLUMNS)
    exp = explain_xgboost(cost_model, row)

    assert exp["model_type"] == "XGBClassifier"
    assert exp["method"] == "tree_shap"
    assert exp["scale"] == "log_odds_margin"

    # Verify margin sum matches model output
    total_margin = exp["base_value"] + sum(d["contribution"] for d in exp["all_drivers"])
    sigmoid_prob = 1.0 / (1.0 + np.exp(-total_margin))
    actual_prob = cost_model.predict_proba(row)[0, 1]
    assert pytest.approx(sigmoid_prob, abs=1e-5) == actual_prob


def test_contribution_rankings_ordered_by_absolute_magnitude():
    res = explain_risks(VALID_INPUT)
    for target in ("delay_risk", "cost_overrun_risk"):
        top_drivers = res[target]["top_drivers"]
        magnitudes = [abs(d["contribution"]) for d in top_drivers]
        assert magnitudes == sorted(magnitudes, reverse=True)


def test_direction_labels_match_contribution_signs():
    res = explain_risks(VALID_INPUT)
    for target in ("delay_risk", "cost_overrun_risk"):
        for driver in res[target]["all_drivers"]:
            c = driver["contribution"]
            direction = driver["direction"]
            if c > 1e-5:
                assert direction == "increases_risk"
            elif c < -1e-5:
                assert direction == "decreases_risk"
            else:
                assert direction == "neutral"


def test_no_nan_or_infinity_in_explanations():
    res = explain_risks(VALID_INPUT)
    raw_json = json.dumps(res)
    assert "NaN" not in raw_json
    assert "Infinity" not in raw_json
    assert "-Infinity" not in raw_json


def test_missing_or_invalid_input_fails_safely():
    incomplete = {k: v for k, v in VALID_INPUT.items() if k != "budget_crores"}
    with pytest.raises(ValueError, match="Missing required features"):
        explain_risks(incomplete)

    with pytest.raises(TypeError):
        explain_risks("not a dict")


def test_predict_risks_includes_explanations_by_default():
    res = predict_risks(VALID_INPUT)
    assert "explanations" in res
    assert "delay_risk" in res["explanations"]
    assert "cost_overrun_risk" in res["explanations"]


def test_predict_risks_supports_disabling_explanations():
    res = predict_risks(VALID_INPUT, include_explanations=False)
    assert "delay_risk" in res
    assert "cost_overrun_risk" in res
    assert "explanations" not in res


def test_cli_supports_no_explain_flag():
    script_path = ROOT / "predict.py"
    proc = subprocess.run(
        [sys.executable, str(script_path), "--no-explain"],
        input=json.dumps(VALID_INPUT),
        capture_output=True,
        text=True,
        cwd=ROOT.parent,
    )
    assert proc.returncode == 0
    data = json.loads(proc.stdout)
    assert "delay_risk" in data
    assert "explanations" not in data


def test_cli_outputs_explanations_by_default():
    script_path = ROOT / "predict.py"
    proc = subprocess.run(
        [sys.executable, str(script_path)],
        input=json.dumps(VALID_INPUT),
        capture_output=True,
        text=True,
        cwd=ROOT.parent,
    )
    assert proc.returncode == 0
    data = json.loads(proc.stdout)
    assert "delay_risk" in data
    assert "explanations" in data
    assert "delay_risk" in data["explanations"]
    assert "cost_overrun_risk" in data["explanations"]
