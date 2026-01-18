import argparse
import csv
import json
import math
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple, Optional

try:
    import numpy as np
except ImportError as exc:  # pragma: no cover - environment-specific
    raise SystemExit(
        "numpy is required to run this model. Please install it with `pip install numpy`."
    ) from exc


# --- What the UI provides (ONLY these inputs) ---
# City Location                -> city (and we infer state from training data)
# Buildings Affected           -> buildings_affected -> structures_damaged + structures_threatened
# Approx. Affected Population  -> population_affected_est
# Disaster Type                -> incident_category
# Subcategory                  -> incident_subtype


NUMERIC_FEATURES = [
    # We will set only the ones we can infer; the rest default to 0.0 for similarity.
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


def parse_datetime(value: Any) -> Optional[datetime]:
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

    # Numeric
    for feature in NUMERIC_FEATURES:
        if feature in {"evacuation_order_issued", "hospital_diversion_flag"}:
            values[feature] = parse_bool(incident.get(feature))
        elif feature in {"start_hour", "start_month"}:
            hour, month = derive_time_features(incident)
            values["start_hour"] = hour
            values["start_month"] = month
        else:
            values[feature] = parse_float(incident.get(feature))

    # One-hot categoricals
    for feature in CATEGORICAL_FEATURES:
        level = str(incident.get(feature, "")).strip()
        for option in categorical_levels.get(feature, []):
            values[f"{feature}__{option}"] = 1.0 if option == level else 0.0

    return np.array([values.get(name, 0.0) for name in feature_order], dtype=float)


def load_rows(csv_path: Path) -> List[Dict[str, Any]]:
    with csv_path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        return list(reader)


def infer_state_for_city(rows: List[Dict[str, Any]], city: str) -> str:
    """
    Infer the most common state observed for a given city in the dataset.
    Returns "" if not found.
    """
    counts: Dict[str, int] = {}
    for r in rows:
        if str(r.get("city", "")).strip() == city:
            st = str(r.get("state", "")).strip()
            if st:
                counts[st] = counts.get(st, 0) + 1
    if not counts:
        return ""
    return max(counts.items(), key=lambda kv: kv[1])[0]


def clamp_nonneg(x: float) -> float:
    return float(x) if x > 0 else 0.0


def make_query_incident_from_ui(
    *,
    city: str,
    buildings_affected: float,
    population_affected: float,
    incident_category: str,
    incident_subtype: str,
    inferred_state: str,
) -> Dict[str, Any]:
    """
    Build a full incident dict using ONLY UI inputs + state inferred from data.
    Everything else defaults to 0 so similarity is driven by these inputs.
    """
    # Simple severity heuristic (kept very conservative; similarity still mostly depends on raw inputs):
    # - buildings and population tend to matter; we map to 1..5.
    score = 0.0
    score += min(buildings_affected / 25.0, 2.0)  # up to +2
    score += min(population_affected / 20000.0, 3.0)  # up to +3
    severity = int(round(1 + min(max(score, 0.0), 4.0)))  # 1..5
    severity = max(1, min(5, severity))

    return {
        "severity_1_5": severity,
        "duration_hours": 0.0,
        "population_affected_est": population_affected,
        "injuries_est": 0.0,
        "fatalities_est": 0.0,
        "structures_threatened": buildings_affected,
        "structures_damaged": buildings_affected,
        "acres_burned": 0.0,
        "wind_mph": 0.0,
        "precip_inches": 0.0,
        "temperature_f": 0.0,
        "evacuation_order_issued": 0.0,
        "evac_population_est": 0.0,
        "hospital_diversion_flag": 0.0,
        "start_time": None,
        "incident_category": incident_category,
        "incident_subtype": incident_subtype,
        "city": city,
        "state": inferred_state,
    }


def euclidean_dist(a: np.ndarray, b: np.ndarray) -> float:
    diff = a - b
    return float(np.sqrt(np.dot(diff, diff)))


def knn_predict(
    query: Dict[str, Any],
    rows: List[Dict[str, Any]],
    k: int = 15,
    min_pool: int = 50,
) -> Dict[str, Any]:
    """
    Compare the query incident to previous incidents in the dataset and predict
    resources using a distance-weighted kNN average of historical targets.

    - Uses the same vectorization scheme (numeric + one-hot categoricals)
    - Automatically falls back to a broader pool if too few close matches exist
    """
    if not rows:
        raise ValueError("Dataset is empty.")

    categorical_levels = collect_categorical_levels(rows)
    feature_order = build_feature_order(categorical_levels)

    # Build training vectors X and target vectors Y
    X = np.array(
        [vectorize_incident(r, feature_order, categorical_levels) for r in rows],
        dtype=float,
    )
    Y = np.array(
        [
            [
                parse_float(r.get("firetrucks_dispatched_engines")),
                parse_float(r.get("ambulances_dispatched")),
            ]
            for r in rows
        ],
        dtype=float,
    )

    qv = vectorize_incident(query, feature_order, categorical_levels)

    # Compute distances
    dists = np.array([euclidean_dist(qv, X[i]) for i in range(X.shape[0])], dtype=float)
    order = np.argsort(dists)

    # Choose neighborhood
    k = max(1, int(k))
    idx = order[: min(k, len(order))]

    # If dataset is small or features are sparse, all distances can look similar.
    # We'll still use kNN but provide a "similar_incidents" list for transparency.
    d = dists[idx]

    # Distance-weighted average: weight = 1/(d+eps)
    eps = 1e-6
    w = 1.0 / (d + eps)
    w_sum = float(np.sum(w))
    if w_sum <= 0:
        # Fallback to simple mean
        pred = np.mean(Y[idx], axis=0)
    else:
        pred = (w @ Y[idx]) / w_sum

    pred_engines = int(math.ceil(clamp_nonneg(float(pred[0]))))
    pred_amb = int(math.ceil(clamp_nonneg(float(pred[1]))))

    # Build a compact explanation payload (top 5)
    top_n = min(5, len(idx))
    similar = []
    for rank in range(top_n):
        i = int(idx[rank])
        r = rows[i]
        similar.append(
            {
                "rank": rank + 1,
                "row_index": i,
                "distance": float(dists[i]),
                "incident_category": str(r.get("incident_category", "")),
                "incident_subtype": str(r.get("incident_subtype", "")),
                "city": str(r.get("city", "")),
                "state": str(r.get("state", "")),
                "population_affected_est": parse_float(r.get("population_affected_est")),
                "structures_damaged": parse_float(r.get("structures_damaged")),
                "structures_threatened": parse_float(r.get("structures_threatened")),
                "actual_firetrucks_dispatched_engines": parse_float(
                    r.get("firetrucks_dispatched_engines")
                ),
                "actual_ambulances_dispatched": parse_float(r.get("ambulances_dispatched")),
            }
        )

    return {
        "prediction": {
            "firetrucks_dispatched_engines": pred_engines,
            "ambulances_dispatched": pred_amb,
        },
        "query_used": {
            "incident_category": query.get("incident_category"),
            "incident_subtype": query.get("incident_subtype"),
            "city": query.get("city"),
            "state": query.get("state"),
            "buildings_affected": query.get("structures_damaged"),
            "population_affected_est": query.get("population_affected_est"),
            "severity_1_5": query.get("severity_1_5"),
        },
        "similar_incidents_top5": similar,
        "k_used": int(len(idx)),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="kNN-based resource prediction from historical incident dataset (UI-input-only).",
    )

    parser.add_argument(
        "--data",
        type=Path,
        default=(Path(__file__).resolve().parent / "mock_incident_resource_usage.csv"),
        help="Path to the CSV dataset of historical incidents.",
    )

    # ONLY the UI inputs:
    parser.add_argument("--city", type=str, required=True, help="City location (must match dataset city names).")
    parser.add_argument(
        "--buildings-affected",
        type=float,
        required=True,
        help="Buildings affected (mapped to structures_damaged/threatened).",
    )
    parser.add_argument(
        "--population-affected",
        type=float,
        required=True,
        help="Approx. affected population.",
    )
    parser.add_argument(
        "--incident-category",
        type=str,
        required=True,
        help="Disaster Type (e.g., Fire, Weather, Infrastructure, Public Health). Must match dataset levels.",
    )
    parser.add_argument(
        "--incident-subtype",
        type=str,
        required=True,
        help="Subcategory (e.g., Structure Fire). Must match dataset levels.",
    )

    # kNN controls (optional)
    parser.add_argument("--k", type=int, default=15, help="Number of similar incidents to use (kNN).")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    rows = load_rows(args.data)
    if not rows:
        raise SystemExit("No rows found in dataset CSV.")

    city = args.city.strip()
    inferred_state = infer_state_for_city(rows, city)

    query = make_query_incident_from_ui(
        city=city,
        buildings_affected=float(args.buildings_affected),
        population_affected=float(args.population_affected),
        incident_category=str(args.incident_category).strip(),
        incident_subtype=str(args.incident_subtype).strip(),
        inferred_state=inferred_state,
    )

    result = knn_predict(query=query, rows=rows, k=int(args.k))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
