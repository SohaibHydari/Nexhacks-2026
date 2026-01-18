import os
from datetime import datetime, timedelta, timezone
from typing import Tuple

import psycopg2
from psycopg2.extras import RealDictCursor

from incidents.models import Unit


THRESHOLD = 2
STATUS_AVAILABLE = "AVAILABLE"
STATUS_ENROUTE = "ENROUTE"


def get_supabase_db_conn():
    """
    Uses your existing .env variables:
      DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT
    """
    name = os.getenv("DB_NAME")
    user = os.getenv("DB_USER")
    password = os.getenv("DB_PASSWORD")
    host = os.getenv("DB_HOST")
    port = os.getenv("DB_PORT", "5432")

    if not all([name, user, password, host, port]):
        raise RuntimeError("Database env vars missing (DB_NAME/DB_USER/DB_PASSWORD/DB_HOST/DB_PORT).")

    return psycopg2.connect(
        dbname=name,
        user=user,
        password=password,
        host=host,
        port=int(port),
        sslmode="require",  # Supabase requires SSL
    )


def forecast_ambulance_low(
    *,
    window_min: int = 120,
    horizon_min: int = 180,
) -> Tuple[bool, str]:
    """
    Returns (low_ambulances: bool, warning_message: str)
    """

    # Current inventory from Django DB
    available_now = Unit.objects.filter(
        unit_type=Unit.UnitType.AMBULANCE,
        status=Unit.Status.AVAILABLE,
    ).count()

    total = Unit.objects.filter(unit_type=Unit.UnitType.AMBULANCE).count()

    if available_now <= THRESHOLD:
        return True, f"LOW NOW: Only {available_now} ambulances AVAILABLE (threshold={THRESHOLD})."

    since = datetime.now(timezone.utc) - timedelta(minutes=window_min)

    # Query Supabase Postgres directly for log entries
    # NOTE: If your table name is actually "LogEntry" or uses different casing,
    # update it here.
    sql = """
        SELECT COUNT(*) AS cnt
        FROM incidents_logentry
        WHERE created_at >= %s
          AND from_status = %s
          AND to_status = %s
    """

    with get_supabase_db_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, (since, STATUS_AVAILABLE, STATUS_ENROUTE))
            row = cur.fetchone() or {"cnt": 0}

    count = int(row["cnt"])

    if count == 0:
        return False, (
            f"OK: {available_now} ambulances AVAILABLE (total={total}). "
            f"No recent consumption detected."
        )

    hours = max(window_min / 60.0, 1e-6)
    rate = count / hours  # ambulances/hour

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
