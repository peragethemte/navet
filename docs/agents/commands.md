# Commands

Everything not listed here is upstream release, brand, marketing, or website tooling. Ignore it.

## Daily

```bash
pnpm dev            # standalone app
pnpm typecheck
pnpm check          # biome lint and format
pnpm check:fix
pnpm test           # full unit suite
```

Targeted test, which is what you should normally run:

```bash
pnpm exec vitest --config vitest.unit.config.ts --project unit --run <path>
```

## Gates Worth Running

Run one only when the change touches it:

- `pnpm check:provider-boundaries` for provider package changes
- `pnpm check:i18n` for user-facing strings
- `pnpm check:docker` for `docker/` or Dockerfile changes, unpiped
- `pnpm docker:build` then `pnpm docker:smoke` to verify the real container

## Container

The Pi runs the Docker image, not `pnpm dev`. Anything touching nginx, sidecars, proxies, or
environment wiring must be verified in a built container before it counts as done.

## Commits

Conventional Commits, enforced by `check:commitmsg` in the `commit-msg` hook.

```text
<type>[optional scope][optional !]: <description>
```

If a hook fails on TypeScript errors, fix the types. Do not work around the hook.
