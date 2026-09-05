# lane — agent notes

Terminal Kanban board for Jira tasks. Same stack as `../monq`.

## Stack

Bun + OpenTUI (`@opentui/core` / `@opentui/react`) + React 19 + TypeScript.
Lint with oxlint, format with oxfmt. Task runner: `just`.

## Commands

- `just dev` — run with hot reload (`bun --watch`) against Jira
- `just mock` — the same against the offline demo board (`--mock`)
- `just check` — typecheck + lint + fmt-check (run before finishing work)
- `just test` / `just typecheck` / `just lint` / `just fmt`
- `just shots` — regenerate the docs screenshots (docs/screenshots.md)
- `just audit-public` — grep the tree against the local denylist before pushing to the public repo

## Conventions

- JSX targets OpenTUI intrinsics: `<box>`, `<text>`, `<span fg=...>`, `<scrollbox>`.
  There is no DOM — do not reach for `<div>` etc.
- Colors come from `src/theme.ts` (`import { theme }`). Don't hardcode hex in components.
- Keyboard input goes through `useKeyboard` from `@opentui/react`. Normalize the raw
  key (lowercase name + implicit-shift detection) — some terminals send `"H"` with the
  shift flag unset instead of shift+`"h"`. See `App.tsx`.
- `oxfmt`: no semicolons, double quotes, trailing commas, 100 col width, 2-space indent.
- Comments explain *why*, not *what*.
- Keep files smallish. When one grows into unrelated concerns, split it along those
  seams. But don't cargo-cult one-function-per-file: group things that belong together
  and only split when the file is actually doing too much.

## Architecture

`src/types.ts` defines a Jira-issue-shaped `Board` / `Column` / `Task`. The UI only
depends on those types and on the `BoardProvider` seam (`providers/provider.ts`):
`providers/jira.ts` talks to Jira Cloud's REST API, `providers/mock.ts` is an in-memory
provider over seed data — the tests' compact fixture, or the fuller demo board in
`providers/demo.ts` that `--mock` opens.

`App.tsx` owns board state; the `use*` hooks split off data loading, cursor, keymap,
mutations (optimistic, reverted on failure), selection and the viewer. Every feature
traces to a numbered spec in `specs/`; the docs site lives in `site/` (Astro Starlight).

Nothing DG-internal goes in the tree: examples use the fictional `SHOP` project, and
`just audit-public` must pass before anything is pushed to the public repo.
