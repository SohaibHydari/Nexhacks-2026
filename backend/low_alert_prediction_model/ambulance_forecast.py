import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from supabase import create_client
from incidents.models import Unit  # IMPORTANT: app-qualified import


THRESHOLD = 2
STATUS_AVAILABLE = "AVAILABLE"
STATUS_ENROUTE = "ENROUTE"


def get_supabase_client():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        raise RuntimeError("Supabase env vars missing")
    return create_client(url, key)


def forecast_ambulance_low(
    *,
    window_min: int = 120,
    horizon_min: int = 180,
) -> Tuple[bool, str]:
    """
    Returns (low_ambulances: bool, warning_message: str)
    """

    available_now = Unit.objects.filter(
        unit_type=Unit.UnitType.AMBULANCE,
        status=Unit.Status.AVAILABLE,
    ).count()

    total = Unit.objects.filter(unit_type=Unit.UnitType.AMBULANCE).count()

    if available_now <= THRESHOLD:
        return True, f"LOW NOW: Only {available_now} ambulances AVAILABLE (threshold={THRESHOLD})."

    sb = get_supabase_client()
    since = datetime.now(timezone.utc) - timedelta(minutes=window_min)

    res = (
        sb.table("logEntry")
        .select("created_at,from_status,to_status")
        .gte("created_at", since.isoformat())
        .eq("from_status", STATUS_AVAILABLE)
        .eq("to_status", STATUS_ENROUTE)
        .execute()
    )

    events = res.data or []
    count = len(events)

    if count == 0:
        return False, (
            f"OK: {available_now} ambulances AVAILABLE (total={total}). "
            f"No recent consumption detected."
        )

    hours = max(window_min / 60.0, 1e-6)
    rate = count / hours

    minutes_to_threshold = int(((available_now - THRESHOLD) / rate) * 60)

    if minutes_to_threshold <= horizon_min:
        return True, (
            f"FORECAST LOW: {available_now} AVAILABLE now; projected to reach ≤ {THRESHOLD} "
            f"in ~{minutes_to_threshold} minutes."
        )

    return False, (
        f"OK: {available_now} ambulances AVAILABLE (total={total}). "
        f"Estimated time to threshold: ~{minutes_to_threshold} minutes."
    )
