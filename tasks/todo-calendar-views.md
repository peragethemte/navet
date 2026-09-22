# Calendar: "next X days" agenda + month grid

Reference: a wall-panel photo showing today and tomorrow in their own lane beside the remaining days
of the week, each day's events flowing into columns. Decided with the maintainer: extend the
existing `CalendarCard` rather than add a second calendar card type.

Settled before implementation:

- new view modes on the existing card, not a new card type
- today/tomorrow lane beside the remaining day rows, as in the photo
- month grid with titled chips, collapsing to coloured dots when a cell is tight
- day count 3-14, default 7

## Done

### Core date logic (`@navet/core`)

- [x] `calendar-dates.ts` - extracted the `YYYY-MM-DD` key arithmetic that was private to
      `chore-calendar-policy.ts` (pure string math, correct in any timezone) and re-exported it from
      there so no chore call site changed. Added `formatLocalDateKey` as the single local-clock
      reader, consolidating the duplicate that lived in `countdown.ts`.
- [x] `calendar-agenda.ts` - `expandCalendarEventsByDay`, `buildMonthGridWeeks`,
      `getMonthGridRange`, `buildAgendaDayKeys`, `clampCalendarDayCount`.
- [x] 19 tests, green in Europe/Oslo, America/New_York and Pacific/Auckland.

Two traps the tests pin down, either of which silently shifts a multi-day event by a day:

- all-day end dates are **exclusive** in iCal and CalDAV, so 22-23 August arrives as `end: 08-24`
- date-only values parse as **UTC** midnight, so all-day events bucket in UTC while timed events
  bucket on the local clock

### Data pipeline

The card could not have rendered either view before this: the window was seven days and each
calendar was cut to five events.

- [x] `use-provider-calendar-devices.ts` now passes a real window. `PlatformCalendarRequestOptions`
      already existed and was plumbed end to end; only the caller never used it.
- [x] Per-source cap 5 -> 200, aggregate cap 12 -> 500, card cap replaced with one 400-event ceiling.
- [x] `calendar-events-request.ts` - one request per calendar and window, shared across mounts.
      `useProviderCollectionData` keeps per-instance state and every instance fires at once on tab
      refocus, so without this the wider window multiplied a burst that was only affordable while it
      was a week of data. Failures are not cached.
- [x] iCloud sidecar window 31 -> 60 days ahead, history 1 -> 45 days, per-calendar cap 25 -> 400,
      so the month grid is not blank for its past days. All still env-overridable.

### Bugs fixed on the way

- [x] `use-calendar-data.ts` grouped events by a **UTC** date key while rendering local date parts,
      so in UTC+2 anything between midnight and 02:00 was filed under the previous day.
- [x] Multi-day events appeared only on their first day. They now span every day they cover, with
      continuation arrows at both ends.

### Views and settings

- [x] `calendar-agenda-days-view.tsx` - split at `extra-large`/`extra-wide`, stacked at `large`.
- [x] `calendar-month-view.tsx` - 7-column grid; chips or dots decided by a Tailwind container query
      on the day cell, following the existing `@container/chore-footer` precedent.
- [x] `calendar-event-chip.tsx` - the compact event, shared by both views.
- [x] View modes `day | days | month`. The retired `week` value is read as `days`, so no migration.
- [x] Day count persisted under a new `calendarCardDayCounts` key, with a stepper in the dialog.
- [x] `calendars` gained `extra-large`/`extra-wide`, gated on the existing `extraLargeAllowed`.
- [x] Month grid renders even with no events; the empty-state line stays for the agenda views.
- [x] 11 keys across 13 locales. `calendar.settings.thisWeek` kept: the sensor-group sample data
      borrows it.
- [x] `Cards/Entity/Calendar Views` stories (both views, shortest and longest range, narrow cells,
      empty month) plus the story-docs entry; wide sizes added to the entity-card story.
- [x] Docs: iCloud section in `docs/integrations.md`, sidecar README defaults. Changeset added.

## Verification

- `vitest run --config vitest.unit.config.ts` - 554 files, 3957 tests, all passing
- `tsc --noEmit -p tsconfig.json` - clean
- `biome check` - clean across every changed and new file
- `node scripts/check-i18n.mjs` - 13 locales pass
- `pnpm check:stories` - 190 story files pass
- Core tests re-run under three timezones

## Review

The two new views are built from one shared expansion function rather than each deriving its own
day buckets, which is what keeps a multi-day event consistent between the agenda and the grid.

The pipeline work was not optional scope. Verified before starting: the fetch window was hard-coded
to seven days, each calendar was sliced to five events, and the merged list to twelve. A month grid
against that data would have rendered a mostly empty calendar and looked like a layout bug.

Deliberate choices worth a second opinion:

- **No week numbers.** `getWeekNumber` in `use-header-datetime.ts` is Sunday-anchored and not
  ISO 8601, so it disagrees with Norwegian week numbers. Adding a second, correctly computed one
  next to it would put two different answers on the same screen. Left alone; worth fixing on its own.
- **No month-to-month navigation.** Current month only, which suits a panel nobody taps. Arrows are
  a small addition if wanted.
- **The day-count stepper is feature-local.** The repo has no numeric stepper primitive, `Slider` is
  used only for device controls, and twelve preset pills wrap badly. Promote it if a second card
  ever needs one.
- **Raising the iCloud sidecar defaults changes an existing integration's behaviour.** Needed for a
  truthful month grid, but it is a behaviour change to something already shipped.

Not done:

- `CalendarDevice` in `types/device.types.ts` still omits `startDateTime`, `endDateTime`, `isAllDay`
  and `description` although the mapper emits them. Pre-existing; the views read the card-level
  `CalendarEvent` type, which is correct, so nothing here depends on fixing it.
- `areDataEqual` deep-compares the raw event payload on every refresh. That cost now scales with a
  wider window. Projecting raw events down to the fields the mapper reads would bound it.
