import json
from typing import Any, Dict

from django.http import JsonResponse, HttpResponseNotAllowed
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction
from django.utils import timezone
from django.views.decorators.http import require_GET
from .models import Unit, ResourceRequest, RequestAssignment, LogEntry
from initial_prediction_model.initial_resource_model import estimate_resources_with_gpt
from low_alert_prediction_model.ambulance_forecast import forecast_ambulance_low

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

@require_GET
def ambulance_low_check(request):
    low, warning = forecast_ambulance_low()

    return JsonResponse(
        {
            "low_ambulances": low,
            "warning": warning,
        }
    )

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


def _to_int(value: Any) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


@csrf_exempt
def initial_prediction(request):
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])

    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    incident = payload.get("incident", {})
    city = str(incident.get("city", "")).strip() or ""
    category = str(incident.get("incident_category", "")).strip() or ""
    subtype = str(incident.get("incident_subtype", "")).strip() or ""
    buildings = _to_int(incident.get("structures_threatened")) or _to_int(incident.get("structures_damaged"))
    population = _to_int(incident.get("population_affected_est"))

    try:
        prediction = estimate_resources_with_gpt(
            city=city,
            incident_category=category,
            incident_subtype=subtype,
            buildings_affected=buildings,
            population_affected=population,
        )
    except RuntimeError as exc:
        return JsonResponse({"error": str(exc)}, status=503)

    return JsonResponse({"prediction": prediction})



