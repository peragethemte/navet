# Countdown card

Addable widget card `countdown`: title, background image or card colour, and a target the user sets
as a day or a day and a time. Full plan: `~/.claude/plans/compressed-hatching-tiger.md`.

## Done

- [x] `packages/core/src/countdown.ts` - pure, self-contained. Target stored as local wall clock
      (`YYYY-MM-DD` + optional `HH:mm`) and resolved through the local `Date` constructor, so DST is
      the platform's problem, not arithmetic. 19 tests.
- [x] Two readings of "days" on purpose: `days` display = calendar-day difference (target day is 0
      = "Today"); `full` display = exact remaining duration floored to d/h/m/s. Documented in the
      module header.
- [x] `countdown-widget{,-view,-data}.tsx`, `countdown-settings-dialog.tsx`, `use-countdown-clock.ts`
- [x] Appearance reuses `BUILT_IN_WALLPAPERS` + a custom URL + `CustomCardTintPicker`; image falls
      back to the tint/theme surface when it fails to load
- [x] `WallpaperPreviewImage` lifted from `features/dashboard/rooms/components/` to
      `components/shared/`, gained an optional `onFailedChange` so a surface styled for an image can
      fall back. 3 call sites updated.
- [x] Ticks through `subscribeVisibilityAwareTask`, 1s in `full` and 60s in `days`; background
      subtree memoized so a second tick does not re-render the image
- [x] `use-countdown-card-retention.ts` - sweeps expired cards outside edit mode, covers both the
      room store and the active dashboard's `homeCustomCards`, plus the home layout reference
- [x] Registered: `CardType` (+ mirror in `stores/types.ts`), size clamp, catalog entry, render
      switch, XL allowance, edit-mode settings dock, `hero` zone default, `cardTypes` allowlist and
      a typed `sanitizeCustomCardData` branch
- [x] 31 i18n keys across 13 locales
- [x] Tests: core (19), view (8), retention (7), size clamp (2), import round-trip (1)
- [x] Stories: `Cards/Custom/Countdown` (10) and `Cards/Dialogs/Countdown`, with `STORY_DOCS` entries
- [x] Docs: `docs/WIDGETS.md` two tables plus a behaviour note, the add-cards guide, release fragment

## Review

Two plan deviations, both simplifications:

- **No `local-time.ts` extraction.** The plan called for lifting the DST machinery out of
  `chores.ts`. That machinery exists because chores carry an explicit household `timeZone` for
  server-side materialization. The countdown card resolves in the viewer's own timezone, where
  `new Date(y, m-1, d, hh, mm)` is already DST-correct. `chore-calendar-policy.ts` is also mirrored
  by `docker/njs/chore-calendar-policy.js`, so moving symbols out of it would desync an authority
  file for no gain.
- **Wallpapers are not sliced.** The picker first showed `slice(0, 8)` of 16, which made a selected
  wallpaper below index 8 unreachable and invisible. Caught in Storybook; it now shows all 16.

One bug found and fixed during verification: the retention hook took `cards` in its effect deps.
Both the card array and the callback change identity on ordinary dashboard renders, so the sweep
resubscribed the shared timer every render and broke four existing dashboard tests. Now read
through refs with `[enabled]` as the only dep, with a regression test.

## Verification

Green: `pnpm typecheck`, `pnpm check`, `pnpm check:ui-kit`, `pnpm check:stories`, `pnpm test:tier1`
(915), `pnpm test:tier2` (159), all countdown tests (74). Visually reviewed in Storybook at small
through extra-large, days and full, with and without an image, in dark, light and glass.

## Known flakiness, not caused by this change

The full `packages/app/src/features/dashboard` suite is unstable under parallel load on this
machine: runs land at 556/556, 551/556 and 555/556 with the failure moving between
`widget-card-sensor-group`, `dashboard-layout`, `dashboard-section-router-kiosk` and
`dashboard-section-router-home-controls`. Every one of them passes in isolation. Confirmed by
stashing the controller wiring: the suite still failed, on a different file.
