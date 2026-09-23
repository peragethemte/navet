# Household dinner plan

"What's for dinner" per day with an optional image URL, edited on a Middag tab in Household and shown
on a dashboard card for today or the next N days. Homework and Dinner cards both get the N-days setting.

Decided: chore kind `dinner`, one per day, URL-only images, hero for today and thumbnails after,
edited only in Household (PIN-gated like Homework).

## Plan

- [x] Core: `ChoreDefinitionKind` gains `dinner`, `ChoreDefinition.imageUrl?` (string-validated)
- [x] Core: `chore-dinner.ts` with `createDinnerDefinition`. Id is `dinner:<dateKey>`, so "one per day"
      is structural rather than enforced by UI. `once` at 00:00, `everyone` with no participants, no room
- [x] Core + `docker/njs/chore-store.js`: materialization skips `dinner`, so no occurrence, no Today,
      no points, no pulse. Empty participants allowed for dinner in core `assertDefinitionReferences`
      and in njs `isValidDefinitionInput` (the plan assumed njs already allowed it; it did not)
- [x] App: replace `excludeHomework` with one "household chores only" filter at the 5 count/library sites
- [x] App: `chore-dinner-selectors.ts` with `getDinnerBoard` and `getExpiredDinnerDefinitions` (14-day
      retention). The retention hook sweeps both kinds
- [x] App: `chore-dinner-view.tsx` + Middag tab. 10-day board, one row per day: dish, image URL,
      thumbnail, edit, clear. URL goes through `sanitizeImageUrl`. A broken image falls back to the icon
- [x] App: `dinner-card`. Today is a hero image with the dish over it, later days are thumbnail rows
      labelled I dag / I morgen / weekday. Settings: title, days (1-7), room, tint
- [x] App: homework card `days` (default 1). Rows are grouped by day when >1
- [x] Wiring: CardType, `dashboard-config` allow-list + sanitize (days clamped 1-7), zone default,
      catalog template, hidden when chores disabled, widget-card lazy case, settings dock
- [x] i18n: `no` + `en` written, English copied to the other 11
- [x] Tests: core (dinner never materializes, empty participants accepted), dinner board selector,
      dinner card data sanitize round-trip
- [x] Verify: typecheck, lint, focused vitest, check:i18n, check:docker. `pnpm dev` visual check not
      done: the chrome-devtools browser profile was locked by another session

## Review

- `check:i18n` rejects English copied verbatim into other locales, which contradicts AGENTS.md, so
  all 13 locales got real translations.
- Interchange import can remap a `dinner:<date>` id on collision; `getDinnerBoard` keeps the most
  recently updated dinner per day, so a duplicate is never shown twice.

---

# Household homework

Set homework per household member on a 10-day board, completed in Today like a chore.
Full plan: `~/.claude/plans/look-at-the-household-ticklish-willow.md`.

## Done

- [x] `ChoreDefinition.kind` (`'chore' | 'homework'`), permissively validated so an unknown kind
      never invalidates a workspace - `packages/core/src/chores.ts`
- [x] `isHomeworkDefinition` + `once` fast path in `materializeChoreOccurrences`, mirrored in
      `docker/njs/chore-store.js`
- [x] `packages/core/src/chore-homework.ts` - the single definition of a homework record
      (`once` at local midnight, 1439-minute due window, `person` assignment, no approval/claim/
      missed/reminder policy, no room)
- [x] `chore-homework-selectors.ts` - `getHomeworkBoard`, `getExpiredHomeworkDefinitions`,
      `excludeHomework`, `createHomeworkId`, `localDateKey`
- [x] `use-chore-homework-retention.ts` - 90-day sweep, 10 commands per pass, skipped while
      management is PIN-locked
- [x] `chore-homework-view.tsx` + Homework tab in `household-section.tsx` (PIN-gated like Chores)
- [x] Homework excluded from the chore library, onboarding/mission pickers, setup-complete and
      "add your first chore" counts
- [x] Chore card falls back to `definition.icon`; palette keys on the assignee for homework
- [x] 9 i18n keys across 13 locales
- [x] Tests: core homework, workspace kind validation, interchange round-trip, conformance vector
      (now also asserting `dueAt` in all three authorities), selectors, retention hook, view
- [x] Docs: how-to section, Today cross-link, architecture paragraphs, release fragment

## Review

Reused the chore domain rather than adding a homework entity: definitions are stored verbatim after
permissive validation in all three storage authorities, so the new optional field cost zero changes
in `docker/njs/chore-store.js`, `chore_store.py` and `scripts/vite-chore-store.ts`, and no migration.

Two deviations from the plan, both to keep homework creation at a single command:
- the icon and colour come from `definition.icon` and an assignee-keyed palette instead of a second
  `experience_update` write
- the shared demo fixture was left alone; the stories build their own homework workspace, so
  existing pulse/count assertions stay valid

Moving an entry to another day is deliberately out of scope - it would strand a done occurrence on
the old day. Delete and re-add instead.

## Follow-up for the maintainer

`outbox` is capped only by `.slice(-5000)` with no age or status pruning in any authority. Activity
plus outbox at their caps already exceed the 2 MB document limit on their own, and homework roughly
triples the daily event rate, so the caps are reached in months rather than most of a year. Worth a
separate fix that prunes delivered outbox rows by age.

---

# Household chores and homework on the main dashboard

Two addable widget cards, `chores` and `homework`, with a per-card person filter and completion
from the card. Full plan: `~/.claude/plans/abundant-conjuring-brooks.md`.

## Done

- [x] `CardType` gains `chores` and `homework`, with size clamps to small/medium/large -
      `features/dashboard/stores/custom-cards-store.ts`, mirrored in the orphan `stores/types.ts`
- [x] **Pre-existing bug fixed**: `transit` was missing from the `cardTypes` allow-list in
      `utils/dashboard-config.ts`, so profile import and sync silently dropped transit cards.
      Added `transit`, `chores`, `homework`, plus a typed `sanitizeCustomCardData` branch and a
      round-trip regression test
- [x] `supportsCustomCardEditModeSettingsDock` (`dashboard-card-item.tsx`) also missed `transit`;
      added it with the two new kinds so the settings gear is reachable in edit mode
- [x] `ZONE_DEFAULTS_BY_DEVICE_TYPE`: both kinds default to `actions`
- [x] Catalog entries in `add-entity-dialog/templates.tsx`, hidden in `primitive.tsx` when
      `choresEnabled` is false, the same way `assist` is hidden without a Home Assistant session
- [x] `widget-card.tsx` lazy imports and cases; each card is its own chunk, no `features/chores`
      barrel that would drag `HouseholdSection` in
- [x] Cards: `components/{chores,homework}-card/{index,view}.tsx`, shared
      `chore-widget-card-shell.tsx`, `chore-widget-row.tsx`, `chore-card-person-dialog.tsx`
- [x] `useChoreClock()` - one shared 30 s clock; `chore-today-view` and `chore-homework-view`
      moved onto it instead of each running a private timer
- [x] `useChoreMaterialization()` extracted from `household-section.tsx` so a Home-only screen
      still materializes today's occurrences (only the HA add-on has a periodic scheduler)
- [x] `includeHomework` option on `getHouseholdTodayOccurrences` /
      `getTodayChoresForParticipant`, default `true` so Today and the house pulse are unchanged
- [x] `ChoreActionControl`, `ChoreAssigneeAvatar`, `getChoreStatusDetails` exported for reuse;
      `ChoreActionControl` gained a `compact` mode for card rows
- [x] 26 i18n keys across 13 locales
- [x] Tests: card behaviour (9), size clamps, profile round-trip, selector opt-out, catalog gating
- [x] Stories: `Cards/Custom/Chores` and `Cards/Custom/Homework`, every size and state
- [x] Docs: `docs/WIDGETS.md`, `docs/chores.md`, the household how-to, release fragment

## Review

The cards reuse the Household visual language rather than restating it: each row takes its chore's
own palette from `resolveChoreColorPalette` for the icon tile and points token, renders the real
participant avatar, and the card surface is tinted by state - red while anything is overdue, green
once the day is clear, otherwise the selected person's colour. Homework already keys its palette on
the assignee, so a card filtered to one child is consistently that child's colour.

Deliberate deviation: the Chores card excludes homework, while Household **Today** deliberately
mixes them. Two single-purpose cards on one screen must not count the same item twice.

Not done, and the maintainer should decide:
- The Home summary pill still counts homework in its pending total (`getHousePulse` has no
  homework filter), so the pill and the Chores card can disagree on a screen showing both.
  Changing `getHousePulse` is a behaviour change to an existing surface.
- A failed completion sets `error` on the store and returns `false`. `HouseholdSection` surfaces
  that; the dashboard card currently does not. A toast would fit the dashboard layer.
- `getChoreCardAction` never checks participant `capabilities`, so a person without `complete`
  gets a button that always fails. Pre-existing, shared with `ChoreTodayView`.

## Known unrelated failures in this worktree

`pnpm typecheck` reports 34 errors, all missing `widgets.countdown.*` and
`dashboard.addCard.templates.countdown.*` i18n keys from in-flight countdown-widget work.
`pnpm check:bundle-budget` fails on `integration-store` at 271 KB against a 256 KB limit; verified
against a clean HEAD build, where it is already 271.1 KB. Neither is caused by this change.
