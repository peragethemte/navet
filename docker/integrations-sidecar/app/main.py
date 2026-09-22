"""FastAPI surface for the iCloud sidecar.

Read-only by design: there is no route that writes to iCloud. Served behind nginx over a Unix
socket in Docker, and over 127.0.0.1 during development.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, Query

from .calendar_source import CalendarSource

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

source = CalendarSource()


@asynccontextmanager
async def lifespan(_: FastAPI):
    source.start()
    try:
        yield
    finally:
        await source.stop()


app = FastAPI(title="Navet iCloud sidecar", lifespan=lifespan)


@app.get("/healthz")
def healthz() -> dict:
    snapshot = source.snapshot()
    return {
        "status": "ok",
        "configured": snapshot["configured"],
        "stale": snapshot["stale"],
        "error": snapshot["error"],
        "fetchedAt": snapshot["fetchedAt"],
        "calendarCount": len(snapshot["calendars"]),
    }


@app.get("/calendar/calendars")
def list_calendars() -> dict:
    snapshot = source.snapshot()
    return {
        "configured": snapshot["configured"],
        "stale": snapshot["stale"],
        "fetchedAt": snapshot["fetchedAt"],
        "calendars": [
            {
                "entityId": calendar["entityId"],
                "name": calendar["name"],
                "color": calendar["color"],
            }
            for calendar in snapshot["calendars"]
        ],
    }


@app.get("/calendar/events")
def list_events(
    days: int | None = Query(default=None, ge=1, le=365),
    calendar: str | None = Query(default=None),
) -> dict:
    """Serve the polled snapshot, optionally narrowed to one calendar or a shorter window."""
    snapshot = source.snapshot()
    cutoff = _cutoff(days)

    calendars = [
        {
            "entityId": entry["entityId"],
            "name": entry["name"],
            "color": entry["color"],
            "events": [event for event in entry["events"] if _within(event, cutoff)],
        }
        for entry in snapshot["calendars"]
        if calendar is None or entry["entityId"] == calendar
    ]

    return {
        "configured": snapshot["configured"],
        "stale": snapshot["stale"],
        "fetchedAt": snapshot["fetchedAt"],
        "calendars": calendars,
    }


def _cutoff(days: int | None) -> datetime | None:
    if days is None:
        return None

    return datetime.now(timezone.utc) + timedelta(days=days)


def _within(event: dict, cutoff: datetime | None) -> bool:
    if cutoff is None:
        return True

    value = event["start"]
    start = datetime.fromisoformat(value.get("dateTime") or value.get("date"))
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)

    return start <= cutoff
