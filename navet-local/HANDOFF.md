# Handoff — personal navet fork

Working notes for this fork. Not upstream documentation: everything in `navet-local/` is local to
this fork and deliberately kept out of `docs/` so it never lands in the published docs site or
conflicts with upstream.

- `plan.md` — the approved plan (copy of `~/.claude/plans/hidden-sparking-cook.md`)
- `entur-api-spec.md` — Entur API reference, verified against the live API 2026-09-22

## Goal

A wall-mounted Raspberry Pi dashboard showing, on **one single dashboard view** (no separate nav
pages like the built-in chores feature): Homey devices, Tesla battery, Apple Calendar, Apple
Reminders, Yr.no weather, and Østfold bus departures.

## State

Two stacked feature branches, neither pushed nor merged. `feature/settings-location-section` is
built on top of `feature/yr-weather-provider`.

| Piece | Status |
|---|---|
| Homey devices | Works out of the box (upstream `packages/provider-homey`) |
| Tesla battery | No code needed — see below |
| Yr.no weather | Done, `feature/yr-weather-provider` |
| Settings section + weather location | Done, `feature/settings-location-section` |
| Østfold transit | Not started — next |
| Apple Calendar + Reminders | Not started — last, and the heaviest |

Verified on both branches: `pnpm typecheck`, `pnpm lint`, `check:provider-boundaries`,
`check:i18n`, `check:stories`, plus the full unit suite. Weather was additionally verified
end to end in a real built Docker container, not just `pnpm dev`.

### Tesla needs no code

Install Homey's "Tesla Car & Energy" app and pair the car. navet's Homey mapper already turns any
`measure_*`/`meter_*`/`alarm_*` capability into a sensor entity regardless of device class, and
`measure_battery` is special-cased with a "Battery" label
(`packages/provider-homey/src/homey-mappers.ts`, `homey-sensor-state.ts`). If a non-numeric
capability is wanted later (charging state), it's a one-line addition to that prefix check.

## Decisions already made

- **No Home Assistant.** Rejected deliberately: it would mean running and maintaining a whole extra
  service purely to relay data. Weather/transit talk to their APIs directly; Calendar/Reminders will
  go through a small Python sidecar.
- **`loginMode: 'automatic'`** (new variant in `packages/core/src/integration-providers.ts`) for
  providers configured server-side with no interactive login. Yr uses it; the iCloud provider should
  reuse it. This also fixed a latent bug — `authenticated-app.tsx` was filtering sessions with
  `isImplementedIntegrationProviderId`, conflating "has a runtime registration" with "participates
  in the auth-session pipeline". Those sets were identical until Yr existed.
- **Calendar reuses the existing `CalendarCard`**, via `ProviderCalendarFeatureService.getEvents()`
  — same pluggable seam Weather used. No new calendar UI.
- **Reminders and Transit are standalone widgets** with their own settings, because navet has no
  existing todo or transit rendering to reuse.
- **Settings section is `local` / "Lokale tjenester" / "Local services"** — named to hold
  place-bound external data sources, so transit journeys land there without a rename. Avoided
  "Posisjon"/"Location", which reads confusingly next to the existing "Lokalisering" (language and
  units).
- **Weather location persists to the shared synced profile**, not per-device, matching the sibling
  `weatherForecastMode`/`weatherMetricIds` settings. Env vars remain as fallback defaults so
  existing Docker deploys keep working.
- **Transit journeys are modelled as "arrive by", not "depart after"** (decided 2026-09-22).
  Entur's trip query takes `arriveBy: true`. "Be at school by 08:00" is the question actually
  being asked; the departure times fall out of the answer, while the reverse does not hold.

## Transit design (agreed, not built)

Journeys are configured centrally in the Local services settings section, not per-card:

- Each journey: name, from/to (Entur place search), active time window (e.g. 06:30–08:00), and
  **days of week** — without days, Friday evening would show Saturday's school bus.
- The card shows currently-active journeys ordered by next departure; when nothing is active
  (evening), it rolls forward to the next upcoming one.
- Show 2–3 alternatives per journey.

### Live vehicle tracking is available, but deliberately out of scope for v1

Entur has a second API for live bus positions (`realtime/v1/vehicles`, section 5 of
`entur-api-spec.md`) - verified working for Østfold, 145 tracked vehicles, with position,
bearing, delay, occupancy and congestion, joinable to a trip leg on `serviceJourney.id`, and
available as a websocket subscription.

It is not needed for the school-run card: **the trip query already carries the realtime delay**
via `fromEstimatedCall`, so lateness is covered without it. What vehicle positions would add is
a map marker or a "two stops away" indicator. The catch is that a vehicle only enters the feed
once its journey is under way, so for the departure the user is waiting for the marker is empty
exactly when they would look at it. Revisit only if a map view is wanted later.

Read `entur-api-spec.md` before implementing. Two findings there would otherwise ship broken:
the geocoder endpoints most people would reach for are **deprecated**, and passing a partial `modes`
argument silently nulls `accessMode`/`egressMode`, producing a plausible-looking 2h50m route instead
of the real 20-minute one.

## Gotchas when picking this up

- **`navet.local` must resolve.** The dev server hardcodes `host: 'navet.local'`
  (`apps/standalone/vite.config.ts`) for cookie/session scoping, and fails to start otherwise.
  `/etc/hosts` needs `127.0.0.1 navet.local`. Note `CONTRIBUTING.md` is stale here — it still says
  `localhost:5173`. Dev server runs at http://navet.local:5200/.
- **Server-side proxies are auth-gated.** `/__navet_yr_proxy__/*` returns
  `{"error":"Authentication required"}` until a provider session exists — by design, same as RSS.
  Testing weather/transit needs a logged-in session; previous sessions used a throwaway fake
  openHAB REST server for this.
- **`AGENTS.md` is authoritative** for this codebase and has a task-router table — read the one
  routed guide for the area being changed, not all of them. `@navet/core` must not import React or
  provider SDKs; provider packages must not import app services or stores. Enforced by
  `pnpm check:provider-boundaries`.
- **i18n covers 13 locales** and `check:i18n` enforces it. Norwegian matters most here — translate,
  don't just add English and let it fall back.
- This is a **personal fork**, so the upstream `/navet implement` bot workflow in
  `docs/engineering/agentic-development.md` does not apply.
