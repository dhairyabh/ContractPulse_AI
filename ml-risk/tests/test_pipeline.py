import sys
from pathlib import Path

import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from generate_dataset import engineer_features, generate_dataset
from train_models import FEATURE_COLUMNS, TARGETS, train


def test_generator_is_reproducible_and_marked_synthetic():
    first = generate_dataset(400, 11)
    second = generate_dataset(400, 11)
    pd.testing.assert_frame_equal(first, second)
    assert set(first["data_origin"]) == {"synthetic"}
    assert len(first) == 400


def test_generator_rejects_too_small_dataset():
    with pytest.raises(ValueError):
        generate_dataset(100)


def test_feature_engineering_has_expected_columns_and_finite_values():
    dataset = generate_dataset(400, 12)
    features = engineer_features(dataset)
    assert set(FEATURE_COLUMNS).issubset(features.columns)
    assert features[FEATURE_COLUMNS].notna().all().all()


def test_targets_are_binary_and_have_both_classes():
    dataset = generate_dataset(1000, 42)
    for target in TARGETS:
        assert set(dataset[target].unique()).issubset({0, 1})
        assert dataset[target].nunique() == 2


def test_training_compares_three_models_and_writes_artifacts(tmp_path, monkeypatch):
    import train_models
    monkeypatch.setattr(train_models, "MODEL_DIR", tmp_path / "models")
    monkeypatch.setattr(train_models, "REPORT_DIR", tmp_path / "reports")
    result = train(generate_dataset(500, 13), seed=13)
    for target in TARGETS:
        assert set(result["targets"][target]["comparison"]) == {"logistic_regression", "random_forest", "xgboost"}
        assert result["targets"][target]["selected_model"] in result["targets"][target]["comparison"]
        for metrics in result["targets"][target]["comparison"].values():
            assert 0 <= metrics["accuracy"] <= 1
            assert 0 <= metrics["f1"] <= 1
    assert (tmp_path / "reports" / "model_comparison.json").exists()
