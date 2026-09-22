# Free card sizes on a finer grid

Resize each home dashboard card with a corner handle that snaps to invisible squares, instead of
only picking one of 8 presets.

Settled with the maintainer:

- finer squares than today
- order + size is enough; empty space is a nice-to-have (phase 2)
- keep the preset picker next to the handle
- editing happens on desktop (mouse), touch is not a requirement

## Facts from the code

- The grid already has invisible squares: micro-tracks of `(176 - gap) / 2` = 82px at 4 cols,
  80px at 6+ cols (`components/shared/card-size.ts:62`). Presets are spans of those
  (`card-size.ts:35`); rendered columns = logical columns x 2 (`card-size-selector.tsx:429`).
- Sizes persist as `Record<cardId, CardSize>` in `navet-card-sizes` (`hooks/use-card-state.ts`) and
  in the shared profile as `cardSizes` (`utils/dashboard-config.ts`, `DASHBOARD_CONFIG_VERSION = 4`).
  Unknown values fall back to `medium` on import (`dashboard-config.ts:674`) - a v4 build reading a
  v5 span would silently reset it, so no downgrade path is needed but it is worth knowing.
- ~130 files branch on the `CardSize` preset name for content. Those must keep receiving a preset.
- Undo/redo in the edit bar covers layout order, not card sizes. Unchanged by this work.

## Design

- **Unit:** a fine square is half a micro-track: `fine = (micro - gap) / 2` (about 33-35px, a
  45-50px step). Every preset maps to exactly double its current span, so existing cards render at
  the identical pixel size after the switch. Rendered columns = logical columns x 4.
- **Model:** `CardSpan = { w: number; h: number }` in fine units, stored in a separate
  `homeCardSpans` record on the dashboard definition. `homeCardSizes` stays pure presets and holds
  the content preset, so every other consumer is untouched. A span matching a preset is not stored.
- **Content size:** `resolveContentCardSize(span)` returns the largest preset that fits inside the
  span (w and h both), tie-broken by area. Cards keep getting `size: CardSize`; only the grid shell
  uses the span. Cards that later want smoother adaptation can move to container queries one by one.
- **Limits:** min span = smallest allowed preset for the card type (`getAllowedSizes`,
  `dashboard-card-item.tsx:685`); max w = rendered columns. Calendar/lock constraints in
  `normalizeCardSize` apply to the resolved content size.
- **Narrow screens:** clamp `w` to the column count at render time, replacing
  `getResponsiveCardSize` for spans. Stored value is never rewritten by a clamp.
- **Scope:** home dashboard overview grid only (card grid + presentation grid). Energy, security,
  chores and room grids keep `getCardSpanClass` and the current track size. The home grid switches
  to inline `gridColumn: span w` / `gridRow: span h`.
- **Handle:** bottom-right corner in edit mode, pointer events with `setPointerCapture`, live ghost
  outline of the snapped span, commit on pointerup, Escape cancels. Not built on dnd-kit so it does
  not collide with drag-to-reorder (the handle stops propagation).
- **Picker:** unchanged presets; shows a "Custom" state when the span is not a preset.

## Tasks

- [x] `CardSpan` type, fine-grid metrics, preset -> span map, `resolveContentCardSize`, clamp
- [x] Persistence: optional `homeCardSpans` on the dashboard definition, sanitized on load; no
      config version bump needed (additive field, old profiles load with `{}`)
- [x] Home grid renders from spans on the fine grid (card grid + presentation grid)
- [x] Resize handle with snapped ghost preview in edit mode
- [x] Picker "Custom" state; strings in `no` + `en`, English copied to the other locales
- [x] Focused test: v4 profile with preset names round-trips; v5 span survives import/export
- [x] Verify: `pnpm typecheck`, focused vitest, `pnpm check:i18n`, `pnpm dev` in Chrome - drag a
      card through several sizes, confirm existing cards look pixel-identical before any resize,
      check the Pi profile default sizes render unchanged

## Phase 2 (optional): empty space

A "spacer" pseudo-card in the order list: visible as a dashed box in edit mode, invisible
otherwise, resizable with the same handle. Reuses the order + size model, so no x/y placement.

## Edge cases

- A span between presets (e.g. 10x3) shows the content of the smaller preset, stretched. Acceptable
  for phase 1; the lesson about the calendar default size applies - check what the common shapes
  actually render.
- `grid-flow-row-dense` can move a small card up into a gap left by a resize, which changes the
  apparent order. Existing behaviour, but more visible with free sizes.
- "More space" mode changes column count; clamps handle it, stored spans stay put.

## Review

- Verified in `pnpm dev` (1600px, 6 cols): existing cards render at identical pixels (368px tall
  large cards before and after), pointer drag commits a span, neighbours reflow, the picker shows
  "Egendefinert 2.25 × 2", and picking a preset clears the span.
- Gotcha hit: `DashboardEditActions` swallows pointerdown on `[data-dashboard-edit-action]`, so the
  handle uses `data-card-interactive` to stay out of dnd-kit instead.
- The edit grid now uses the same explicit packer placements as the view grid, so what you resize
  is what the wall shows.
- Not done: phase 2 spacers; undo/redo for sizes (never covered sizes).
