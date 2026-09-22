# Navet AI Working Guide

This file is the complete baseline. Open one area guide only when the router below sends you there.

## This Is A Personal Fork

Single maintainer, no users, no releases, no upstream pull requests, no published documentation
site. It runs as one Docker container on a wall-mounted Raspberry Pi. Upstream process documents
still present in this repo describe a public project and do not apply here.

Fork-local context, decisions, and current state live in `navet-local/HANDOFF.md`. Read it before
feature work. It is the only document that describes what this fork is actually for.

Providers in use: Homey, Yr, iCloud, Entur. Home Assistant and openHAB are upstream code retained
for merge compatibility only. Do not write features, tests, or validation for them.

## Default Effort

Make the smallest change that works, then stop.

- Add a test only for provider contracts, auth, or a bug that has already bitten twice.
- Do not add Storybook stories, `.changes/` fragments, changelog entries, or documentation updates
  unless asked.
- Do not refactor toward `@navet/ui` unless the task is that extraction.
- Do not audit, classify, or rewrite existing tests. If a test is wrong and in the way, delete it
  and say so in one line.
- New user-facing strings: write `no` and `en` properly, then copy the English string verbatim into
  the other 11 locales. Norwegian is the language that matters here.
- Report what you did in a few lines. No per-step narration.

## Done Means

`pnpm typecheck` passes and you ran the narrowest thing that proves the behavior: a focused vitest
file, `pnpm dev`, or the real container. Nothing broader unless asked.

Run these only when the change touches them:

- `pnpm check:provider-boundaries` for provider package changes
- `pnpm check:i18n` for string changes
- `pnpm check:docker` for anything under `docker/` or a Dockerfile. Run it unpiped; piping to
  `tail` hides the failure because the exit status becomes `tail`'s.

## Find The Code First

| Looking for | Start in |
| --- | --- |
| Product composition, dashboard behavior, state, services | `packages/app/src` |
| Provider-neutral contracts and runtime types | `packages/core/src` |
| Provider-neutral shared UI | `packages/ui/src` |
| Homey, Yr, or iCloud behavior | `packages/provider-<provider>/src` |
| Docker runtime, nginx, sidecars | `docker/` and the root `Dockerfile` |

There is no root `src/`. Search the narrowest likely package first with `rg`.

## Task Router

Open at most one. If nothing matches, this file is enough.

| Task | Area guide |
| --- | --- |
| Package boundaries, provider contracts, where new code belongs | `docs/agents/architecture.md` |
| Dashboard UI, cards, layout, dialogs, visual hierarchy | `ai/skills/navet-ux.md` |
| Reuse, composition, and performance conventions | `docs/agents/coding-standards.md` |

`ai/skills/` also holds short notes on auth and deployment, performance, external resources, and
entity fixtures. Open one only when the task sits squarely inside it.

## Hard Rules

- `@navet/core` must not import React or provider SDKs. Provider packages must not import app
  services or stores. `@navet/ui` must not import provider-specific code.
- Shared UI renders normalized Navet state and provider-neutral commands, never raw provider
  payloads.
- Preserve persisted-data compatibility. A live dashboard profile exists on the Pi.
- Never use `--no-verify`.
- Preserve unrelated dirty-worktree changes.
- `marketing/` is gitignored. Never force-add it.

## Dead Zones

Do not read, edit, test, validate, or update these unless the task is explicitly about them:

- Home Assistant: `packages/provider-homeassistant`, `platform/home-assistant`, `apps/ha-panel`,
  `pnpm test:ha-integration`, `pnpm build:ha-panel`, HACS export and sync
- openHAB: `packages/provider-openhab`
- Public surfaces: `apps/website`, `apps/docs`, `apps/demo`, `README.md`, `CONTRIBUTING.md`,
  `CHANGELOG.md`, `.changes/`, and everything under `docs/` except `docs/agents/`
- Release, brand, and marketing tooling: every `pnpm release:*`, `sync:hacs`, `export:hacs`,
  `brand:*`, `marketing:*`, `wallpapers:*`

Upstream documents that survive in `docs/` describe the public project. Treat them as history, not
as instructions.
