# Calendar: Apple/iCloud through navet's existing CalendarCard

Refinement of the calendar slice of `plan.md`, verified against the code on
`feature/settings-location-section` (2026-09-22). `plan.md` stays the umbrella; this file is the
implementation plan for calendar only.

## Locked decisions

- **Read-only.** Display events; no create/edit/delete, no write paths in the sidecar. A wall panel
  anyone can touch is not a place to hold write credentials to the family calendar.
- **One Apple ID.** Shared family calendars are visible from it. The sidecar config is still shaped
  as a list of accounts internally so a second Apple ID is additive, not a migration.
- **Calendar first, Reminders later.** The sidecar ships with the CalDAV source only. Reminders is a
  separate, later change to the same process (and a standalone widget, not a provider).
- **Reuse `CalendarCard` as-is.** No new calendar UI. The two small app-side changes below are
  wiring gaps, not new UI.

## Verified: what "reuse the calendar card" actually requires

The path, end to end, is not the `listEntities()` path `plan.md` assumed. It is:

`entityRuntimeService.getEntitySnapshots()` exposes `calendar.*` keys
-> `useProviderEntitySnapshotsByPrefix(['calendar.'])`
   (`packages/app/src/hooks/use-provider-calendar-devices.ts:30,75-78`)
-> one `integrationCalendarFeatureService.getEvents('<provider>:calendar.x')` per entity (`:109-119`)
-> `resolveProviderFeatureService` routes on the id prefix
   (`packages/app/src/services/integration-provider-service.ts:63-85`)
-> `mapCalendarSources` normalises raw records (`packages/app/src/hooks/device-mappers/map-calendar-device.ts:24-128`)
-> one aggregate device `<provider>:calendar.navet_overview` (`use-provider-calendar-devices.ts:187-197`)
-> `useSelectedProviderFeatureCollections` merges it into `devices.calendars` (`packages/app/src/hooks/use-devices.ts:312-359`)
-> `card-renderer.tsx:720-742` renders `<CalendarCard>`
-> `useCalendarCardSources` re-resolves by persisted selection and time window.

So `provider-icloud` must satisfy exactly four seams:

1. `entityRuntimeService.getEntitySnapshots()` returning keys prefixed `calendar.` - one entity per
   iCloud calendar collection, so each becomes a selectable source in the existing settings dialog.
2. `calendarFeatureService.getEvents(nativeEntityId, options?)`
   (`packages/core/src/provider-feature-services.ts:229-234`).
3. `featureMatrix.calendar: true` in its runtime registration.
4. A line in `use-devices.ts` (see gap 1).

`SmartHomeProviderAdapter` is structurally mandatory but never hand-written: reuse
`createSnapshotBackedProviderAdapter` with a throwing `executeCommand` and a stub
`getSession: () => ({ providerId: 'icloud' })`, exactly as `packages/provider-yr/src/yr-provider-registration.ts:21-29`
does. The stub session is what keeps `connect()` from throwing `ProviderAuthRequiredError`.

## Two gaps in the "zero UI changes" assumption

**Gap 1 - the calendar fan-out is a hardcoded provider list.** `use-devices.ts:325-351` instantiates
calendar collections for `home_assistant`, `homey`, `openhab` only. A new provider is invisible until
it is added. Copy the Yr precedent at `:343-347`: an `automatic` provider is enabled unconditionally,
not gated on `selectedProviderIdSet`, because it never enters provider selection.

**Gap 2 - the card resolves its sources from the current provider, not from its own id.**
`use-calendar-card-sources.ts:27` calls `useProviderCalendarDevicesCollection()` with no argument,
which defaults to `integrationStore.currentProviderId`. In this fork the only interactive provider is
Homey, whose feature matrix has `calendar: false`, so the collection comes back empty:

- the settings dialog would list no calendars to pick from,
- per-source colours would not be applied,
- `selectedEvents` silently falls back to the `events` prop (`:96-111`), which also bypasses the
  week/month window filter and the 7/12 slice.

Events would still render, so this fails quietly rather than visibly. Fix: resolve the provider from
the card id (`parseProviderScopedId(cardId)`), falling back to the current provider when absent. Two
lines, strictly better than today's behaviour for any multi-provider setup, and it does not add a
polling instance that upstream does not already create (`use-devices.ts` and the card each mount
their own collection hook today). Weather sidesteps this entirely by reading the merged `deviceMap`
(`packages/app/src/features/climate/components/climate-dashboard.tsx:84-88`), which is why Yr never
hit it. Needs a regression test - there is currently no test for `use-calendar-card-sources.ts`.

## Event payload contract

`PlatformCalendarEvent` is `Record<string, unknown>` (`packages/core/src/provider-feature-models.ts:68`),
so the real contract is what `map-calendar-device.ts:61-100` and
`packages/app/src/hooks/entity-utils/calendar-utils.ts:12-35` read. Emit Google/CalDAV-shaped records:

| field | source | notes |
|---|---|---|
| `uid` | VEVENT UID + recurrence start | **must be unique per occurrence** - expanded instances share one UID, and the mapper uses `uid` verbatim as the event id |
| `summary` | SUMMARY | mapper accepts `title\|summary\|message` |
| `description` | DESCRIPTION | accepts `description\|notes\|message` |
| `location` | LOCATION | optional |
| `start` / `end` | `{ dateTime: '<ISO with offset>' }` or `{ date: 'YYYY-MM-DD' }` | the `{date}` form is how all-day is detected (`calendar-utils.ts:28-35`) |

Caps worth knowing before tuning anything: 5 events per calendar
(`map-calendar-device.ts:117`), 12 in the merged aggregate (`use-provider-calendar-devices.ts:185`),
then 7 (week) or 12 (month) after window filtering (`use-calendar-card-sources.ts:130`). Events are
sorted before slicing, so returning more than ~25 per calendar is wasted payload.

The hook passes **no** `startDateTime`/`endDateTime`, so the service picks its own window. Home
Assistant defaults to 7 days (`packages/provider-homeassistant/src/homeassistant-calendar-feature.service.ts:32-35`);
use 31 days here so the card's month view has something to show.

## Sidecar responsibilities (Python, CalDAV)

The sidecar owns everything iCloud-shaped so neither njs nor the browser has to:

- **Discovery**: principal -> calendar-home-set -> collections, filtered to those whose
  `supported-calendar-component-set` contains `VEVENT` (drops reminder lists and subscribed
  birthday/holiday feeds unless wanted).
- **Recurrence expansion.** navet has none anywhere - grep for `rrule|recurrence|exdate` across
  `packages/` returns only chores. Home Assistant hands back pre-expanded occurrences, so the app
  assumes that. RRULE, EXDATE and `RECURRENCE-ID` overrides must all be honoured server-side, or
  cancelled and moved instances will show.
- **Normalisation**: local-offset ISO for timed events, `YYYY-MM-DD` for all-day, per-occurrence ids.
- **Polling with a last-good snapshot**: serve from memory, never fetch CalDAV per request. On auth
  failure keep serving the last snapshot and mark it stale rather than emptying the card.
- Endpoints: `/healthz`, `/calendar/calendars`, `/calendar/events?days=N`.
- Env: `NAVET_ICLOUD_APPLE_ID`, `NAVET_ICLOUD_APP_PASSWORD`, `NAVET_ICLOUD_CALENDAR_POLL_SECONDS`.
  Read by the Python process only - not by njs, so no `env` declarations in `nginx.main.conf` and no
  path by which they could reach `config.js`.

Cadence: sidecar poll 300s, app hook refresh 300s (`CALENDAR_EVENTS_REFRESH_INTERVAL`), so worst-case
staleness is ~10 minutes. Fine for a wall panel; CalDAV sync-tokens are a later optimisation.

Unverified assumptions to confirm against the live API in step 1, before any navet code is written:
iCloud still accepts app-specific passwords; `/.well-known/caldav` discovery redirect; whether
server-side `expand` in the REPORT is reliable or whether client-side expansion is needed.

## Transport

Prod follows the **RSS** shape, not the Yr shape: Yr uses `ngx.fetch` because its target is a fixed
public URL; ours is a local socket, which is what RSS already does.

`/__navet_icloud_proxy__/*` (public location, `js_content`) -> njs auth gate -> `r.subrequest` to an
`internal` location -> `proxy_pass` to `unix:/run/navet/icloud-sidecar.sock`.

The auth gate is the same three-way check used by every other proxy
(`docker/njs/yr-proxy.js:67-74`): `resolveAuthenticatedPrincipal` / `resolveHomeySession` /
`resolveOpenHABSession`, else `401 {"error":"Authentication required"}`.

Dev: a vite plugin forwarding to `http://127.0.0.1:8091` (uvicorn). **This avoids the duplication Yr
has** - `docker/njs/yr-proxy.js` and `scripts/vite-yr-proxy-plugin.ts` are near line-by-line twins
because each reimplements the met.no call. Here all logic is in Python, so both sides are dumb
forwarders plus the shared auth check.

Wiring checklist:

1. `docker/integrations-sidecar/` (FastAPI, uvicorn `--uds`)
2. `docker/njs/icloud-proxy.js` + `docker/snippets/navet-icloud-proxy.conf` +
   `navet-icloud-backend.conf` (`internal`, `proxy_pass_request_headers off`, mirroring
   `navet-rss-transport.conf:2-15`)
3. `js_import` in `docker/nginx.main.conf`; include the snippet in `docker/nginx.conf` (the one that
   actually ships) and, for consistency, `nginx.no-proxy.conf` / `nginx.proxy.conf.template` (those
   two are read only by `packages/app/src/pwa/standalone-manifest-http-config.test.ts`)
4. `Dockerfile`: a `python:3.12-alpine` builder stage; `lxml` needs gcc/musl-dev/libxml2-dev/libxslt-dev
5. `docker/navet-runtime.sh`: a third supervised child. It is hardcoded to two - two PID variables, one
   socket-readiness poll, a two-PID watch loop (`:6-52`). Generalising it to an N-child list is the
   elegant version and keeps the next sidecar free.
6. `scripts/vite-icloud-proxy-plugin.ts` + registration in `apps/standalone/vite.config.ts`
7. `.env.example`

Home Assistant add-on: out of scope, same as Yr. See the follow-up below - it is not merely
unsupported there, it is currently broken.

## Registration checklist

- `packages/core/src/integration-providers.ts`: add `'icloud'` to `INTEGRATION_PROVIDER_IDS` and
  `IMPLEMENTED_INTEGRATION_PROVIDER_IDS`, plus an `INTEGRATION_PROVIDERS` entry
  (`label: 'iCloud Calendar'`, `implementationStatus: 'implemented'`, `loginMode: 'automatic'`, all
  four `supports*: false`). Ordering is safe: `resolveInitialCurrentProviderId`
  (`stores/integration-store.ts:122-127`) only considers providers that have an auth session, and an
  automatic provider never gets one.
- Six exhaustive sites break compilation and must be filled:
  `features/auth/login-page.tsx:107-140` (reuse `login.providers.automatic.detail`, no new i18n key),
  `features/settings/components/settings-system-section.tsx:70-83`,
  `provider-package-registry.ts:25-47`, and the three label switches
  (`components/layout/room-order-dialog.tsx:36-51`,
  `features/dashboard/rooms/use-room-workspace-controller.ts:126-141`,
  `services/integration-admin.service.ts:25-40`).
- Do **not** add `icloud` to `AUTH_SESSION_PROVIDER_IDS` (`auth/types.ts:58-62`). Automatic providers
  are deliberately absent, which is what keeps them out of the login UI and the session map.
- Build plumbing: `tsconfig.json` paths, `vitest.unit.config.ts` alias,
  `scripts/vite-host-conventions.ts:57-70`.
- `packages/app/src/hooks/use-devices.ts`: the calendar fan-out line (gap 1).
- Tests: update `services/__tests__/integration-registry.service.test.ts:63-84` (asserts the exact
  ordered provider lists) and add `packages/provider-icloud/src/icloud-provider-registration.test.ts`
  using `runProviderPackageRegistrationTests` - `provider-yr` skipped this; close the gap here.
- i18n: no new keys unless iCloud grows its own settings UI. It should not need one - credentials are
  server-side and calendar selection reuses the existing per-card dialog.

## Package shape (mirrors provider-yr, 1:1)

`icloud-provider-registration.ts` (entry, contract + package registration), `icloud-runtime-registration.ts`
(feature matrix with `calendar: true`, `entityRuntimeService`, `calendarFeatureService`),
`icloud-contract.ts` (bootstrap/init/teardown + state), `icloud-snapshot.ts` (module-level polling
store producing `calendar.<slug>` snapshots and `NavetEntity[]` of type `calendar`),
`icloud-calendar-feature.service.ts`, `icloud-client.ts` (proxy fetch with a TTL cache),
`icloud-types.ts`, `index.ts`, plus unit tests.

Two details to copy verbatim from `yr-snapshot.ts`:

- The **auth race retry ladder** (`:19`, `ERROR_RETRY_DELAYS_MS = [5s, 15s, 30s, 60s]`). The proxy
  401s until a provider session exists, and the first refresh reliably loses that race.
- Referentially stable snapshots between refreshes - `useSyncExternalStore` requires it.

One cache in `icloud-client.ts` fetching `/calendar/events` once and slicing per entity keeps the
four-calendars case at one HTTP call per refresh cycle instead of four.

## Build and verify, in order

1. **CalDAV outside navet.** Run uvicorn locally, `curl localhost:8091/calendar/events`, confirm real
   events including a recurring series, an all-day event and a moved instance. No navet code yet.
2. **Python unit tests** for the iCal -> JSON mapping: recurrence expansion, EXDATE, `RECURRENCE-ID`
   override, all-day, timezone offsets, per-occurrence id uniqueness.
3. **`packages/provider-icloud` + registration + gaps 1 and 2**, against the dev server with the vite
   plugin pointed at local uvicorn. Verify: calendars appear as selectable sources in the card's
   settings dialog, selection persists, week/month filtering works, colours differ per calendar.
   Note the dev server needs `navet.local` in `/etc/hosts` and an authenticated session for the proxy.
4. **Docker**: sidecar in the image, nginx wiring, three-process supervision, crash-restart behaviour,
   auth/no-auth proxy behaviour. Then the built image, not just `pnpm dev`.
5. **Suite**: `pnpm typecheck`, `pnpm lint`, `check:provider-boundaries`, `check:i18n`,
   `check:stories`, unit tests.

## Risks and follow-ups

- **Another session is editing this worktree right now.** `Dockerfile`, `docker/nginx.conf`,
  `docker/nginx.main.conf`, `apps/standalone/vite.config.ts` and new `entur-proxy` files are dirty
  with transit work that was not there at the start of this session. Those are exactly the files the
  calendar transport touches. Land transit first, or do calendar on its own worktree.
- **The add-on image is currently broken by the Yr branch.** `docker/nginx.conf:262` includes
  `navet-yr-proxy.conf`, and that file is copied into the add-on image by nothing
  (`platform/home-assistant/addons/navet/Dockerfile:81-93`); `run.sh:349-367` awk-transforms the same
  template without dropping the include. nginx fails to load a missing include. The entur include at
  `:263` compounds it. Worth fixing before adding a third.
- **Day grouping uses the UTC date** (`use-calendar-data.ts:25`, `toISOString().slice(0,10)`) while
  headers render from local date parts. In UTC+2 an event between 00:00 and 02:00 local is bucketed
  under the previous day. Pre-existing, affects Norway, small fix in `groupEventsByDay`, out of scope
  here but worth its own commit.
- `CalendarDevice`'s event type (`types/device.types.ts:303-316`) does not declare `startDateTime`,
  `endDateTime`, `isAllDay` or `description`, although the mapper emits them and the visibility logic
  depends on them; `card-renderer.tsx:726-736` casts them away. Do not rely on that type as the
  contract - `map-calendar-device.ts` is the real one.
- App-side error handling is silent: `getEvents` failures are swallowed per entity
  (`use-provider-calendar-devices.ts:112-115`) and the collection keeps its previous data. A dead sidecar
  looks like a quiet, stale card. The sidecar's stale flag has nowhere to surface today.
