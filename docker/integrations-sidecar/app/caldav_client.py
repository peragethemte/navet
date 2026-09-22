"""Thin CalDAV wrapper.

Everything that talks to iCloud lives here, so the mapping in ical_mapping.py stays pure and
testable. Recurrences are expanded client-side rather than through the server's `expand`, which
is not dependable across CalDAV servers.
"""

from __future__ import annotations

import hashlib
import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime

import caldav

from .config import Account

# navet discovers calendars by this entity-id prefix; anything else is invisible to it.
ENTITY_ID_PREFIX = "calendar."


@dataclass(frozen=True)
class CalendarCollection:
    entity_id: str
    name: str
    url: str


def connect(account: Account) -> caldav.Principal:
    client = caldav.DAVClient(
        url=account.url,
        username=account.username,
        password=account.password,
    )
    return client.principal()


def list_event_calendars(principal: caldav.Principal) -> list[CalendarCollection]:
    """List the collections that hold events.

    An iCloud account also exposes reminder lists and subscribed feeds; keeping only
    collections that support VEVENT drops the ones the calendar card cannot render.
    """
    collections: list[CalendarCollection] = []
    used_ids: set[str] = set()

    for calendar in sorted(principal.calendars(), key=lambda item: str(item.url)):
        if not _supports_events(calendar):
            continue

        url = str(calendar.url)
        name = _display_name(calendar) or url
        collections.append(
            CalendarCollection(entity_id=_entity_id(name, url, used_ids), name=name, url=url)
        )

    return collections


def fetch_documents(
    principal: caldav.Principal,
    collection: CalendarCollection,
    window_start: datetime,
    window_end: datetime,
) -> list[str]:
    """Fetch the raw iCalendar resources overlapping the window."""
    calendar = principal.calendar(cal_url=collection.url)
    results = calendar.search(start=window_start, end=window_end, event=True, expand=False)
    return [result.data for result in results if result.data]


def _supports_events(calendar) -> bool:
    try:
        components = calendar.get_supported_components()
    except Exception:
        # A server that will not answer the property question still usually holds events.
        return True

    return not components or "VEVENT" in components


def _display_name(calendar) -> str:
    try:
        return str(calendar.get_display_name() or "").strip()
    except Exception:
        return str(getattr(calendar, "name", "") or "").strip()


def _entity_id(name: str, url: str, used_ids: set[str]) -> str:
    """Build a stable `calendar.<slug>` id, disambiguated by a hash of the collection URL.

    Renaming a calendar in iCloud changes its id, which resets that card's source selection.
    That is the cost of an id a human can recognise in settings and logs.
    """
    entity_id = f"{ENTITY_ID_PREFIX}{_slug(name) or _hash(url)}"
    if entity_id in used_ids:
        entity_id = f"{entity_id}_{_hash(url)}"

    used_ids.add(entity_id)
    return entity_id


def _slug(value: str) -> str:
    folded = unicodedata.normalize("NFKD", value)
    folded = folded.replace("ø", "o").replace("Ø", "O").replace("æ", "ae").replace("å", "a")
    ascii_only = folded.encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"_+", "_", re.sub(r"[^a-z0-9]+", "_", ascii_only)).strip("_")


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:6]
