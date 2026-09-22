"""Background CalDAV poll loop with an in-memory snapshot.

The HTTP endpoints never touch iCloud: they serve the last snapshot. A failed refresh keeps the
previous events and marks them stale, because a wall dashboard showing yesterday's schedule is
more useful than one showing nothing.
"""

from __future__ import annotations

import asyncio
import logging
import threading
from datetime import datetime, timedelta, timezone

from . import caldav_client
from .config import Settings, load_settings
from .ical_mapping import expand_events, merge_documents

logger = logging.getLogger("navet.icloud")

# The first refresh can lose a race with anything still starting up; retry quickly before
# settling into the configured interval.
ERROR_RETRY_SECONDS = [5, 15, 30, 60]


class CalendarSource:
    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or load_settings()
        self._lock = threading.Lock()
        self._calendars: list[dict] = []
        self._fetched_at: datetime | None = None
        self._error: str | None = None
        self._stale = False
        self._task: asyncio.Task | None = None

    @property
    def settings(self) -> Settings:
        return self._settings

    def snapshot(self) -> dict:
        with self._lock:
            return {
                "configured": self._settings.configured,
                "stale": self._stale,
                "error": self._error,
                "fetchedAt": self._fetched_at.isoformat() if self._fetched_at else None,
                "calendars": self._calendars,
            }

    def refresh_blocking(self) -> None:
        """One full poll across every configured account. Runs off the event loop."""
        if not self._settings.configured:
            with self._lock:
                self._calendars = []
                self._error = None
                self._stale = False
            return

        window_start, window_end = self._window()
        calendars: list[dict] = []

        for account in self._settings.accounts:
            principal = caldav_client.connect(account)
            for collection in caldav_client.list_event_calendars(principal):
                documents = caldav_client.fetch_documents(
                    principal, collection, window_start, window_end
                )
                events = expand_events(
                    merge_documents(documents),
                    window_start,
                    window_end,
                    self._settings.max_events_per_calendar,
                )
                calendars.append(
                    {
                        "entityId": collection.entity_id,
                        "name": collection.name,
                        "color": collection.color,
                        "events": events,
                    }
                )

        with self._lock:
            self._calendars = calendars
            self._fetched_at = datetime.now(timezone.utc)
            self._error = None
            self._stale = False

    def mark_failed(self, error: Exception) -> None:
        with self._lock:
            self._error = str(error) or error.__class__.__name__
            self._stale = self._fetched_at is not None

    async def run_forever(self) -> None:
        attempt = 0
        while True:
            try:
                await asyncio.to_thread(self.refresh_blocking)
                attempt = 0
                delay = self._settings.poll_seconds
            except asyncio.CancelledError:
                raise
            except Exception as error:  # noqa: BLE001 - any failure must keep the loop alive
                logger.warning("iCloud calendar refresh failed: %s", error)
                self.mark_failed(error)
                delay = ERROR_RETRY_SECONDS[min(attempt, len(ERROR_RETRY_SECONDS) - 1)]
                attempt += 1

            await asyncio.sleep(delay)

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self.run_forever())

    async def stop(self) -> None:
        if self._task is None:
            return

        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        finally:
            self._task = None

    def _window(self) -> tuple[datetime, datetime]:
        now = datetime.now(timezone.utc)
        return (
            now - timedelta(days=self._settings.past_days),
            now + timedelta(days=self._settings.window_days),
        )
