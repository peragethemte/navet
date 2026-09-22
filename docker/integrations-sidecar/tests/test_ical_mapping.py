"""Mapping tests against synthetic iCalendar documents - no Apple ID needed."""

import unittest
from datetime import datetime, timezone

from app.ical_mapping import expand_events, merge_documents

WINDOW_START = datetime(2026, 9, 21, 0, 0, tzinfo=timezone.utc)
WINDOW_END = datetime(2026, 10, 21, 0, 0, tzinfo=timezone.utc)

OSLO_TIMEZONE = """BEGIN:VTIMEZONE
TZID:Europe/Oslo
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10
END:STANDARD
END:VTIMEZONE
"""


def document(*components: str) -> str:
    body = "".join(components)
    return f"BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//test//test//EN\n{body}END:VCALENDAR\n"


def expand(*documents: str, limit: int = 25):
    return expand_events(merge_documents(list(documents)), WINDOW_START, WINDOW_END, limit)


class TimedEventTests(unittest.TestCase):
    def test_keeps_the_local_offset_of_a_zoned_event(self):
        events = expand(
            document(
                OSLO_TIMEZONE,
                "BEGIN:VEVENT\n"
                "UID:timed-1\n"
                "SUMMARY:Foreldremøte\n"
                "LOCATION:Skolen\n"
                "DESCRIPTION:Ta med saft\n"
                "DTSTART;TZID=Europe/Oslo:20260922T180000\n"
                "DTEND;TZID=Europe/Oslo:20260922T193000\n"
                "END:VEVENT\n",
            )
        )

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["summary"], "Foreldremøte")
        self.assertEqual(events[0]["location"], "Skolen")
        self.assertEqual(events[0]["description"], "Ta med saft")
        self.assertEqual(events[0]["start"], {"dateTime": "2026-09-22T18:00:00+02:00"})
        self.assertEqual(events[0]["end"], {"dateTime": "2026-09-22T19:30:00+02:00"})

    def test_derives_the_end_from_a_duration(self):
        events = expand(
            document(
                "BEGIN:VEVENT\n"
                "UID:duration-1\n"
                "SUMMARY:Tannlege\n"
                "DTSTART:20260922T080000Z\n"
                "DURATION:PT45M\n"
                "END:VEVENT\n"
            )
        )

        self.assertEqual(events[0]["end"], {"dateTime": "2026-09-22T08:45:00+00:00"})

    def test_omits_empty_optional_fields(self):
        events = expand(
            document(
                "BEGIN:VEVENT\nUID:bare-1\nSUMMARY:Bare tittel\nDTSTART:20260922T080000Z\n"
                "DTEND:20260922T090000Z\nEND:VEVENT\n"
            )
        )

        self.assertNotIn("location", events[0])
        self.assertNotIn("description", events[0])


class AllDayEventTests(unittest.TestCase):
    def test_emits_a_date_value_and_an_exclusive_end(self):
        events = expand(
            document(
                "BEGIN:VEVENT\n"
                "UID:allday-1\n"
                "SUMMARY:Planleggingsdag\n"
                "DTSTART;VALUE=DATE:20260923\n"
                "DTEND;VALUE=DATE:20260924\n"
                "END:VEVENT\n"
            )
        )

        self.assertEqual(events[0]["start"], {"date": "2026-09-23"})
        self.assertEqual(events[0]["end"], {"date": "2026-09-24"})

    def test_defaults_a_missing_end_to_the_next_day(self):
        events = expand(
            document(
                "BEGIN:VEVENT\nUID:allday-2\nSUMMARY:Fridag\nDTSTART;VALUE=DATE:20260923\n"
                "END:VEVENT\n"
            )
        )

        self.assertEqual(events[0]["end"], {"date": "2026-09-24"})

    def test_keeps_a_multi_day_span(self):
        events = expand(
            document(
                "BEGIN:VEVENT\n"
                "UID:allday-3\n"
                "SUMMARY:Høstferie\n"
                "DTSTART;VALUE=DATE:20260928\n"
                "DTEND;VALUE=DATE:20261003\n"
                "END:VEVENT\n"
            )
        )

        self.assertEqual(events[0]["start"], {"date": "2026-09-28"})
        self.assertEqual(events[0]["end"], {"date": "2026-10-03"})


class RecurrenceTests(unittest.TestCase):
    WEEKLY = (
        "BEGIN:VEVENT\n"
        "UID:weekly-1\n"
        "SUMMARY:Fotballtrening\n"
        "DTSTART;TZID=Europe/Oslo:20260922T170000\n"
        "DTEND;TZID=Europe/Oslo:20260922T183000\n"
        "RRULE:FREQ=WEEKLY;COUNT=3\n"
        "END:VEVENT\n"
    )

    def test_expands_a_series_into_distinct_occurrences(self):
        events = expand(document(OSLO_TIMEZONE, self.WEEKLY))

        self.assertEqual(len(events), 3)
        self.assertEqual(
            [event["start"]["dateTime"] for event in events],
            [
                "2026-09-22T17:00:00+02:00",
                "2026-09-29T17:00:00+02:00",
                "2026-10-06T17:00:00+02:00",
            ],
        )

    def test_gives_every_occurrence_its_own_id(self):
        events = expand(document(OSLO_TIMEZONE, self.WEEKLY))
        ids = [event["uid"] for event in events]

        self.assertEqual(len(set(ids)), 3)
        self.assertTrue(all(identifier.startswith("weekly-1#") for identifier in ids))

    def test_honours_exdate(self):
        series = self.WEEKLY.replace(
            "RRULE:FREQ=WEEKLY;COUNT=3\n",
            "RRULE:FREQ=WEEKLY;COUNT=3\nEXDATE;TZID=Europe/Oslo:20260929T170000\n",
        )
        events = expand(document(OSLO_TIMEZONE, series))

        self.assertEqual(
            [event["start"]["dateTime"] for event in events],
            ["2026-09-22T17:00:00+02:00", "2026-10-06T17:00:00+02:00"],
        )

    def test_applies_a_recurrence_id_override(self):
        override = (
            "BEGIN:VEVENT\n"
            "UID:weekly-1\n"
            "SUMMARY:Fotballtrening (flyttet)\n"
            "RECURRENCE-ID;TZID=Europe/Oslo:20260929T170000\n"
            "DTSTART;TZID=Europe/Oslo:20260929T190000\n"
            "DTEND;TZID=Europe/Oslo:20260929T203000\n"
            "END:VEVENT\n"
        )
        events = expand(document(OSLO_TIMEZONE, self.WEEKLY, override))

        self.assertEqual(len(events), 3)
        moved = events[1]
        self.assertEqual(moved["summary"], "Fotballtrening (flyttet)")
        self.assertEqual(moved["start"], {"dateTime": "2026-09-29T19:00:00+02:00"})

    def test_applies_an_override_stored_as_a_separate_resource(self):
        override = document(
            OSLO_TIMEZONE,
            "BEGIN:VEVENT\n"
            "UID:weekly-1\n"
            "SUMMARY:Fotballtrening (annet sted)\n"
            "RECURRENCE-ID;TZID=Europe/Oslo:20261006T170000\n"
            "DTSTART;TZID=Europe/Oslo:20261006T170000\n"
            "DTEND;TZID=Europe/Oslo:20261006T183000\n"
            "LOCATION:Bortebane\n"
            "END:VEVENT\n",
        )
        events = expand(document(OSLO_TIMEZONE, self.WEEKLY), override)

        self.assertEqual(len(events), 3)
        self.assertEqual(events[2]["location"], "Bortebane")

    def test_drops_a_cancelled_instance(self):
        override = (
            "BEGIN:VEVENT\n"
            "UID:weekly-1\n"
            "STATUS:CANCELLED\n"
            "RECURRENCE-ID;TZID=Europe/Oslo:20260929T170000\n"
            "DTSTART;TZID=Europe/Oslo:20260929T170000\n"
            "DTEND;TZID=Europe/Oslo:20260929T183000\n"
            "END:VEVENT\n"
        )
        events = expand(document(OSLO_TIMEZONE, self.WEEKLY, override))

        self.assertEqual(
            [event["start"]["dateTime"] for event in events],
            ["2026-09-22T17:00:00+02:00", "2026-10-06T17:00:00+02:00"],
        )


class WindowAndOrderingTests(unittest.TestCase):
    def test_excludes_events_outside_the_window(self):
        events = expand(
            document(
                "BEGIN:VEVENT\nUID:old-1\nSUMMARY:I fjor\nDTSTART:20250922T080000Z\n"
                "DTEND:20250922T090000Z\nEND:VEVENT\n",
                "BEGIN:VEVENT\nUID:far-1\nSUMMARY:Neste år\nDTSTART:20271001T080000Z\n"
                "DTEND:20271001T090000Z\nEND:VEVENT\n",
            )
        )

        self.assertEqual(events, [])

    def test_sorts_on_the_real_instant_across_timezones(self):
        events = expand(
            document(
                OSLO_TIMEZONE,
                "BEGIN:VEVENT\nUID:utc-1\nSUMMARY:Utc\nDTSTART:20260922T160000Z\n"
                "DTEND:20260922T170000Z\nEND:VEVENT\n",
                "BEGIN:VEVENT\nUID:oslo-1\nSUMMARY:Oslo\n"
                "DTSTART;TZID=Europe/Oslo:20260922T170000\n"
                "DTEND;TZID=Europe/Oslo:20260922T180000\nEND:VEVENT\n",
            )
        )

        # 17:00 Oslo is 15:00Z, so it comes first despite the later wall-clock time.
        self.assertEqual([event["summary"] for event in events], ["Oslo", "Utc"])

    def test_applies_the_limit_after_sorting(self):
        events = expand(
            document(
                "BEGIN:VEVENT\nUID:daily-1\nSUMMARY:Daglig\nDTSTART:20260922T080000Z\n"
                "DTEND:20260922T090000Z\nRRULE:FREQ=DAILY;COUNT=10\nEND:VEVENT\n"
            ),
            limit=3,
        )

        self.assertEqual(len(events), 3)
        self.assertEqual(events[0]["start"], {"dateTime": "2026-09-22T08:00:00+00:00"})
        self.assertEqual(events[2]["start"], {"dateTime": "2026-09-24T08:00:00+00:00"})


if __name__ == "__main__":
    unittest.main()
