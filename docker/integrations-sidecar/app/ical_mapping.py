"""Pure iCalendar to Navet event mapping.

No network and no CalDAV here on purpose: everything in this module is a function of the raw
iCalendar documents it is handed, so recurrence, all-day and timezone behaviour can be tested
without an Apple ID. The output shape is what navet's calendar mapper reads
(packages/app/src/hooks/device-mappers/map-calendar-device.ts).
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import recurring_ical_events
from icalendar import Calendar

# navet keeps at most 5 events per calendar and 12 across all of them, so anything beyond a
# couple of dozen is payload we would only throw away.
DEFAULT_EVENT_LIMIT = 25


def merge_documents(raw_documents: list[str]) -> Calendar:
    """Merge one CalDAV calendar's resources into a single VCALENDAR.

    Recurrence overrides (RECURRENCE-ID) and the master event usually share one resource, but
    they are allowed to live in separate ones. Merging first means expansion sees the whole
    series either way. VTIMEZONE components are carried over so TZID references still resolve.
    """
    merged = Calendar()
    merged.add("prodid", "-//Navet//iCloud calendar sidecar//EN")
    merged.add("version", "2.0")

    for raw in raw_documents:
        if not raw:
            continue
        for document in Calendar.from_ical(raw, multiple=True):
            for component in document.subcomponents:
                merged.add_component(component)

    return merged


def expand_events(
    calendar: Calendar,
    window_start: datetime,
    window_end: datetime,
    limit: int = DEFAULT_EVENT_LIMIT,
) -> list[dict]:
    """Expand recurrences inside the window and map each occurrence to a Navet event."""
    query = recurring_ical_events.of(calendar, components=("VEVENT",), skip_bad_series=True)
    occurrences = query.between(window_start, window_end)

    events = [mapped for mapped in (map_component(item) for item in occurrences) if mapped]
    events.sort(key=_sort_key)
    return events[:limit]


def map_component(component) -> dict | None:
    """Map one expanded VEVENT to the record shape navet's calendar mapper reads."""
    if str(component.get("status", "")).upper() == "CANCELLED":
        return None

    start_value = _decoded(component, "DTSTART")
    if start_value is None:
        return None

    end_value = _resolve_end(component, start_value)

    uid = str(component.get("uid", "")).strip()
    occurrence_id = _occurrence_id(uid, start_value)

    event = {
        "uid": occurrence_id,
        "summary": _text(component, "summary"),
        "start": _as_calendar_value(start_value),
        "end": _as_calendar_value(end_value),
    }

    description = _text(component, "description")
    if description:
        event["description"] = description

    location = _text(component, "location")
    if location:
        event["location"] = location

    return event


def _resolve_end(component, start_value):
    end_value = _decoded(component, "DTEND")
    if end_value is not None:
        return end_value

    duration = _decoded(component, "DURATION")
    if isinstance(duration, timedelta):
        return start_value + duration

    # An all-day event without DTEND covers its single day; iCalendar DTEND is exclusive.
    if _is_all_day(start_value):
        return start_value + timedelta(days=1)

    return start_value


def _occurrence_id(uid: str, start_value) -> str:
    """Give every occurrence of a series its own id.

    navet uses `uid` verbatim as the event id, and expanded instances of one series all carry
    the master's UID, so the start has to be part of it or the card would collapse a weekly
    event into a single row.
    """
    marker = start_value.isoformat()
    return f"{uid}#{marker}" if uid else marker


def _as_calendar_value(value) -> dict:
    """All-day dates and timed datetimes are distinguished by key, as Google and HA do it."""
    if _is_all_day(value):
        return {"date": value.isoformat()}

    # A naive datetime is a floating time: emit it without an offset so the browser reads it
    # as local, which is what a floating event means.
    return {"dateTime": value.isoformat()}


def _is_all_day(value) -> bool:
    return isinstance(value, date) and not isinstance(value, datetime)


def _decoded(component, name):
    try:
        return component.decoded(name)
    except (KeyError, AttributeError, ValueError):
        return None


def _text(component, name: str) -> str:
    value = component.get(name)
    if value is None:
        return ""
    return str(value).strip()


def _sort_key(event: dict) -> float:
    """Sort on real instants, not ISO strings: offsets differ between calendars."""
    value = event["start"]
    parsed = datetime.fromisoformat(value.get("dateTime") or value.get("date"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.timestamp()
