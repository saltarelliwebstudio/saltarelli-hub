"""
Zen Planner Attendance Sync → Supabase
Deployed on Modal.com | Runs 4x/day via Modal cron

Fetches attendance + active member data from Zen Planner API
and upserts into client_analytics_data (source_type = 'zen_planner').
"""

import modal
import json
import os
from datetime import datetime, timedelta, timezone

app = modal.App("zen-planner-sync")

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "requests", "supabase", "fastapi"
)


def fetch_zen_planner_attendance(subdomain: str, username: str, password: str, start_date: str, end_date: str) -> list:
    """Fetch attendance records from Zen Planner API."""
    import requests

    base_url = f"https://{subdomain}.zenplanner.com/zenplanner/api"
    url = f"{base_url}/v1/attendance"
    params = {"startDate": start_date, "endDate": end_date}

    resp = requests.get(url, params=params, auth=(username, password), timeout=30)
    resp.raise_for_status()
    return resp.json()


def fetch_zen_planner_members(subdomain: str, username: str, password: str) -> list:
    """Fetch active members from Zen Planner API."""
    import requests

    base_url = f"https://{subdomain}.zenplanner.com/zenplanner/api"
    url = f"{base_url}/v1/person"
    params = {"status": "Active"}

    resp = requests.get(url, params=params, auth=(username, password), timeout=30)
    resp.raise_for_status()
    return resp.json()


def process_attendance_data(records: list) -> dict:
    """
    Process raw attendance records into three metric types:
    - daily_checkins: {date, count} per day
    - attendance_by_class: [{class, count}] array
    - total_active_members: count
    """
    daily = {}
    classes = {}

    for record in records:
        date = record.get("date", "")[:10]  # YYYY-MM-DD
        program = record.get("programName") or record.get("programId") or "Unknown"

        if date:
            daily[date] = daily.get(date, 0) + 1

        classes[program] = classes.get(program, 0) + 1

    return {
        "daily": daily,
        "classes": classes,
    }


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("genius-zen-planner-credentials")],
    schedule=modal.Cron("0 6,12,18,23 * * *"),  # 4x/day: 6am, 12pm, 6pm, 11pm UTC
    timeout=300,
)
def sync_zen_planner():
    """Main sync function. Runs on schedule or manually."""
    from supabase import create_client

    # ── Load credentials from Modal secrets ──
    subdomain = os.environ["ZEN_PLANNER_SUBDOMAIN"]
    username = os.environ["ZEN_PLANNER_USERNAME"]
    password = os.environ["ZEN_PLANNER_PASSWORD"]
    client_id = os.environ["ZEN_PLANNER_CLIENT_ID"]
    supabase_url = os.environ["SUPABASE_URL"]
    supabase_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    sb = create_client(supabase_url, supabase_key)

    now = datetime.now(timezone.utc)
    end_date = now.strftime("%Y-%m-%d")
    start_date = (now - timedelta(days=90)).strftime("%Y-%m-%d")

    print(f"🏋️ Syncing Zen Planner: {subdomain} | {start_date} → {end_date}")

    # ── Fetch attendance data ──
    try:
        attendance_records = fetch_zen_planner_attendance(subdomain, username, password, start_date, end_date)
        print(f"  ✅ Fetched {len(attendance_records)} attendance records")
    except Exception as e:
        print(f"  ❌ Failed to fetch attendance: {e}")
        attendance_records = []

    # ── Fetch active members ──
    try:
        members = fetch_zen_planner_members(subdomain, username, password)
        active_member_count = len(members) if isinstance(members, list) else 0
        print(f"  ✅ Fetched {active_member_count} active members")
    except Exception as e:
        print(f"  ❌ Failed to fetch members: {e}")
        active_member_count = 0

    # ── Process data ──
    processed = process_attendance_data(attendance_records)

    rows_to_upsert = []
    synced_at = now.isoformat()

    # daily_checkins — one row per day
    for date_str, count in processed["daily"].items():
        rows_to_upsert.append({
            "client_id": client_id,
            "source_type": "zen_planner",
            "metric_name": "daily_checkins",
            "metric_value": json.dumps({"date": date_str, "count": count}),
            "period_start": f"{date_str}T00:00:00Z",
            "period_end": f"{date_str}T23:59:59Z",
            "synced_at": synced_at,
        })

    # total_active_members — single row for today
    rows_to_upsert.append({
        "client_id": client_id,
        "source_type": "zen_planner",
        "metric_name": "total_active_members",
        "metric_value": json.dumps({"count": active_member_count}),
        "period_start": f"{end_date}T00:00:00Z",
        "period_end": f"{end_date}T23:59:59Z",
        "synced_at": synced_at,
    })

    # attendance_by_class — single row with full array for the 90-day window
    class_array = [{"class": name, "count": count} for name, count in processed["classes"].items()]
    class_array.sort(key=lambda x: x["count"], reverse=True)

    rows_to_upsert.append({
        "client_id": client_id,
        "source_type": "zen_planner",
        "metric_name": "attendance_by_class",
        "metric_value": json.dumps(class_array),
        "period_start": f"{start_date}T00:00:00Z",
        "period_end": f"{end_date}T23:59:59Z",
        "synced_at": synced_at,
    })

    # ── Upsert to Supabase ──
    # Delete old zen_planner data for this client first, then insert fresh
    try:
        sb.table("client_analytics_data") \
            .delete() \
            .eq("client_id", client_id) \
            .eq("source_type", "zen_planner") \
            .execute()
        print(f"  🗑️ Cleared old zen_planner data")
    except Exception as e:
        print(f"  ⚠️ Failed to clear old data: {e}")

    try:
        # Insert in batches of 50
        for i in range(0, len(rows_to_upsert), 50):
            batch = rows_to_upsert[i:i + 50]
            sb.table("client_analytics_data").insert(batch).execute()

        print(f"  ✅ Inserted {len(rows_to_upsert)} rows into client_analytics_data")
    except Exception as e:
        print(f"  ❌ Failed to insert data: {e}")
        raise

    print(f"🏁 Sync complete! {len(rows_to_upsert)} metrics written.")
    return {"status": "ok", "rows": len(rows_to_upsert)}


# To trigger manually, run: python3 -m modal run sync_zen_planner.py::sync_zen_planner
