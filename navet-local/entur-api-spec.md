# Entur API reference (verified live 2026-09-22)

All findings below were verified with real curl requests against the live APIs, not inferred from
docs. Where something contradicts an obvious-looking assumption, it is flagged.

No auth required (NLOD open data). OAuth2 is for partner APIs only.

## Required header

`ET-Client-Name: <company>-<application>` — use `pearlgroup-navet`.
Docs examples: `brakar-journeyplanner`, `fosen_utvikling-infoplakat`.
Not enforced (requests return 200 without it) but Entur reserves the right to block unidentified
consumers. **Send it on geocoder calls too**, not just JourneyPlanner.

## Rate limits (from live response headers)

| Service | allowed | window |
|---|---|---|
| JourneyPlanner | `rate-limit-allowed: 1000` | `rate-limit-range: PT2M` |
| Geocoder | `rate-limit-allowed: 1000` | `rate-limit-range: "per-minute"` |

Also returned: `rate-limit-used`, `rate-limit-available`, `rate-limit-expiry-time`.
The two services report their window differently — parse `rate-limit-range`, don't assume.
Polling 4 journeys per minute is ~0.4% of budget. Not a constraint in practice.

## 1. Geocoder — place search for the settings UI

**v1/v2 were deprecated 2026-06-12. Use v3.** Params were all renamed:
`text`→`q`, `size`→`limit`, `focus.point.lat`/`.lon`→`lat`/`lon`, `focus.scale`→`radius` (km,
default 50), `boundary.county_ids`→`counties`. New: `bbox` (hard filter), `fareZones`.

Docs: https://developer.entur.no/docs/open-services/geocoder

```
curl -H "ET-Client-Name: pearlgroup-navet" \
  "https://api.entur.io/geocoder/v3/autocomplete?q=Gre%C3%A5ker&limit=5&layers=stopPlace&counties=KVE:TopographicPlace:31"
```

Real response (abbreviated):
```json
{"properties":{"id":"NSR:StopPlace:2545","names":{"default":"Greåker","display":"Greåker, Sarpsborg"},
 "layer":"stopPlace","source":"nsr","address":{"locality":"Sarpsborg","county":"Østfold",
 "countyId":"KVE:TopographicPlace:31","countryCode":"no"},"fareZones":["OST:FareZone:3"],
 "transportModes":[{"mode":"bus"}],"stopPlaceTypes":["onstreetBus"],"stopPlaceRole":"standalone"}}
```

- **Persist `properties.id`** (e.g. `NSR:StopPlace:2545`). Feed straight into the trip query as
  `from: {place: "NSR:StopPlace:2545"}`. No coordinates needed.
- `layers=stopPlace` restricts to stops (v2's confusing venue/address split is gone).
- `counties=KVE:TopographicPlace:31` is Østfold. **Use this, not the lat/lon focus point** — focus
  bias is weak: a "skole" search centred on Sarpsborg still returned Kongsberg and Asker first.
- `GET /v3/place?ids=NSR:StopPlace:2719,NSR:StopPlace:2952` resolves saved IDs back to display
  names — use it to render already-configured journeys without re-searching.

## 2. Trip query — the journey board

Endpoint: `https://api.entur.io/journey-planner/v3/graphql`

Variables shape that works:
```json
{"from":{"place":"NSR:StopPlace:2952"},"to":{"place":"NSR:StopPlace:2719"},
 "dt":"2026-09-23T06:30:00+02:00","n":3}
```

- `dateTime`: ISO 8601 **with offset**. `arriveBy: false` = "depart after". `arriveBy: true` flips
  to "arrive by" — worth considering, since "be at school by 08:00" may model the real intent
  better than "leave after 06:30".
- `numTripPatterns: 3` is right for this dashboard. `searchWindow` (minutes, e.g. 180) bounds
  lookahead.

### CRITICAL: the `modes` argument

The `Modes` input type has **no schema-level defaults** — introspection confirms every field is
`defaultValue = None`. The resolver only applies foot access/egress when `modes` is omitted
**entirely**. Pass a partial `modes` object and `accessMode`/`egressMode` silently become null,
so the planner won't walk from the origin stop or to the destination stop.

This fails silently with plausible-looking garbage rather than an error. Same stop pair, same minute:

```
modes: {directMode: null}                                     -> 1 pattern:  12:50, 2h50m, bus/1 > foot > bus/600
modes: {accessMode: foot, egressMode: foot, directMode: null} -> 3 patterns: 11:50 bus/1, 12:00 bus/1, 12:10 bus/132
(no modes argument at all)                                    -> 3 patterns: identical to above
```

**Rule: if you pass `modes` at all, always spell out `accessMode: foot` and `egressMode: foot`.**
That combination is equivalent to the default on normal pairs and additionally removes the pure-walk
itinerary on close pairs.

### Filter params that do NOT work

- `maximumTransfers`: on a close pair, both `0` and `1` returned *only* the walk-only pattern.
  Leave unset.
- `maxDirectDurationForMode`: takes an ISO 8601 Duration **string** (`[{streetMode: foot,
  duration: "PT0S"}]`); `duration: 0` errors with `Expected type 'Duration' but was 'IntValue'`.
  It does remove walk-only itineraries but surfaces worse bus-foot-bus-foot patterns instead.
  Not the right tool.

**Belt and braces:** send `modes: {accessMode: foot, egressMode: foot, directMode: null}` AND
drop any tripPattern client-side where every leg has `mode == "foot"`. One line, survives the next
routing-engine change.

### Noise is not a problem in practice

For the real 5.5 km school pair (Sarpsborg bussterminal → Greåker vgs.), 5 of 5 patterns were clean
single-bus options, zero walk-only junk. Walk-only noise only appeared when forcing two stops 950 m
apart.

Real result (abbreviated):
```
06:30 -> 06:51  dur 1297s  walk 949m  bus 1 "Glomma vest" q3 -> frontText "Fredrikstad 109", then foot
06:38 -> 06:59  dur 1297s  walk 949m  bus 1 ...
07:08 -> 07:25  dur 1020s  walk 0m    bus 1, then bus 153 -> "Greåker vgs."
```

Note alternatives are **not interchangeable** — two involve a 949 m walk and one doesn't, differing
by 4 minutes. Render `walkDistance` on the card.

### Field paths for a compact display

- `tripPatterns[].expectedStartTime` / `.expectedEndTime` / `.duration` (**seconds**) /
  `.walkDistance` (metres)
- `tripPatterns[].legs[].mode`
- `legs[].line.publicCode` — the bus number
- `legs[].fromPlace.quay.publicCode` — platform (e.g. "3"); **can be an empty string**
- `legs[].fromEstimatedCall.destinationDisplay.frontText`
- Transfers = count of transit legs minus 1

## 3. Trip query vs stop departures — use the trip query

`stopPlace { estimatedCalls }` was considered as a simpler alternative. Use `trip` instead:

1. **It gives arrival time.** For a school run the real question is "does he get there by 08:15",
   not just "when does the bus leave". `expectedEndTime` answers it; `estimatedCalls` cannot.
2. **It matches the config model** — user picks from-stop and to-stop, which is literally the trip
   query's input. Stop-departures would force picking a stop *and* a line.
3. **Less brittle.** Stop-departures needs a pinned line ID like `OST:Line:1_1` in saved config; if
   Østfold re-contracts the route that silently returns nothing. The trip query re-plans each call
   and self-heals. Related: ServiceJourney IDs are definitively volatile —
   `OST:ServiceJourney:12_260325121472874_35` embeds a dated timetable version, so anything
   persisted at that granularity will rot.
4. The noise concern that would have justified the simpler approach doesn't materialise (above).

Keep `estimatedCalls` in mind only for a possible future "what's leaving my nearest stop" widget.
Note its line-filter arg is `filters`, **not** `whiteListed` (that exists only on `trip`).

## 4. Real-time data

Live evidence: aimed `11:25:00` vs expected `11:34:55` (a 9m55s delay).

- **Delay** = `expectedDepartureTime` − `aimedDepartureTime` (both ISO 8601 with offset)
- `realtime`: Boolean — live prediction vs timetable
- `realtimeState`: `scheduled` | `updated` | `canceled` | `Added` | `modified`
- `cancellation`: Boolean — render strikethrough
- `predictionInaccurate`: Boolean — show time as approximate
- On `trip` these live at `tripPatterns[].legs[].fromEstimatedCall.*`, which is **null on walking
  legs** — must null-guard.

**Future dates carry no real-time.** Tomorrow 06:30 returns `realtime: false`,
`realtimeState: "scheduled"`. Do not show a live indicator on the evening roll-forward to
tomorrow's departures.

## 5. Vehicle positions - live bus tracking

A **separate API** from JourneyPlanner, verified live 2026-09-22 12:54 local. Same open data, same
`ET-Client-Name` header, no auth.

- Poll: `POST https://api.entur.io/realtime/v1/vehicles/graphql`
- Push: `wss://api.entur.io/realtime/v1/vehicles/subscriptions`, subprotocol
  `graphql-transport-ws` (verified: HTTP 101 on upgrade; the plain `/graphql` path returns 400 and
  does not upgrade). The `subscription { vehicles }` field takes the same filters plus `bufferSize`
  and `bufferTime`.

Root queries: `vehicles`, `lines(codespaceId)`, `codespaces`, `serviceJourney(id)`,
`serviceJourneys(lineRef)`, `operators(codespaceId)`.

`vehicles` filters: `serviceJourneyId`, `lineRef`, `lineName`, `vehicleId`, `operatorRef`,
`codespaceId`, `mode`, `monitored`, `boundingBox`.

`VehicleUpdate` fields: `location{latitude longitude}`, `bearing`, `speed`, `delay` (seconds, Float),
`monitored`, `vehicleStatus`, `inCongestion`, `occupancyStatus`, `direction`, `mode`, `vehicleId`,
`line`, `serviceJourney`, `operator`, `codespace`, `originRef`, `originName`, `destinationRef`,
`destinationName`, `lastUpdated` / `lastUpdatedEpochSecond`, `expiration` / `expirationEpochSecond`.

Live sample - `vehicles(codespaceId: "OST")` returned **145 vehicles**, e.g. line 1 "Glomma vest",
`delay: 316`, `occupancyStatus: "manySeatsAvailable"`, `vehicleStatus: "IN_PROGRESS"`,
`monitored: true`.

### Joining to the trip query

`serviceJourney.id` has the **identical format in both APIs**
(`OST:ServiceJourney:1_260325121473514_76`), so `vehicles(serviceJourneyId: <leg id>)` is the join.
Filtering by a single ID was verified and returns exactly that bus.

**But a vehicle only appears once its journey is under way.** At 12:54 the planner returned
departures at 13:00 and 13:10 (`..._77`, `..._79`); neither existed in the live feed, which was
carrying `..._76` and `..._73` on the same line. A "where is my bus right now" marker therefore
stays empty for exactly the departure the user is about to catch, and only lights up once it has
left its origin. Plan the UI for the empty case as the normal state, not the exception.

### What it does and does not add

`delay` is **already available from the trip query** via
`legs[].fromEstimatedCall.expectedDepartureTime` minus `aimedDepartureTime` (section 4). Do not add
a second API call just to show lateness. Vehicle positions are only worth it for map position,
`occupancyStatus`, `inCongestion`, or a "two stops away" progress indicator.

### Gotchas

- **17 of 145 vehicles had `line: null`.** Null-guard it.
- `speed` and `inCongestion` are frequently null; `bearing` was populated.
- `lineRef` is `OST:Line:1_1` for public code "1" but `OST:Line:155_805` for public code "805".
  The number after `Line:` is not the public code - read `line.publicCode`, never parse `lineRef`.
- `destinationName` came back null on a `serviceJourneyId`-filtered query even though the field
  exists. Do not depend on it for labelling.
- **No rate-limit headers at all** on this API, unlike JourneyPlanner and Geocoder. The budget is
  unknown, so prefer the subscription over tight polling for anything continuous.

## 6. Remaining gotchas

- Multiple `__type` aliases in one query returns `BadFaithIntrospection`. Codegen against the live
  endpoint will trip this — use the SDL file instead.
- `quay.publicCode` can be an empty string (Greåker vgs. has one unnamed quay).
- `tripPatterns[].duration` is in seconds, but `maxDirectDurationForMode` takes an ISO 8601 string.
  The API is not internally consistent about duration representation.
- `numberOfDeparturesPerLineAndDestinationDisplay` dedupes on line **and** front text jointly, so a
  single line with varying front texts still floods the result. Dedupe on departure time too.

## Østfold coverage confirmed

Stops `NSR:StopPlace:2952` (Sarpsborg bussterminal), `2545` (Greåker), `2719` (Greåker vgs.).
Lines 1, 12, 13, 132, 153, 162, 633. Authority prefix `OST:`.

Working query files from the research session:
`scratchpad/entur/journeyBoard.graphql`, `scratchpad/entur/stopBoard.graphql`
