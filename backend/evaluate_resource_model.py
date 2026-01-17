import argparse
import csv
import random
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.append(str(SCRIPT_DIR))

from initial_resource_model import (  # noqa: E402
    collect_categorical_levels,
    build_feature_order,
    build_training_matrices,
    train_model,
)


def load_rows(data_path: Path) -> List[Dict[str, Any]]:
    with data_path.open(newline="") as handle:
        return list(csv.DictReader(handle))


def split_rows(
    rows: List[Dict[str, Any]],
    train_ratio: float,
    seed: int,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    rng = random.Random(seed)
    shuffled = rows[:]
    rng.shuffle(shuffled)
    split_index = int(len(shuffled) * train_ratio)
    return shuffled[:split_index], shuffled[split_index:]


def evaluate(predictions: np.ndarray, actuals: np.ndarray) -> Dict[str, List[float]]:
    errors = predictions - actuals
    mae = np.mean(np.abs(errors), axis=0)
    rmse = np.sqrt(np.mean(errors**2, axis=0))
    return {
        "mae": mae.tolist(),
        "rmse": rmse.tolist(),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Evaluate the incident resource prediction model.",
    )
    parser.add_argument(
        "--data",
        type=Path,
        default=Path("backend/mock_incident_resource_usage.csv"),
        help="Path to the CSV training data.",
    )
    parser.add_argument(
        "--train-ratio",
        type=float,
        default=0.8,
        help="Percent of data to use for training.",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for the train/test split.",
    )
    parser.add_argument(
        "--ridge",
        type=float,
        default=1.0,
        help="Ridge regularization strength.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    rows = load_rows(args.data)
    if not rows:
        raise SystemExit("No training data found.")

    train_rows, test_rows = split_rows(rows, args.train_ratio, args.seed)
    if not test_rows:
        raise SystemExit("Test split is empty. Adjust --train-ratio or data volume.")

    categorical_levels = collect_categorical_levels(train_rows)
    feature_order = build_feature_order(categorical_levels)

    model = train_model(args.data, ridge_lambda=args.ridge)

    _, y_test = build_training_matrices(test_rows, feature_order, categorical_levels)
    predictions = np.array(
        [
            [
                model.predict(row)["firetrucks_dispatched_engines"],
                model.predict(row)["ambulances_dispatched"],
            ]
            for row in test_rows
        ],
        dtype=float,
    )

    metrics = evaluate(predictions, y_test)
    print("MAE (firetrucks, ambulances):", metrics["mae"])
    print("RMSE (firetrucks, ambulances):", metrics["rmse"])


if __name__ == "__main__":
    main()
