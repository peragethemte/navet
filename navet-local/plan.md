# Navet: add Calendar, Reminders, Yr.no weather, Østfold transit (Tesla already solved)

## Context

Building a Raspberry Pi home dashboard, all on **one single dashboard view** (explicit requirement -
nothing should fragment into a separate nav-level page the way navet's existing "chores" feature
does). Found "navet" (github.com/awesomestvi/navet), a free open-source dashboard that already has
a mature native Homey provider - Homey devices are solved out of the box. The user is currently
running a **prebuilt navet Docker image with no local source clone** - there is nothing to
fork/modify yet.

navet is a provider-neutral smart-home aggregator: real hubs (Home Assistant/Homey/openHAB)
implement a `SmartHomeProviderAdapter` contract. Two domains - Calendar and Weather - have an
additional optional per-provider "feature service" slot on top of that, which any provider
(including a new thin one) can implement to render through navet's *existing* dedicated UI for that
domain. Other external data (RSS feeds, the built-in "chores" tracker) bypasses the provider system
entirely as standalone dashboard-grid widgets (`CardType` union + `widget-card.tsx` switch, config
in the client-side `customCards` store).

Final data-source decisions, each verified against the actual navet code before locking in:

- **Tesla**: solved for free, zero navet code. Install Homey's "Tesla Car & Energy" community app
  on the existing Homey Pro. navet's Homey entity mapper already turns any `measure_*`/`meter_*`/
  `alarm_*` capability into a sensor entity regardless of device class - `measure_battery` is even
  special-cased with a "Battery" label.
- **Calendar** (Apple/iCloud, via CalDAV) reuses navet's existing `CalendarCard` UI. Confirmed:
  `CalendarCard` takes provider-neutral `CalendarEvent[]` data with zero HA-specific code, and
  there's a clean `ProviderCalendarFeatureService.getEvents()` interface any provider can implement
  - Homey/openHAB already declare `calendar: false`, proving it's pluggable, not baked in. New thin
  `packages/provider-icloud` package, no new widget.
- **Weather** (Yr.no/met.no) reuses navet's existing `WeatherCard` UI via the same pattern -
  `ProviderWeatherFeatureService.getForecast()`, optional `weatherFeatureService` slot, `weather`
  feature-matrix flag (Homey/openHAB declare `weather: false`, HA declares `weather: true`). New
  thin `packages/provider-yr` package. **Unlike Calendar, this needs a real adapter layer**: the
  shared `map-weather-device.ts` mapper is tightly bound to Home Assistant's own attribute
  vocabulary (`native_temperature`, `cloud_coverage`, `templow`, HA's condition-string enum,
  `weather.`/`sun.` entity-ID prefixes) with almost no generic fallbacks - `provider-yr` must
  synthesize entities and forecast entries shaped exactly like HA's, translating met.no's own
  condition/symbol codes into HA's condition vocabulary. Also: no lat/lon config concept exists
  anywhere in the weather path today - `provider-yr` needs its own coordinate config (env vars).
- **Reminders and Transit are independent standalone widgets** (explicit decision) - there is no
  existing todo/reminders or transit rendering anywhere in navet to reuse, so each gets its own new
  `CardType`, its own widget component, and **its own dedicated settings/config UI** (not shared),
  modeled on the RSS widget's settings-tab pattern.
- Apple Calendar and Reminders share one iCloud session (Apple ID + app-specific password): Calendar
  via CalDAV (`caldav` lib), Reminders via CloudKit web API (`pyicloud`/`pyicloudreminders` - Apple
  moved Reminders off CalDAV in iOS 13+, so CalDAV alone doesn't cover it). This is genuinely
  Python-only auth (stateful session/cookies) - njs cannot do it.
- Østfold buses: Entur's public JourneyPlanner v3 GraphQL API (`api.entur.io/journey-planner/v3/graphql`),
  free, no auth beyond an `ET-Client-Name` header - a plain JSON call, no Python needed.
- Yr.no/met.no's `locationforecast` API is also a plain JSON call, no auth - but their usage policy
  requires a proper identifying `User-Agent` header, which browser JS cannot set on `fetch()`, so it
  still needs a same-origin relay (just not a Python one).

## Recommended approach

**Step 0 - project setup.** Fork `awesomestvi/navet` on GitHub under the user's account and clone
it locally to `/Users/perage/dev/Privat/navet` as the real working repo. Nothing below can be built
against a prebuilt image with no source.

**Split the backend work by what actually needs Python vs. what's a plain JSON call:**

- **Python sidecar** (only for Calendar + Reminders): one new supervised FastAPI process inside
  navet's existing single container - not a new Docker Compose service. navet's `docker-compose.yml`
  defines exactly one `navet` service; the only existing precedent for "logic njs can't run" is
  `docker/rss-transport/main.go`, a Go process supervised alongside nginx by `docker/navet-runtime.sh`,
  reached only via an nginx `internal` location over a Unix socket (this also matters because navet
  ships as a one-container-per-add-on Home Assistant Supervisor add-on - a Compose sidecar wouldn't
  translate there). The new Python process follows the same shape, scoped down to just the two
  sources that genuinely need Python's iCloud libraries.
- **Transit and Weather need no Python at all** - both are plain external JSON APIs needing only a
  fixed header set server-side. Each gets a small, purpose-built njs proxy module (simpler than the
  RSS proxy - fixed trusted target, no arbitrary-URL SSRF guard needed), not routed through the
  Python sidecar.

**Frontend - two different reuse patterns, both landing on the one dashboard view:**
- **Calendar & Weather**: thin provider packages (`packages/provider-icloud`, `packages/provider-yr`)
  implementing the existing `ProviderCalendarFeatureService`/`ProviderWeatherFeatureService`
  interfaces. Zero new UI - renders through the existing `CalendarCard`/`WeatherCard`, same
  widget-grid/device-group mechanism already used for every other provider's calendar/weather data.
- **Reminders and Transit**: two new `CardType` widgets, modeled directly on the RSS widget - own
  component under `packages/app/src/features/integrations/`, own settings tab (list picker for
  Reminders; stop-ID input + departure-count pills for Transit, mirroring
  `rss-setup-tab-content.tsx`), config stored in the existing `customCards` localStorage blob. These
  do **not** go through the provider/entity system - same reasoning as RSS/chores.

No changes to `@navet/core`'s `SmartHomeProviderAdapter` semantics beyond the two new thin providers'
own packages. Secrets (Apple ID + app-specific password) live only in the sidecar's environment -
never in navet's client-side code or localStorage.

Scope: **standalone Docker deployment only** (root `Dockerfile`, `docker-compose.yml`, `docker/`).
The HA Supervisor add-on has a separate Dockerfile/nginx tree - out of scope, flagged as a
follow-up if that deployment path is ever needed.

## Critical files

**Python sidecar** (Calendar + Reminders only) - `docker/integrations-sidecar/` (sibling of
`docker/rss-transport/`):
- `app/main.py` - FastAPI app, uvicorn entrypoint over a Unix socket (`--uds`)
- `app/calendar_source.py` - CalDAV background poll loop (default 300s), in-memory snapshot
- `app/reminders_source.py` - iCloud Reminders background poll loop (default 120s), shares the
  calendar module's iCloud session, re-login on auth failure
- Endpoints: `/healthz`, `/calendar/calendars`, `/calendar/events?days=N`, `/reminders/lists`,
  `/reminders/items?list=<id>`
- Env vars (matches existing `NAVET_<INTEGRATION>_<FIELD>` convention, e.g. `NAVET_HOMEY_CLIENT_ID`):
  `NAVET_ICLOUD_APPLE_ID`, `NAVET_ICLOUD_APP_PASSWORD` (secret), `NAVET_ICLOUD_CALENDAR_POLL_SECONDS`,
  `NAVET_ICLOUD_REMINDERS_POLL_SECONDS` - add to `.env.example`

**Docker/nginx wiring:**
- `docker/navet-runtime.sh` - extend to supervise a 3rd process (start/socket-wait/kill-watch/cleanup
  alongside nginx + rss-transport)
- Root `Dockerfile` - new `python:3.12-alpine` builder stage (needs gcc/musl-dev/libxml2-dev/
  libxslt-dev for `lxml`, a `caldav` dependency), copy deps into the final `nginx:1.27-alpine` stage
- `docker/njs/integrations-proxy.js` - new, proxies to the Python sidecar; reuses the existing
  3-way auth check already used by `rss-proxy.js`/`chore-store.js`
  (`authStore.resolveAuthenticatedPrincipal` / `homeyStore.resolveHomeySession` /
  `openhabStore.resolveOpenHABSession`)
- `docker/njs/external-data-proxy.js` - new, separate lightweight module for Transit (Entur) and
  Weather (met.no): fixed trusted targets, sets `ET-Client-Name` / `User-Agent` server-side, no
  Python involved, same auth check reused for consistency
- `docker/snippets/navet-integrations-backend.conf` + `navet-integrations-proxy.conf` +
  `navet-external-data-proxy.conf` - new, mirror the existing `navet-rss-transport.conf` /
  `navet-rss-proxy.conf` pair
- Wire `js_import` into `docker/nginx.main.conf`; include the new proxy snippets in `docker/nginx.conf`,
  `docker/nginx.proxy.conf.template`, `docker/nginx.no-proxy.conf` (same 3 places RSS is included)

**Calendar (provider path):**
- `packages/provider-icloud/src/` (new package) - session bootstrap, `listEntities()`/`getEntity()`
  returning `calendar.*` entities, `icloud-calendar-feature.service.ts` implementing
  `ProviderCalendarFeatureService.getEvents()` against the sidecar's `/calendar/events`
- Register in `packages/core/src/integration-providers.ts` (`INTEGRATION_PROVIDER_IDS`) and wire
  `calendarFeatureService` + `featureMatrix.calendar: true`
- No changes needed to `CalendarCard`/`use-calendar-data.ts`/`card-renderer.tsx`'s `calendars`
  device-group case - confirm existing calendar settings/filtering UI already surfaces the new
  iCloud entities correctly before assuming any UI work is needed here.

**Weather (provider path):**
- `packages/provider-yr/src/` (new package) - config for lat/lon + location label (env vars, no
  existing UI concept for coordinates to reuse), `yr-weather-feature.service.ts` implementing
  `ProviderWeatherFeatureService.getForecast()` against met.no's `locationforecast` API via the
  `external-data-proxy`
- `condition-mapping.ts` - translates met.no's symbol codes into Home Assistant's condition-string
  vocabulary (`clear-night`, `partlycloudy`, `lightning-rainy`, `snowy-rainy`, `windy-variant`, etc.
  - unmapped values still render via `weather-icon.tsx`'s title-cased fallback, so this degrades
  gracefully, doesn't need to be exhaustive on day one)
- Entity/forecast synthesis matching `map-weather-device.ts`'s expected field names exactly:
  `native_temperature`, `cloud_coverage`, `templow`, forecast entries with `datetime`/`condition`/
  `temperature`/`templow`/`precipitation_probability`, plus a companion `sun.*` entity with
  `next_rising`/`next_setting` for sunrise/sunset
- Register alongside `provider-icloud` in `integration-providers.ts`, `weatherFeatureService` +
  `featureMatrix.weather: true`

**Reminders and Transit (standalone widget path):**
- `packages/app/src/features/dashboard/stores/custom-cards-store.ts` - add `'reminders' | 'transit'`
  to the `CardType` union
- `packages/app/src/features/integrations/{reminders,transit}-widget/` - new widget components,
  each with its own settings tab (list picker for Reminders; stop-ID + count for Transit), modeled
  on `packages/app/src/features/rss/components/rss-feed-card/rss-setup-tab-content.tsx`
- `packages/app/src/features/dashboard/components/widget-card.tsx` - 2 lazy imports + `switch` cases
- `packages/app/src/features/dashboard/components/add-entity-dialog/templates.tsx` - 2 new template
  entries with icons, same pattern as `BatteryIcon`/`UpsIcon`
- `packages/app/src/i18n/messages/en.ts` - new keys, other locales fall back to English initially
- `scripts/vite-integrations-proxy.ts` + `scripts/vite-external-data-proxy.ts` (new) +
  `apps/standalone/vite.config.ts` - dev-mode proxy plugins modeled on `rssProxyPlugin`, since nginx
  doesn't run under `pnpm dev`

## Implementation steps (build and verify incrementally)

0. Fork navet on GitHub, clone to `/Users/perage/dev/Privat/navet`, confirm
   `pnpm install && pnpm dev` runs the existing app unmodified before touching anything.
1. **Weather first** (no Python, no sidecar, fastest path to a visible win): `external-data-proxy`
   njs module for met.no + `packages/provider-yr` with the HA-shaped adapter layer. Verify:
   `WeatherCard` renders real Østfold-area forecast data in `pnpm dev`, condition icons resolve
   correctly.
2. **Transit**: extend `external-data-proxy` for Entur + the standalone Transit widget (CardType,
   component, settings tab). Verify against a real Østfold stop ID, cross-checked against a real
   departure board.
3. Sidecar skeleton + Calendar fetcher only, run locally with `uvicorn --port 8091` outside Docker.
   Verify: `curl localhost:8091/calendar/events` returns real iCloud data - proves CalDAV auth
   before touching Docker/nginx at all.
4. Wire the sidecar into the container + nginx (Calendar endpoint only) + `packages/provider-icloud`.
   Verify: iCloud calendars appear in the existing `CalendarCard` UI, auth/no-auth proxy behavior
   is correct, all supervised processes restart correctly on crash - then again against the built
   Docker image.
5. Add Reminders fetcher to the sidecar + the standalone Reminders widget. Verify Reminders renders
   correctly and Calendar still works unaffected.
6. Docs: confirm `.env.example` is complete; check whether `README.md`/`docs/HOME_ASSISTANT.md` need
   a short mention.

## Tesla verification (no build step)

Install Homey's "Tesla Car & Energy" app, pair the car, open navet, confirm a "Battery" sensor
entity appears with no code changes - sourced from the generic capability pass in
`packages/provider-homey/src/homey-mappers.ts` (~lines 203-224) plus the "Battery" label special-case
in `homey-sensor-state.ts`. If a follow-up capability (e.g. charging state) is wanted later and
doesn't match the `measure_`/`meter_`/`alarm_` prefixes, it's a one-line addition to that same
prefix check.

## One-dashboard check

Every new source lands on the same primary dashboard view, none creates a separate nav page like
chores does: Calendar and Weather render as device-group entities on the main dashboard grid (same
mechanism as every other provider's entities), Reminders and Transit render as widgets a user adds
to that same grid, and Tesla is just another Homey entity on that grid too.

## Out of scope / follow-ups

- Home Assistant Supervisor add-on variant of navet has its own Dockerfile/nginx tree - not wired
  up by this plan; revisit only if the add-on deployment path is ever used.
- Homey capability allowlist extension for Tesla charging-state/range display beyond plain battery %.
- met.no condition-code mapping table can start partial (common conditions) and be extended later -
  unmapped codes degrade gracefully rather than breaking.
