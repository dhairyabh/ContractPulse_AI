from pathlib import Path
import argparse
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
DEFAULT_OUTPUT = DATA_DIR / "synthetic_project_risk.csv"


def generate_dataset(rows: int = 2500, seed: int = 42) -> pd.DataFrame:
    if rows < 300:
        raise ValueError("rows must be at least 300 to support train/test evaluation")

    rng = np.random.default_rng(seed)
    budget_crores = rng.uniform(2, 500, rows).round(2)
    planned_duration_days = rng.integers(90, 1801, rows)
    planned_progress_pct = rng.uniform(5, 95, rows)
    progress_gap = rng.normal(-4, 13, rows)
    actual_progress_pct = np.clip(planned_progress_pct + progress_gap, 0, 100)
    payment_progress_ratio = np.clip(rng.normal(1.0, 0.23, rows), 0.35, 1.9)
    payments_pct = np.clip(actual_progress_pct * payment_progress_ratio, 0, 125)
    milestone_delay_days = np.maximum(0, rng.normal(8, 18, rows) + np.maximum(0, -progress_gap) * 0.7).round().astype(int)
    change_order_count = rng.poisson(2.0, rows)
    inspection_count = rng.integers(1, 20, rows)
    inspection_failure_count = np.array([rng.binomial(int(n), min(0.85, 0.04 + 0.025 * max(0, -g) + 0.018 * c)) for n, g, c in zip(inspection_count, progress_gap, change_order_count)])
    contractor_delay_history = np.clip(rng.normal(1.5, 1.3, rows), 0, 6).round(0).astype(int)
    planned_cost_to_date_crores = budget_crores * (planned_progress_pct / 100)
    cost_pressure = rng.normal(0, 0.07, rows) + 0.018 * change_order_count + 0.012 * (payments_pct > actual_progress_pct * 1.15)
    actual_cost_to_date_crores = np.maximum(0, planned_cost_to_date_crores * (1 + cost_pressure))

    raw = pd.DataFrame({
        "project_id": [f"SYN-{i:05d}" for i in range(1, rows + 1)],
        "data_origin": "synthetic",
        "budget_crores": budget_crores,
        "planned_duration_days": planned_duration_days,
        "planned_progress_pct": planned_progress_pct.round(2),
        "actual_progress_pct": actual_progress_pct.round(2),
        "payments_pct": payments_pct.round(2),
        "milestone_delay_days": milestone_delay_days,
        "change_order_count": change_order_count,
        "inspection_count": inspection_count,
        "inspection_failure_count": inspection_failure_count,
        "contractor_delay_history": contractor_delay_history,
        "planned_cost_to_date_crores": planned_cost_to_date_crores.round(3),
        "actual_cost_to_date_crores": actual_cost_to_date_crores.round(3),
    })

    features = engineer_features(raw)
    noise_delay = rng.normal(0, 0.75, rows)
    delay_signal = (
        0.095 * np.maximum(0, -features["progress_variance"])
        + 0.055 * features["milestone_delay_days"].clip(upper=90)
        + 1.15 * features["inspection_failure_rate"]
        + 0.42 * features["contractor_delay_history"]
        + 0.25 * features["change_order_frequency"]
        + 0.7 * np.maximum(0, features["payment_progress_ratio"] - 1.15)
        + noise_delay
    )
    delay_probability = 1 / (1 + np.exp(-(delay_signal - 2.9)))
    raw["delay_risk"] = rng.binomial(1, delay_probability)

    noise_cost = rng.normal(0, 0.65, rows)
    cost_signal = (
        4.0 * np.maximum(0, features["cost_variance_pct"])
        + 0.38 * features["change_order_frequency"]
        + 0.65 * np.maximum(0, features["payment_progress_ratio"] - 1.08)
        + 0.35 * features["inspection_failure_rate"]
        + 0.18 * features["contractor_delay_history"]
        + noise_cost
    )
    cost_probability = 1 / (1 + np.exp(-(cost_signal - 2.85)))
    raw["cost_overrun_risk"] = rng.binomial(1, cost_probability)
    return raw


def engineer_features(frame: pd.DataFrame) -> pd.DataFrame:
    required = {
        "planned_progress_pct", "actual_progress_pct", "payments_pct",
        "planned_duration_days", "milestone_delay_days", "change_order_count",
        "inspection_count", "inspection_failure_count", "contractor_delay_history",
        "planned_cost_to_date_crores", "actual_cost_to_date_crores",
    }
    missing = required - set(frame.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")

    result = pd.DataFrame(index=frame.index)
    result["progress_variance"] = frame["actual_progress_pct"] - frame["planned_progress_pct"]
    result["schedule_variance"] = frame["milestone_delay_days"] / frame["planned_duration_days"].clip(lower=1) * 100
    result["payment_progress_ratio"] = frame["payments_pct"] / frame["actual_progress_pct"].clip(lower=1)
    result["milestone_delay_days"] = frame["milestone_delay_days"]
    result["change_order_frequency"] = frame["change_order_count"] / (frame["planned_duration_days"] / 30).clip(lower=1)
    result["inspection_failure_rate"] = frame["inspection_failure_count"] / frame["inspection_count"].clip(lower=1)
    result["contractor_delay_history"] = frame["contractor_delay_history"]
    result["cost_variance_pct"] = (
        (frame["actual_cost_to_date_crores"] - frame["planned_cost_to_date_crores"])
        / frame["planned_cost_to_date_crores"].clip(lower=0.1) * 100
    )
    result["planned_duration_days"] = frame["planned_duration_days"]
    result["budget_crores"] = frame["budget_crores"] if "budget_crores" in frame else 0.0
    return result.replace([np.inf, -np.inf], np.nan).fillna(0.0)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate clearly labelled synthetic project-risk data.")
    parser.add_argument("--rows", type=int, default=2500)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    dataset = generate_dataset(args.rows, args.seed)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    dataset.to_csv(args.output, index=False)
    print(f"Saved {len(dataset)} synthetic rows to {args.output}")
    print("Target rates:")
    print(dataset[["delay_risk", "cost_overrun_risk"]].mean().round(3).to_string())
    print("NOTE: Synthetic labels are simulated for pipeline development, not real-world evidence.")


if __name__ == "__main__":
    main()
