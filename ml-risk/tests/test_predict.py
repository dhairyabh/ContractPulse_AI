import json
import math
import subprocess
import sys
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from predict import predict_risks
from train_models import FEATURE_COLUMNS

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


def test_predict_risks_successful():
    res = predict_risks(VALID_INPUT)
    assert isinstance(res, dict)
    assert "delay_risk" in res
    assert "cost_overrun_risk" in res
    assert 0.0 <= res["delay_risk"] <= 100.0
    assert 0.0 <= res["cost_overrun_risk"] <= 100.0
    assert res["data_origin"] == "synthetic-development-model"
    assert "Prototype prediction" in res["warning"]


def test_predict_risks_missing_features():
    incomplete = {k: v for k, v in VALID_INPUT.items() if k != "payment_progress_ratio"}
    with pytest.raises(ValueError, match="Missing required features.*payment_progress_ratio"):
        predict_risks(incomplete)


def test_predict_risks_none_feature():
    with_none = dict(VALID_INPUT)
    with_none["cost_variance_pct"] = None
    with pytest.raises(ValueError, match="Missing required features.*cost_variance_pct"):
        predict_risks(with_none)


def test_predict_risks_nan_feature():
    with_nan = dict(VALID_INPUT)
    with_nan["milestone_delay_days"] = float("nan")
    with pytest.raises(ValueError, match="must be a finite number"):
        predict_risks(with_nan)


def test_predict_risks_infinity_feature():
    with_pos_inf = dict(VALID_INPUT)
    with_pos_inf["budget_crores"] = float("inf")
    with pytest.raises(ValueError, match="must be a finite number"):
        predict_risks(with_pos_inf)

    with_neg_inf = dict(VALID_INPUT)
    with_neg_inf["progress_variance"] = float("-inf")
    with pytest.raises(ValueError, match="must be a finite number"):
        predict_risks(with_neg_inf)


def test_predict_risks_domain_constraints():
    bad_budget = dict(VALID_INPUT)
    bad_budget["budget_crores"] = 0
    with pytest.raises(ValueError, match="budget_crores.*greater than 0"):
        predict_risks(bad_budget)

    bad_duration = dict(VALID_INPUT)
    bad_duration["planned_duration_days"] = -5
    with pytest.raises(ValueError, match="planned_duration_days.*greater than 0"):
        predict_risks(bad_duration)

    bad_inspection_high = dict(VALID_INPUT)
    bad_inspection_high["inspection_failure_rate"] = 1.2
    with pytest.raises(ValueError, match="inspection_failure_rate.*between 0.0 and 1.0"):
        predict_risks(bad_inspection_high)

    bad_inspection_low = dict(VALID_INPUT)
    bad_inspection_low["inspection_failure_rate"] = -0.1
    with pytest.raises(ValueError, match="inspection_failure_rate.*between 0.0 and 1.0"):
        predict_risks(bad_inspection_low)

    bad_payment = dict(VALID_INPUT)
    bad_payment["payment_progress_ratio"] = -1.0
    with pytest.raises(ValueError, match="payment_progress_ratio.*non-negative"):
        predict_risks(bad_payment)

    bad_history = dict(VALID_INPUT)
    bad_history["contractor_delay_history"] = -1
    with pytest.raises(ValueError, match="contractor_delay_history.*non-negative"):
        predict_risks(bad_history)


def test_predict_risks_accepts_valid_negative_and_zero_values():
    under_budget_on_time = dict(VALID_INPUT)
    under_budget_on_time["progress_variance"] = -15.0
    under_budget_on_time["cost_variance_pct"] = -10.5
    under_budget_on_time["milestone_delay_days"] = 0
    under_budget_on_time["schedule_variance"] = 0.0
    under_budget_on_time["contractor_delay_history"] = 0
    under_budget_on_time["inspection_failure_rate"] = 0.0
    under_budget_on_time["change_order_frequency"] = 0.0

    res = predict_risks(under_budget_on_time)
    assert 0.0 <= res["delay_risk"] <= 100.0
    assert 0.0 <= res["cost_overrun_risk"] <= 100.0


def test_predict_risks_non_numeric_feature():
    with_str = dict(VALID_INPUT)
    with_str["contractor_delay_history"] = "one"
    with pytest.raises(ValueError, match="must be a valid number"):
        predict_risks(with_str)

    with_bool = dict(VALID_INPUT)
    with_bool["inspection_failure_rate"] = True
    with pytest.raises(ValueError, match="must be a valid number"):
        predict_risks(with_bool)


def test_predict_risks_invalid_type():
    with pytest.raises(TypeError, match="must be a dict"):
        predict_risks("not a dict")


def test_predict_risks_respects_feature_ordering():
    reversed_keys = {k: VALID_INPUT[k] for k in reversed(list(VALID_INPUT.keys()))}
    res_normal = predict_risks(VALID_INPUT)
    res_reversed = predict_risks(reversed_keys)
    assert res_normal["delay_risk"] == res_reversed["delay_risk"]
    assert res_normal["cost_overrun_risk"] == res_reversed["cost_overrun_risk"]


def test_cli_predict_success():
    script_path = ROOT / "predict.py"
    proc = subprocess.run(
        [sys.executable, str(script_path)],
        input=json.dumps(VALID_INPUT),
        capture_output=True,
        text=True,
        cwd=ROOT.parent,
    )
    assert proc.returncode == 0, f"Process failed: {proc.stderr}"
    output = json.loads(proc.stdout)
    assert "delay_risk" in output
    assert "cost_overrun_risk" in output
    assert output["data_origin"] == "synthetic-development-model"


def test_cli_predict_missing_feature():
    script_path = ROOT / "predict.py"
    incomplete = {k: v for k, v in VALID_INPUT.items() if k != "budget_crores"}
    proc = subprocess.run(
        [sys.executable, str(script_path)],
        input=json.dumps(incomplete),
        capture_output=True,
        text=True,
        cwd=ROOT.parent,
    )
    assert proc.returncode != 0
    err = json.loads(proc.stderr)
    assert "error" in err
    assert "budget_crores" in err["error"]


def test_cli_predict_malformed_json():
    script_path = ROOT / "predict.py"
    proc = subprocess.run(
        [sys.executable, str(script_path)],
        input="NOT_VALID_JSON{",
        capture_output=True,
        text=True,
        cwd=ROOT.parent,
    )
    assert proc.returncode != 0
    err = json.loads(proc.stderr)
    assert "error" in err


def test_cli_predict_empty_input():
    script_path = ROOT / "predict.py"
    proc = subprocess.run(
        [sys.executable, str(script_path)],
        input="",
        capture_output=True,
        text=True,
        cwd=ROOT.parent,
    )
    assert proc.returncode != 0
    err = json.loads(proc.stderr)
    assert "error" in err
