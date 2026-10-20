from pathlib import Path
import json
import sys
import warnings
import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier

from generate_dataset import DEFAULT_OUTPUT, engineer_features, generate_dataset

ROOT = Path(__file__).resolve().parent
MODEL_DIR = ROOT / "models"
CANDIDATE_MODEL_DIR = MODEL_DIR / "candidates"
REPORT_DIR = ROOT / "reports"
TARGETS = ["delay_risk", "cost_overrun_risk"]
FEATURE_COLUMNS = [
    "progress_variance", "schedule_variance", "payment_progress_ratio",
    "milestone_delay_days", "change_order_frequency", "inspection_failure_rate",
    "contractor_delay_history", "cost_variance_pct", "planned_duration_days", "budget_crores",
]
CLASSIFICATION_THRESHOLD = 0.5


def make_models(seed: int) -> dict:
    return {
        "logistic_regression": Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            ("model", LogisticRegression(max_iter=2000, class_weight="balanced", random_state=seed)),
        ]),
        "random_forest": Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("model", RandomForestClassifier(n_estimators=300, min_samples_leaf=3, class_weight="balanced", random_state=seed, n_jobs=-1)),
        ]),
        "xgboost": make_xgboost(seed),
    }


def make_xgboost(seed: int):
    try:
        from xgboost import XGBClassifier
    except ImportError as exc:
        raise RuntimeError("XGBoost is required. Install dependencies with: pip install -r requirements.txt") from exc
    return Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("model", XGBClassifier(
            n_estimators=250, max_depth=4, learning_rate=0.04,
            subsample=0.85, colsample_bytree=0.85, reg_lambda=1.5,
            eval_metric="logloss", random_state=seed, n_jobs=4,
        )),
    ])


def evaluate(y_true, probabilities, threshold: float = CLASSIFICATION_THRESHOLD) -> dict:
    predicted = (probabilities >= threshold).astype(int)
    cm = confusion_matrix(y_true, predicted, labels=[0, 1])
    tn, fp, fn, tp = int(cm[0, 0]), int(cm[0, 1]), int(cm[1, 0]), int(cm[1, 1])

    metrics = {
        "accuracy": float(accuracy_score(y_true, predicted)),
        "precision": float(precision_score(y_true, predicted, zero_division=0)),
        "recall": float(recall_score(y_true, predicted, zero_division=0)),
        "f1": float(f1_score(y_true, predicted, zero_division=0)),
        "brier_score": float(brier_score_loss(y_true, probabilities)),
        "confusion_matrix": {
            "threshold": float(threshold),
            "tn": tn,
            "fp": fp,
            "fn": fn,
            "tp": tp,
            "total": tn + fp + fn + tp,
        },
    }

    if len(np.unique(y_true)) == 2:
        try:
            metrics["roc_auc"] = float(roc_auc_score(y_true, probabilities))
        except Exception:
            metrics["roc_auc"] = None

        try:
            ap_score = float(average_precision_score(y_true, probabilities))
            metrics["average_precision"] = ap_score
            metrics["pr_auc"] = ap_score
        except Exception:
            metrics["average_precision"] = None
            metrics["pr_auc"] = None
    else:
        metrics["roc_auc"] = None
        metrics["average_precision"] = None
        metrics["pr_auc"] = None

    return metrics


def evaluate_cross_validation(
    model_name: str,
    x_train: pd.DataFrame,
    y_train: pd.Series,
    seed: int = 42,
    n_splits: int = 5,
    threshold: float = CLASSIFICATION_THRESHOLD,
) -> dict:
    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=seed)

    class_counts = y_train.value_counts()
    if len(class_counts) < 2 or class_counts.min() < n_splits:
        return {
            "strategy": f"StratifiedKFold(n_splits={n_splits}, shuffle=True, random_state={seed})",
            "n_splits": n_splits,
            "completed_folds": 0,
            "failed_folds": n_splits,
            "fold_errors": [
                f"Insufficient class counts for {n_splits}-fold CV: min class count is {class_counts.min() if len(class_counts) > 0 else 0}"
            ],
            "f1": {"mean": None, "std": None, "values": []},
            "roc_auc": {"mean": None, "std": None, "values": []},
            "average_precision": {"mean": None, "std": None, "values": []},
            "pr_auc": {"mean": None, "std": None, "values": []},
        }

    fold_metrics = []
    fold_errors = []

    for fold_idx, (train_idx, val_idx) in enumerate(skf.split(x_train, y_train), 1):
        fold_x_train = x_train.iloc[train_idx]
        fold_y_train = y_train.iloc[train_idx]
        fold_x_val = x_train.iloc[val_idx]
        fold_y_val = y_train.iloc[val_idx]

        if len(np.unique(fold_y_train)) < 2 or len(np.unique(fold_y_val)) < 2:
            fold_errors.append(f"Fold {fold_idx}: single-class partition detected.")
            continue

        try:
            fold_models = make_models(seed)
            fold_pipeline = fold_models[model_name]
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                fold_pipeline.fit(fold_x_train, fold_y_train)

            fold_probs = fold_pipeline.predict_proba(fold_x_val)[:, 1]
            fold_preds = (fold_probs >= threshold).astype(int)

            f1 = float(f1_score(fold_y_val, fold_preds, zero_division=0))
            roc_auc = float(roc_auc_score(fold_y_val, fold_probs))
            ap = float(average_precision_score(fold_y_val, fold_probs))

            fold_metrics.append({
                "fold": fold_idx,
                "f1": f1,
                "roc_auc": roc_auc,
                "average_precision": ap,
            })
        except Exception as exc:
            fold_errors.append(f"Fold {fold_idx} failed: {exc}")

    def calc_stats(values: list[float]) -> dict:
        if not values:
            return {"mean": None, "std": None, "values": []}
        mean_val = float(np.mean(values))
        std_val = float(np.std(values, ddof=1)) if len(values) > 1 else 0.0
        return {"mean": round(mean_val, 6), "std": round(std_val, 6), "values": [round(v, 6) for v in values]}

    f1_vals = [m["f1"] for m in fold_metrics]
    roc_auc_vals = [m["roc_auc"] for m in fold_metrics]
    ap_vals = [m["average_precision"] for m in fold_metrics]

    return {
        "strategy": f"StratifiedKFold(n_splits={n_splits}, shuffle=True, random_state={seed})",
        "n_splits": n_splits,
        "completed_folds": len(fold_metrics),
        "failed_folds": len(fold_errors),
        "fold_errors": fold_errors,
        "f1": calc_stats(f1_vals),
        "roc_auc": calc_stats(roc_auc_vals),
        "average_precision": calc_stats(ap_vals),
        "pr_auc": calc_stats(ap_vals),
    }


def train(dataset: pd.DataFrame, seed: int = 42, overwrite_deployed: bool = False) -> dict:
    required_raw = {
        "planned_progress_pct", "actual_progress_pct", "payments_pct",
        "planned_duration_days", "milestone_delay_days", "change_order_count",
        "inspection_count", "inspection_failure_count", "contractor_delay_history",
        "planned_cost_to_date_crores", "actual_cost_to_date_crores", "budget_crores",
    }
    missing = (set(TARGETS) | required_raw) - set(dataset.columns)
    if missing:
        raise ValueError(f"Dataset is missing columns: {sorted(missing)}")
    if dataset[TARGETS].isna().any().any():
        raise ValueError("Target labels contain missing values")
    if any(dataset[target].nunique() < 2 for target in TARGETS):
        raise ValueError("Each target must contain both classes")

    features = engineer_features(dataset)[FEATURE_COLUMNS].replace([np.inf, -np.inf], np.nan)
    results = {
        "dataset_origin": sorted(dataset["data_origin"].dropna().unique().tolist()) if "data_origin" in dataset else ["unknown"],
        "dataset_rows": int(len(dataset)),
        "seed": seed,
        "classification_threshold": CLASSIFICATION_THRESHOLD,
        "warning": "Metrics on synthetic data are pipeline checks only and do not establish real-world performance.",
        "targets": {},
    }

    target_model_dir = getattr(sys.modules.get(__name__), "MODEL_DIR", MODEL_DIR)
    target_candidate_dir = getattr(sys.modules.get(__name__), "CANDIDATE_MODEL_DIR", target_model_dir / "candidates")
    target_report_dir = getattr(sys.modules.get(__name__), "REPORT_DIR", REPORT_DIR)

    target_model_dir.mkdir(parents=True, exist_ok=True)
    target_candidate_dir.mkdir(parents=True, exist_ok=True)
    target_report_dir.mkdir(parents=True, exist_ok=True)

    for target in TARGETS:
        x_train, x_test, y_train, y_test = train_test_split(
            features, dataset[target].astype(int), test_size=0.2, random_state=seed, stratify=dataset[target]
        )
        model_results = {}
        trained_models = {}

        for model_name, model in make_models(seed).items():
            # 1. Stratified 5-Fold Cross-Validation on the training partition only (leakage prevention)
            cv_results = evaluate_cross_validation(
                model_name=model_name,
                x_train=x_train,
                y_train=y_train,
                seed=seed,
                n_splits=5,
                threshold=CLASSIFICATION_THRESHOLD,
            )

            # 2. Fit candidate model on the entire training partition
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                model.fit(x_train, y_train)

            # 3. Save candidate model artifact for auditability
            candidate_filename = f"{target}_{model_name}.joblib"
            candidate_path = target_candidate_dir / candidate_filename
            joblib.dump(model, candidate_path)

            # 4. Evaluate on held-out test split
            probabilities = model.predict_proba(x_test)[:, 1]
            eval_metrics = evaluate(y_test, probabilities, threshold=CLASSIFICATION_THRESHOLD)
            eval_metrics["algorithm"] = model_name
            eval_metrics["target"] = target
            eval_metrics["candidate_artifact"] = candidate_filename
            eval_metrics["cross_validation"] = cv_results

            model_results[model_name] = eval_metrics
            trained_models[model_name] = model

        # Preserve existing model-selection logic (highest f1 and roc_auc on held-out test split)
        best_name = max(model_results, key=lambda name: (model_results[name]["f1"], model_results[name]["roc_auc"] or 0))
        best_model = trained_models[best_name]

        model_path = target_model_dir / f"{target}_best.joblib"
        # Preserve deployed production model artifacts unless explicit overwrite requested or missing
        is_deployed_prod_file = (model_path.exists() and target_model_dir == MODEL_DIR)
        if overwrite_deployed or not is_deployed_prod_file:
            joblib.dump(best_model, model_path)
            deployed_status = "saved"
        else:
            deployed_status = "preserved_existing"

        results["targets"][target] = {
            "positive_rate": float(dataset[target].mean()),
            "train_rows": int(len(x_train)),
            "test_rows": int(len(y_test)),
            "data_split": {
                "strategy": "Stratified train_test_split",
                "train_fraction": 0.8,
                "test_fraction": 0.2,
                "random_state": seed,
                "leakage_prevention": "Cross-validation and feature scaling/imputation fitted strictly on training partition; test partition held out.",
            },
            "comparison": model_results,
            "cross_validation_summary": {
                name: {
                    "completed_folds": model_results[name]["cross_validation"]["completed_folds"],
                    "failed_folds": model_results[name]["cross_validation"]["failed_folds"],
                    "f1": model_results[name]["cross_validation"]["f1"],
                    "roc_auc": model_results[name]["cross_validation"]["roc_auc"],
                    "average_precision": model_results[name]["cross_validation"]["average_precision"],
                    "pr_auc": model_results[name]["cross_validation"]["pr_auc"],
                }
                for name in model_results
            },
            "selected_model": best_name,
            "model_selection_note": "Selected via held-out test split tuple (f1, roc_auc); documented methodological limitation.",
            "model_path": model_path.name,
            "deployed_artifact_status": deployed_status,
            "candidate_artifacts": {
                name: f"{target}_{name}.joblib"
                for name in trained_models
            },
            "feature_columns": FEATURE_COLUMNS,
        }

    report_path = target_report_dir / "model_comparison.json"
    report_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    return results


def main() -> None:
    if DEFAULT_OUTPUT.exists():
        dataset = pd.read_csv(DEFAULT_OUTPUT)
    else:
        dataset = generate_dataset()
        DEFAULT_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        dataset.to_csv(DEFAULT_OUTPUT, index=False)
        print(f"Generated synthetic dataset: {DEFAULT_OUTPUT}")
    results = train(dataset)
    print(json.dumps(results, indent=2))
    print("Synthetic evaluation only. Do not report these metrics as real-world model performance.")


if __name__ == "__main__":
    main()
