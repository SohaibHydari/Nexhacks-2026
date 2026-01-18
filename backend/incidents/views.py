import csv
import json
import math
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from django.http import JsonResponse, HttpResponseNotAllowed
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction
from django.utils import timezone
from functools import lru_cache
from pathlib import Path

from .models import Unit, ResourceRequest, RequestAssignment, LogEntry

# -----------------------
# Helpers
# -----------------------

def unit_to_dict(u: Unit):
    return {
        "id": u.id,
        "name": u.name,
        "unit_type": u.unit_type,
        "status": u.status,
    }

def request_to_dict(r: ResourceRequest):
    return {
        "id": r.id,
        "unit_type": r.unit_type,
        "quantity": r.quantity,
        "priority": r.priority,
        "location": r.location,
        "status": r.status,
        "created_at": r.created_at.isoformat() if hasattr(r, "created_at") and r.created_at else None,
        "updated_at": r.updated_at.isoformat() if hasattr(r, "updated_at") and r.updated_at else None,
        "assignments": [
            {"id": a.id, "unit_id": a.unit_id}
            for a in r.assignments.select_related("unit").all()
        ],
    }

def log_to_dict(le: LogEntry):
    return {
        "id": le.id,
        "created_at": le.created_at.isoformat(),
        "unit_id": le.unit_id,
        "from_status": le.from_status,
        "to_status": le.to_status,
    }

def change_unit_status(unit: Unit, new_status: str):
    """Single source of truth for status changes + log + DB save."""
    old = unit.status
    if old == new_status:
        return False

    now = timezone.now()
    unit.status = new_status

    # If your Unit model has these fields, update them safely
    update_fields = ["status"]

    if hasattr(unit, "last_status_at"):
        unit.last_status_at = now
        update_fields.append("last_status_at")

    # If your Unit model has auto_now updated_at, it only updates on save().
    # If you use update_fields, include it so it's updated in the DB.
    if hasattr(unit, "updated_at"):
        update_fields.append("updated_at")

    unit.save(update_fields=update_fields)

    LogEntry.objects.create(
        unit=unit,
        from_status=old,
        to_status=new_status,
    )
    return True



# -----------------------
# Endpoints
# -----------------------

def units_list(request):
    if request.method != "GET":
        return HttpResponseNotAllowed(["GET"])

    qs = Unit.objects.all().order_by("unit_type", "name")
    unit_type = request.GET.get("unit_type")
    status = request.GET.get("status")
    if unit_type:
        qs = qs.filter(unit_type=unit_type)
    if status:
        qs = qs.filter(status=status)

    return JsonResponse([unit_to_dict(u) for u in qs], safe=False)


@csrf_exempt
def unit_set_status(request, unit_id: int):
    if request.method != "PATCH":
        return HttpResponseNotAllowed(["PATCH"])

    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    new_status = payload.get("status")
    if not new_status:
        return JsonResponse({"error": "Missing 'status'"}, status=400)

    try:
        unit = Unit.objects.get(id=unit_id)
    except Unit.DoesNotExist:
        return JsonResponse({"error": "Unit not found"}, status=404)

    valid_statuses = {c[0] for c in Unit.Status.choices}
    if new_status not in valid_statuses:
        return JsonResponse({"error": f"Invalid status. Use one of: {sorted(valid_statuses)}"}, status=400)

    with transaction.atomic():
        change_unit_status(unit, new_status)

    # unit is now saved; returning is accurate
    return JsonResponse(unit_to_dict(unit))



def requests_list(request):
    if request.method != "GET":
        return HttpResponseNotAllowed(["GET"])

    qs = ResourceRequest.objects.all().order_by("-id")

    unit_type = request.GET.get("unit_type")
    status = request.GET.get("status")
    if unit_type:
        qs = qs.filter(unit_type=unit_type)
    if status:
        qs = qs.filter(status=status)

    return JsonResponse([request_to_dict(r) for r in qs], safe=False)


@csrf_exempt
def create_request(request):
    """IC creates a request: unit_type + quantity (+ priority/location optional)."""
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])

    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    unit_type = payload.get("unit_type")
    quantity = payload.get("quantity")

    if not unit_type or quantity is None:
        return JsonResponse({"error": "unit_type and quantity required"}, status=400)

    valid_types = {c[0] for c in Unit.UnitType.choices}
    if unit_type not in valid_types:
        return JsonResponse({"error": f"Invalid unit_type. Use one of: {sorted(valid_types)}"}, status=400)

    try:
        quantity = int(quantity)
        if quantity <= 0:
            raise ValueError()
    except ValueError:
        return JsonResponse({"error": "quantity must be a positive integer"}, status=400)

    r = ResourceRequest.objects.create(
        unit_type=unit_type,
        quantity=quantity,
        priority=payload.get("priority", "Medium"),
        location=payload.get("location", ""),
        status=ResourceRequest.RequestStatus.PENDING,
    )
    return JsonResponse(request_to_dict(r), status=201)


@csrf_exempt
def dispatch_request(request, request_id: int):
    """
    EMS responds:
    - creates RequestAssignment rows
    - updates units -> ENROUTE (and logs)
    - updates request status -> COMPLETED or PARTIAL
    """
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])

    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    unit_ids = payload.get("unit_ids", [])
    if not isinstance(unit_ids, list) or len(unit_ids) == 0:
        return JsonResponse({"error": "unit_ids must be a non-empty list"}, status=400)

    try:
        rr = ResourceRequest.objects.get(id=request_id)
    except ResourceRequest.DoesNotExist:
        return JsonResponse({"error": "Request not found"}, status=404)

    with transaction.atomic():
        # lock selected units so two clients don't double-dispatch same unit
        units = list(Unit.objects.select_for_update().filter(id__in=unit_ids))

        if len(units) != len(unit_ids):
            return JsonResponse({"error": "One or more unit_ids invalid"}, status=400)

        # Optional: ensure units match requested type
        for u in units:
            if u.unit_type != rr.unit_type:
                return JsonResponse({"error": f"Unit {u.id} type mismatch"}, status=400)

        # Optional: ensure only AVAILABLE can be dispatched
        for u in units:
            if u.status != Unit.Status.AVAILABLE:
                return JsonResponse({"error": f"Unit {u.id} not available"}, status=400)

        # create assignments
        for u in units:
            RequestAssignment.objects.get_or_create(request=rr, unit=u)

        # status change + logs
        for u in units:
            change_unit_status(u, Unit.Status.ENROUTE)

        assigned = rr.assignments.count()
        if assigned >= rr.quantity:
            rr.status = ResourceRequest.RequestStatus.COMPLETED
        else:
            rr.status = ResourceRequest.RequestStatus.PARTIAL

        rr.save()  # <- simplest & safest (auto_now updated_at will update)


    return JsonResponse(request_to_dict(rr))


def logs_list(request):
    if request.method != "GET":
        return HttpResponseNotAllowed(["GET"])

    qs = LogEntry.objects.select_related("unit").order_by("-created_at")
    unit_id = request.GET.get("unit_id")
    if unit_id:
        qs = qs.filter(unit_id=unit_id)

    limit = request.GET.get("limit")
    if limit:
        try:
            limit = int(limit)
            qs = qs[:limit]
        except ValueError:
            pass

    return JsonResponse([log_to_dict(le) for le in qs], safe=False)

# -----------------------
# Prediction data
# -----------------------

MODEL_ROWS_PATH = (
    Path(__file__).resolve().parent.parent
    / "initial_prediction_model"
    / "mock_incident_resource_usage.csv"
)


@lru_cache(maxsize=1)
def load_prediction_rows() -> List[Dict[str, Any]]:
    with MODEL_ROWS_PATH.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader)


def infer_state_for_city(rows: List[Dict[str, Any]], city: str) -> str:
    counts: Dict[str, int] = {}
    target = city.strip()
    for row in rows:
        if str(row.get("city", "")).strip() != target:
            continue
        state = str(row.get("state", "")).strip()
        if state:
            counts[state] = counts.get(state, 0) + 1
    if not counts:
        return ""
    return max(counts.items(), key=lambda pair: pair[1])[0]


@csrf_exempt
def initial_prediction(request):
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])

    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    incident = payload.get("incident", {})
    city = str(incident.get("city", "")).strip()
    buildings = parse_float(incident.get("structures_threatened"))
    if buildings == 0:
        buildings = parse_float(incident.get("structures_damaged"))
    population = parse_float(incident.get("population_affected_est"))
    category = str(incident.get("incident_category", "")).strip()
    subtype = str(incident.get("incident_subtype", "")).strip()

    rows = load_prediction_rows()
    if not rows:
        return JsonResponse({"error": "Prediction data unavailable"}, status=503)

    inferred_state = infer_state_for_city(rows, city)
    query = make_query_incident_from_ui(
        city=city,
        buildings_affected=buildings,
        population_affected=population,
        incident_category=category,
        incident_subtype=subtype,
        inferred_state=inferred_state,
    )

    try:
        k = int(payload.get("k", 15))
    except (TypeError, ValueError):
        k = 15

    prediction = knn_predict(query=query, rows=rows, k=k)
    return JsonResponse(prediction)

# -----------------------
# ML Logic
# -----------------------

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


def euclidean_dist(a: np.ndarray, b: np.ndarray) -> float:
    diff = a - b
    return float(np.sqrt(np.dot(diff, diff)))


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
    score = 0.0
    score += min(buildings_affected / 25.0, 2.0)
    score += min(population_affected / 20000.0, 3.0)
    severity = int(round(1 + min(max(score, 0.0), 4.0)))
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


def knn_predict(
    query: Dict[str, Any],
    rows: List[Dict[str, Any]],
    k: int = 15,
    min_pool: int = 50,
) -> Dict[str, Any]:
    if not rows:
        raise ValueError("Dataset is empty.")

    categorical_levels = collect_categorical_levels(rows)
    feature_order = build_feature_order(categorical_levels)

    X = np.array(
        [vectorize_incident(r, feature_order, categorical_levels) for r in rows],
        dtype=float,
    )
    Y = np.array(
        [
            [parse_float(r.get("firetrucks_dispatched_engines")), parse_float(r.get("ambulances_dispatched"))]
            for r in rows
        ],
        dtype=float,
    )

    qv = vectorize_incident(query, feature_order, categorical_levels)

    dists = np.array([euclidean_dist(qv, X[i]) for i in range(X.shape[0])], dtype=float)
    order = np.argsort(dists)

    k = max(1, int(k))
    idx = order[: min(k, len(order))]

    d = dists[idx]
    eps = 1e-6
    w = 1.0 / (d + eps)
    w_sum = float(np.sum(w))
    if w_sum <= 0:
        pred = np.mean(Y[idx], axis=0)
    else:
        pred = (w @ Y[idx]) / w_sum

    pred_engines = int(math.ceil(clamp_nonneg(float(pred[0]))))
    pred_amb = int(math.ceil(clamp_nonneg(float(pred[1]))))

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
                "actual_firetrucks_dispatched_engines": parse_float(r.get("firetrucks_dispatched_engines")),
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

