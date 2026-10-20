import json
import hashlib
import sys
from pathlib import Path
import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import train_models
from generate_dataset import generate_dataset
from train_models import (
    CLASSIFICATION_THRESHOLD,
    FEATURE_COLUMNS,
    TARGETS,
    evaluate,
    evaluate_cross_validation,
    make_models,
    train,
)

DEPLOYED_HASHES = {
    "delay_risk_best.joblib": "999BBB3EDE5423A6B3EA169B36667D1C749F73E291E37C2106CD00CF255A6226",
    "cost_overrun_risk_best.joblib": "FA735BF25B3B03BA133543BB828BA00A710F42860B2A2A3DE576C42786E2E4D3",
}


def compute_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest().upper()


def test_confusion_matrix_counts_and_sum():
    y_true = np.array([0, 0, 0, 1, 1, 1, 1, 0, 1, 0])
    probs = np.array([0.1, 0.4, 0.6, 0.8, 0.2, 0.7, 0.9, 0.3, 0.55, 0.45])
    # threshold 0.5:
    # y=0: probs [0.1(0), 0.4(0), 0.6(1), 0.3(0), 0.45(0)] -> tn=4, fp=1
    # y=1: probs [0.8(1), 0.2(0), 0.7(1), 0.9(1), 0.55(1)] -> tp=4, fn=1
    metrics = evaluate(y_true, probs, threshold=0.5)
    cm = metrics["confusion_matrix"]

    assert cm["threshold"] == 0.5
    assert cm["tn"] == 4
    assert cm["fp"] == 1
    assert cm["fn"] == 1
    assert cm["tp"] == 4
    assert cm["total"] == 10
    assert cm["tn"] + cm["fp"] + cm["fn"] + cm["tp"] == len(y_true)


def test_pr_auc_and_average_precision_valid():
    y_true = np.array([0, 0, 1, 1, 0, 1])
    probs = np.array([0.1, 0.2, 0.8, 0.9, 0.3, 0.7])
    metrics = evaluate(y_true, probs)

    assert metrics["pr_auc"] is not None
    assert metrics["average_precision"] is not None
    assert 0.0 <= metrics["pr_auc"] <= 1.0
    assert metrics["pr_auc"] == metrics["average_precision"]


def test_pr_auc_single_class_handled_safely():
    single_class_y = np.array([1, 1, 1, 1])
    probs = np.array([0.8, 0.9, 0.7, 0.85])
    metrics = evaluate(single_class_y, probs)

    assert metrics["roc_auc"] is None
    assert metrics["pr_auc"] is None
    assert metrics["average_precision"] is None
    assert metrics["confusion_matrix"]["total"] == 4


def test_cross_validation_returns_five_folds_with_mean_and_std():
    dataset = generate_dataset(400, seed=10)
    y = dataset["delay_risk"].astype(int)
    from generate_dataset import engineer_features
    features = engineer_features(dataset)[FEATURE_COLUMNS]

    cv_res = evaluate_cross_validation("logistic_regression", features, y, seed=10, n_splits=5)
    assert cv_res["n_splits"] == 5
    assert cv_res["completed_folds"] == 5
    assert cv_res["failed_folds"] == 0
    assert len(cv_res["fold_errors"]) == 0

    for metric_name in ("f1", "roc_auc", "average_precision", "pr_auc"):
        stat = cv_res[metric_name]
        assert stat["mean"] is not None
        assert stat["std"] is not None
        assert len(stat["values"]) == 5
        assert 0.0 <= stat["mean"] <= 1.0
        assert stat["std"] >= 0.0


def test_cross_validation_single_class_or_insufficient_samples_handled_safely():
    # Only single class in y
    x = pd.DataFrame(np.ones((20, len(FEATURE_COLUMNS))), columns=FEATURE_COLUMNS)
    y_single = pd.Series([1] * 20)

    cv_res = evaluate_cross_validation("logistic_regression", x, y_single, seed=10, n_splits=5)
    assert cv_res["completed_folds"] == 0
    assert cv_res["failed_folds"] == 5
    assert len(cv_res["fold_errors"]) > 0
    assert cv_res["f1"]["mean"] is None
    assert cv_res["roc_auc"]["mean"] is None
    assert cv_res["average_precision"]["mean"] is None


def test_candidate_artifacts_distinct_and_do_not_overlap(tmp_path, monkeypatch):
    test_model_dir = tmp_path / "models"
    test_report_dir = tmp_path / "reports"
    test_candidate_dir = test_model_dir / "candidates"

    monkeypatch.setattr(train_models, "MODEL_DIR", test_model_dir)
    monkeypatch.setattr(train_models, "CANDIDATE_MODEL_DIR", test_candidate_dir)
    monkeypatch.setattr(train_models, "REPORT_DIR", test_report_dir)

    dataset = generate_dataset(400, seed=15)
    result = train(dataset, seed=15, overwrite_deployed=True)

    expected_candidates = {
        "delay_risk_logistic_regression.joblib",
        "delay_risk_random_forest.joblib",
        "delay_risk_xgboost.joblib",
        "cost_overrun_risk_logistic_regression.joblib",
        "cost_overrun_risk_random_forest.joblib",
        "cost_overrun_risk_xgboost.joblib",
    }
    actual_candidates = {p.name for p in test_candidate_dir.glob("*.joblib")}
    assert expected_candidates == actual_candidates

    deployed_names = {p.name for p in test_model_dir.glob("*_best.joblib")}
    assert deployed_names == {"delay_risk_best.joblib", "cost_overrun_risk_best.joblib"}

    # Distinct paths:
    for candidate in test_candidate_dir.glob("*.joblib"):
        assert candidate.name not in deployed_names
        assert candidate.parent == test_candidate_dir


def test_comparison_json_schema_and_serialization(tmp_path, monkeypatch):
    test_model_dir = tmp_path / "models"
    test_report_dir = tmp_path / "reports"
    monkeypatch.setattr(train_models, "MODEL_DIR", test_model_dir)
    monkeypatch.setattr(train_models, "CANDIDATE_MODEL_DIR", test_model_dir / "candidates")
    monkeypatch.setattr(train_models, "REPORT_DIR", test_report_dir)

    dataset = generate_dataset(400, seed=20)
    result = train(dataset, seed=20)

    report_path = test_report_dir / "model_comparison.json"
    assert report_path.exists()
    loaded = json.loads(report_path.read_text(encoding="utf-8"))

    assert loaded["dataset_rows"] == 400
    assert "classification_threshold" in loaded
    for target in TARGETS:
        target_info = loaded["targets"][target]
        assert target_info["train_rows"] == 320
        assert target_info["test_rows"] == 80
        assert target_info["data_split"]["leakage_prevention"] is not None
        assert "cross_validation_summary" in target_info
        assert set(target_info["comparison"].keys()) == {"logistic_regression", "random_forest", "xgboost"}

        for model_name, metrics in target_info["comparison"].items():
            assert "confusion_matrix" in metrics
            cm = metrics["confusion_matrix"]
            assert cm["tn"] + cm["fp"] + cm["fn"] + cm["tp"] == 80
            assert "average_precision" in metrics
            assert "pr_auc" in metrics
            assert "cross_validation" in metrics
            cv = metrics["cross_validation"]
            assert cv["n_splits"] == 5
            assert cv["completed_folds"] == 5
            assert cv["f1"]["mean"] is not None


def test_deployed_models_hashes_strictly_preserved():
    for filename, expected_hash in DEPLOYED_HASHES.items():
        path = ROOT / "models" / filename
        assert path.exists(), f"Missing deployed model: {filename}"
        current_hash = compute_sha256(path)
        assert current_hash == expected_hash, f"Hash mismatch for {filename}: expected {expected_hash}, got {current_hash}"
