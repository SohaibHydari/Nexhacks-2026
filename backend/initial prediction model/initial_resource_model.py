import argparse
import csv
import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple

try:
    import numpy as np
except ImportError as exc:  # pragma: no cover - environment-specific
    raise SystemExit(
        "numpy is required to train or run this model. Please install it with `pip install numpy`."
    ) from exc

NUMERIC_FEATURES = [
    "severity_1_5",
    "duration_hours",
    "population_affected_est",
    "injuries_est",
    "fatalities_est",
    "structures_threatened",
    "structures_damaged",
    "acres_burned",
    "wind_mph",
    "precip_inches",
    "temperature_f",
    "evacuation_order_issued",
    "evac_population_est",
    "hospital_diversion_flag",
    "start_hour",
    "start_month",
]

CATEGORICAL_FEATURES = [
    "incident_category",
    "incident_subtype",
    "city",
    "state",
]

TARGET_FIELDS = [
    "firetrucks_dispatched_engines",
    "ambulances_dispatched",
]


@dataclass
class ResourceModel:
    feature_order: List[str]
    categorical_levels: Dict[str, List[str]]
    coef: List[List[float]]
    intercept: List[float]

    def predict(self, incident: Dict[str, Any]) -> Dict[str, float]:
        vector = vectorize_incident(incident, self.feature_order, self.categorical_levels)
        predictions = np.dot(vector, np.array(self.coef).T) + np.array(self.intercept)
        return {
            "firetrucks_dispatched_engines": float(max(predictions[0], 0.0)),
            "ambulances_dispatched": float(max(predictions[1], 0.0)),
        }

    def to_dict(self) -> Dict[str, Any]:
        return {
            "version": 1,
            "feature_order": self.feature_order,
            "categorical_levels": self.categorical_levels,
            "coef": self.coef,
            "intercept": self.intercept,
        }

    @staticmethod
    def from_dict(payload: Dict[str, Any]) -> "ResourceModel":
        return ResourceModel(
            feature_order=payload["feature_order"],
            categorical_levels=payload["categorical_levels"],
            coef=payload["coef"],
            intercept=payload["intercept"],
        )


def parse_float(value: Any) -> float:
    if value in (None, ""):
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def parse_bool(value: Any) -> float:
    if value in (True, False):
        return 1.0 if value else 0.0
    if value is None:
        return 0.0
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "y"}:
        return 1.0
    if text in {"0", "false", "no", "n"}:
        return 0.0
    return 0.0


def parse_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    text = str(value).replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def derive_time_features(row: Dict[str, Any]) -> Tuple[float, float]:
    start = parse_datetime(row.get("start_time"))
    if not start:
        return 0.0, 0.0
    return float(start.hour), float(start.month)


def collect_categorical_levels(rows: List[Dict[str, Any]]) -> Dict[str, List[str]]:
    levels: Dict[str, set] = {feature: set() for feature in CATEGORICAL_FEATURES}
    for row in rows:
        for feature in CATEGORICAL_FEATURES:
            value = str(row.get(feature, "")).strip()
            if value:
                levels[feature].add(value)
    return {feature: sorted(values) for feature, values in levels.items()}


def build_feature_order(categorical_levels: Dict[str, List[str]]) -> List[str]:
    order = list(NUMERIC_FEATURES)
    for feature in CATEGORICAL_FEATURES:
        for level in categorical_levels.get(feature, []):
            order.append(f"{feature}__{level}")
    return order


def vectorize_incident(
    incident: Dict[str, Any],
    feature_order: List[str],
    categorical_levels: Dict[str, List[str]],
) -> np.ndarray:
    values: Dict[str, float] = {}
    for feature in NUMERIC_FEATURES:
        if feature in {"evacuation_order_issued", "hospital_diversion_flag"}:
            values[feature] = parse_bool(incident.get(feature))
        elif feature in {"start_hour", "start_month"}:
            hour, month = derive_time_features(incident)
            values["start_hour"] = hour
            values["start_month"] = month
        else:
            values[feature] = parse_float(incident.get(feature))

    for feature in CATEGORICAL_FEATURES:
        level = str(incident.get(feature, "")).strip()
        for option in categorical_levels.get(feature, []):
            values[f"{feature}__{option}"] = 1.0 if option == level else 0.0

    return np.array([values.get(name, 0.0) for name in feature_order], dtype=float)


def build_training_matrices(
    rows: List[Dict[str, Any]],
    feature_order: List[str],
    categorical_levels: Dict[str, List[str]],
) -> Tuple[np.ndarray, np.ndarray]:
    x_vectors = [
        vectorize_incident(row, feature_order, categorical_levels)
        for row in rows
    ]
    y_vectors = [
        [
            parse_float(row.get("firetrucks_dispatched_engines")),
            parse_float(row.get("ambulances_dispatched")),
        ]
        for row in rows
    ]
    return np.array(x_vectors, dtype=float), np.array(y_vectors, dtype=float)


def train_model(
    data_path: Path,
    ridge_lambda: float = 1.0,
) -> ResourceModel:
    with data_path.open(newline="") as handle:
        reader = csv.DictReader(handle)
        rows = list(reader)

    if not rows:
        raise ValueError("No training data found.")

    categorical_levels = collect_categorical_levels(rows)
    feature_order = build_feature_order(categorical_levels)
    x, y = build_training_matrices(rows, feature_order, categorical_levels)

    ones = np.ones((x.shape[0], 1), dtype=float)
    x_bias = np.hstack([ones, x])

    identity = np.eye(x_bias.shape[1], dtype=float)
    identity[0, 0] = 0.0

    xtx = x_bias.T @ x_bias
    inverse = np.linalg.inv(xtx + ridge_lambda * identity)
    weights = inverse @ x_bias.T @ y

    intercept = weights[0, :].tolist()
    coef = weights[1:, :].T.tolist()

    return ResourceModel(
        feature_order=feature_order,
        categorical_levels=categorical_levels,
        coef=coef,
        intercept=intercept,
    )


def save_model(model: ResourceModel, output_path: Path) -> None:
    output_path.write_text(json.dumps(model.to_dict(), indent=2))


def load_model(path: Path) -> ResourceModel:
    return ResourceModel.from_dict(json.loads(path.read_text()))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train or run the incident resource prediction model.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    train_parser = subparsers.add_parser("train", help="Train the model")
    train_parser.add_argument(
        "--data",
        type=Path,
        default=Path("backend/mock_incident_resource_usage.csv"),
        help="Path to the CSV training data.",
    )
    train_parser.add_argument(
        "--out",
        type=Path,
        default=Path("backend/resource_model.json"),
        help="Where to write the trained model.",
    )
    train_parser.add_argument(
        "--ridge",
        type=float,
        default=1.0,
        help="Ridge regularization strength.",
    )

    predict_parser = subparsers.add_parser("predict", help="Run a prediction")
    predict_parser.add_argument(
        "--model",
        type=Path,
        default=Path("backend/resource_model.json"),
        help="Path to a trained model file.",
    )
    predict_parser.add_argument(
        "--incident",
        type=str,
        help="Inline JSON string describing the incident.",
    )
    predict_parser.add_argument(
        "--incident-json",
        type=Path,
        help="Path to a JSON file describing the incident.",
    )

    return parser.parse_args()


def load_incident(args: argparse.Namespace) -> Dict[str, Any]:
    if args.incident_json:
        return json.loads(args.incident_json.read_text())
    if args.incident:
        return json.loads(args.incident)
    raise ValueError("Provide --incident or --incident-json to run a prediction.")


def main() -> None:
    args = parse_args()
    if args.command == "train":
        model = train_model(args.data, ridge_lambda=args.ridge)
        save_model(model, args.out)
        print(f"Model saved to {args.out}")
        return

    if args.command == "predict":
        model = load_model(args.model)
        incident = load_incident(args)
        prediction = model.predict(incident)
        print(json.dumps(prediction, indent=2))
        return


if __name__ == "__main__":
    main()
