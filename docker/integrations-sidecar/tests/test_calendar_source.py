"""Snapshot and endpoint behaviour with CalDAV stubbed out."""

import unittest
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from unittest import mock

from app import calendar_source, main
from app.caldav_client import CalendarCollection
from app.config import Account, Settings

SERIES = (
    "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//test//test//EN\n"
    "BEGIN:VEVENT\nUID:series-1\nSUMMARY:Trening\n"
    "DTSTART:{start}\nDTEND:{end}\nRRULE:FREQ=DAILY;COUNT=5\n"
    "END:VEVENT\nEND:VCALENDAR\n"
)


def settings(**overrides) -> Settings:
    base = {
        "accounts": [
            Account(
                identifier="default",
                username="someone@example.com",
                password="app-specific",
                url="https://caldav.example.com/",
            )
        ],
        "poll_seconds": 300,
        "window_days": 31,
        "past_days": 1,
        "max_events_per_calendar": 25,
    }
    base.update(overrides)
    return Settings(**base)


def series_document() -> str:
    start = datetime.now(timezone.utc) + timedelta(hours=1)
    return SERIES.format(
        start=start.strftime("%Y%m%dT%H%M%SZ"),
        end=(start + timedelta(hours=1)).strftime("%Y%m%dT%H%M%SZ"),
    )


@contextmanager
def stub_caldav(documents=None, collections=None):
    """Patch the whole CalDAV layer away; the poll loop under test is what matters."""
    collections = collections or [
        CalendarCollection(
            entity_id="calendar.familie", name="Familie", url="https://c/1", color="#FF2968"
        ),
        CalendarCollection(entity_id="calendar.jobb", name="Jobb", url="https://c/2"),
    ]
    documents = series_document() if documents is None else documents
    client = calendar_source.caldav_client

    with (
        mock.patch.object(client, "connect", return_value=mock.Mock()),
        mock.patch.object(client, "list_event_calendars", return_value=collections),
        mock.patch.object(client, "fetch_documents", return_value=[documents]),
    ):
        yield


class RefreshTests(unittest.TestCase):
    def test_builds_a_snapshot_per_calendar(self):
        source = calendar_source.CalendarSource(settings())
        with stub_caldav():
            source.refresh_blocking()

        snapshot = source.snapshot()
        self.assertTrue(snapshot["configured"])
        self.assertFalse(snapshot["stale"])
        self.assertIsNotNone(snapshot["fetchedAt"])
        self.assertEqual(
            [entry["entityId"] for entry in snapshot["calendars"]],
            ["calendar.familie", "calendar.jobb"],
        )
        self.assertEqual(len(snapshot["calendars"][0]["events"]), 5)
        self.assertTrue(
            all(
                event["uid"].startswith("series-1#")
                for event in snapshot["calendars"][0]["events"]
            )
        )

    def test_honours_the_per_calendar_event_limit(self):
        source = calendar_source.CalendarSource(settings(max_events_per_calendar=2))
        with stub_caldav():
            source.refresh_blocking()

        self.assertEqual(len(source.snapshot()["calendars"][0]["events"]), 2)

    def test_serves_nothing_when_no_account_is_configured(self):
        source = calendar_source.CalendarSource(settings(accounts=[]))
        source.refresh_blocking()

        snapshot = source.snapshot()
        self.assertFalse(snapshot["configured"])
        self.assertEqual(snapshot["calendars"], [])

    def test_keeps_the_last_good_snapshot_and_marks_it_stale(self):
        source = calendar_source.CalendarSource(settings())
        with stub_caldav():
            source.refresh_blocking()

        source.mark_failed(RuntimeError("401 Unauthorized"))

        snapshot = source.snapshot()
        self.assertTrue(snapshot["stale"])
        self.assertEqual(snapshot["error"], "401 Unauthorized")
        self.assertEqual(len(snapshot["calendars"]), 2)

    def test_a_first_refresh_failure_is_an_error_but_not_stale(self):
        source = calendar_source.CalendarSource(settings())
        source.mark_failed(RuntimeError("boom"))

        snapshot = source.snapshot()
        self.assertFalse(snapshot["stale"])
        self.assertEqual(snapshot["error"], "boom")


class EndpointTests(unittest.TestCase):
    def setUp(self):
        self.source = calendar_source.CalendarSource(settings())
        with stub_caldav():
            self.source.refresh_blocking()

        patcher = mock.patch.object(main, "source", self.source)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_health_reports_the_calendar_count(self):
        payload = main.healthz()

        self.assertEqual(payload["status"], "ok")
        self.assertTrue(payload["configured"])
        self.assertEqual(payload["calendarCount"], 2)

    def test_calendar_listing_omits_events(self):
        payload = main.list_calendars()

        self.assertEqual(
            payload["calendars"],
            [
                {"entityId": "calendar.familie", "name": "Familie", "color": "#FF2968"},
                {"entityId": "calendar.jobb", "name": "Jobb", "color": None},
            ],
        )

    def test_events_can_be_narrowed_to_one_calendar(self):
        payload = main.list_events(days=None, calendar="calendar.jobb")

        self.assertEqual([entry["entityId"] for entry in payload["calendars"]], ["calendar.jobb"])

    def test_events_can_be_narrowed_to_a_shorter_window(self):
        payload = main.list_events(days=2, calendar=None)

        # The stub holds a daily series of five; only the ones inside two days survive.
        self.assertEqual(len(payload["calendars"][0]["events"]), 2)

    def test_events_carry_the_calendar_colour(self):
        payload = main.list_events(days=None, calendar="calendar.familie")

        self.assertEqual(payload["calendars"][0]["color"], "#FF2968")

    def test_a_calendar_without_a_colour_reports_none(self):
        payload = main.list_events(days=None, calendar="calendar.jobb")

        self.assertIsNone(payload["calendars"][0]["color"])

    def test_unknown_calendar_returns_an_empty_list(self):
        payload = main.list_events(days=None, calendar="calendar.nope")

        self.assertEqual(payload["calendars"], [])


if __name__ == "__main__":
    unittest.main()
