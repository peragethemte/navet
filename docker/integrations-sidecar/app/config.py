"""Environment configuration for the iCloud sidecar.

Credentials are read here and nowhere else. njs never sees them, so they need no `env`
declaration in nginx.main.conf and cannot reach the browser through config.js.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

DEFAULT_CALDAV_URL = "https://caldav.icloud.com/"
DEFAULT_POLL_SECONDS = 300
DEFAULT_WINDOW_DAYS = 31
# A day of history keeps an event that is already under way, and today's all-day events,
# inside the window navet then filters down itself.
DEFAULT_PAST_DAYS = 1
DEFAULT_MAX_EVENTS_PER_CALENDAR = 25


@dataclass(frozen=True)
class Account:
    """One iCloud login. A list today holds one entry; a second Apple ID is additive."""

    identifier: str
    username: str
    password: str
    url: str


@dataclass(frozen=True)
class Settings:
    accounts: list[Account]
    poll_seconds: int
    window_days: int
    past_days: int
    max_events_per_calendar: int

    @property
    def configured(self) -> bool:
        return bool(self.accounts)


def read_secret(name: str) -> str:
    """Read an env var, or its `_FILE` twin pointing at a mounted secret."""
    file_path = os.environ.get(f"{name}_FILE", "").strip()
    if file_path:
        try:
            with open(file_path, encoding="utf-8") as handle:
                return handle.read().strip()
        except OSError:
            return ""

    return os.environ.get(name, "").strip()


def read_int(name: str, fallback: int, minimum: int = 0) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return fallback

    try:
        value = int(raw)
    except ValueError:
        return fallback

    return value if value >= minimum else fallback


def load_settings() -> Settings:
    username = read_secret("NAVET_ICLOUD_APPLE_ID")
    password = read_secret("NAVET_ICLOUD_APP_PASSWORD")
    url = os.environ.get("NAVET_ICLOUD_CALDAV_URL", "").strip() or DEFAULT_CALDAV_URL

    accounts = []
    if username and password:
        accounts.append(
            Account(identifier="default", username=username, password=password, url=url)
        )

    return Settings(
        accounts=accounts,
        poll_seconds=read_int("NAVET_ICLOUD_CALENDAR_POLL_SECONDS", DEFAULT_POLL_SECONDS, 30),
        window_days=read_int("NAVET_ICLOUD_CALENDAR_DAYS", DEFAULT_WINDOW_DAYS, 1),
        past_days=read_int("NAVET_ICLOUD_CALENDAR_PAST_DAYS", DEFAULT_PAST_DAYS),
        max_events_per_calendar=read_int(
            "NAVET_ICLOUD_MAX_EVENTS_PER_CALENDAR", DEFAULT_MAX_EVENTS_PER_CALENDAR, 1
        ),
    )
