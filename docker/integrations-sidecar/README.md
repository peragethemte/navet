# iCloud sidecar

A small read-only FastAPI service that polls Apple iCloud over CalDAV and serves a snapshot of
calendar events. Navet's `provider-icloud` package reads it through an authenticated same-origin
proxy; nothing here is reachable from the browser directly.

It exists because iCloud needs a stateful, authenticated client and server-side recurrence
expansion, neither of which njs can do. It is the sibling of `docker/rss-transport`, which solves
the same kind of problem in Go.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `NAVET_ICLOUD_APPLE_ID` | - | Apple ID the calendars belong to |
| `NAVET_ICLOUD_APP_PASSWORD` | - | App-specific password, not the account password |
| `NAVET_ICLOUD_CALDAV_URL` | `https://caldav.icloud.com/` | CalDAV entry point |
| `NAVET_ICLOUD_CALENDAR_POLL_SECONDS` | `300` | How often iCloud is polled |
| `NAVET_ICLOUD_CALENDAR_DAYS` | `31` | How far ahead events are fetched |
| `NAVET_ICLOUD_CALENDAR_PAST_DAYS` | `1` | History kept so events already under way still show |
| `NAVET_ICLOUD_MAX_EVENTS_PER_CALENDAR` | `25` | Cap per calendar |

Both credential variables also accept a `_FILE` twin pointing at a mounted secret, for example
`NAVET_ICLOUD_APP_PASSWORD_FILE=/run/secrets/icloud`.

Create the app-specific password at appleid.apple.com under Sign-In and Security. Without one,
CalDAV authentication fails even with the correct account password.

Without credentials the service still starts and reports `configured: false`, so the rest of Navet
keeps working.

## Run it

Put the credentials in `.env.local` next to this file. It is gitignored, and keeping them there
rather than on the command line keeps them out of shell history.

```sh
docker/integrations-sidecar/run-tests.sh   # bootstraps .venv on first use
docker/integrations-sidecar/run-dev.sh     # serves on 127.0.0.1:8091, PORT overrides
```

Inside the container it runs over a Unix socket instead, supervised beside nginx.

## Endpoints

- `GET /healthz` - configured, stale, last error, calendar count
- `GET /calendar/calendars` - the discovered calendars and their entity ids
- `GET /calendar/events?days=N&calendar=<entityId>` - the polled snapshot, optionally narrowed

Entity ids are `calendar.<slug>` because that prefix is how Navet discovers calendars. Renaming a
calendar in iCloud changes its id, which resets which sources a card has selected.

## Design notes

- Recurrences are expanded here, not by the CalDAV server and not by Navet. Navet has no recurrence
  handling at all and expects occurrences the way Home Assistant delivers them.
- Every occurrence of a series gets its own id (`<uid>#<start>`), because Navet uses the event id
  verbatim and would otherwise collapse a weekly event into one row.
- All-day events are emitted as `{"date": "YYYY-MM-DD"}` with an exclusive end, timed events as
  `{"dateTime": "<ISO with offset>"}`, matching what Navet's calendar mapper already parses.
- A failed poll keeps the previous snapshot and marks it stale rather than emptying the card.
