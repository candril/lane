# App Shell

**Status**: Done

## Description

The foundational OpenTUI React application: renderer setup, argument parsing, top-level
layout (`Shell`), and clean startup/shutdown. Everything else mounts inside this shell.

## Capabilities

### P1 — Must Have (built)

- Create the OpenTUI CLI renderer and mount the React tree.
- Parse `--version` / `-v` → print the version string and exit.
- Full-screen root layout via `Shell` (single flex column, themed background).
- Clean shutdown: `q` / `Ctrl+C` / `SIGINT` / `SIGTERM` all destroy the renderer and exit 0.
- Load the board from a data provider at startup (currently `loadMockBoard()`).

## Out of Scope

- Connection/auth screens — deferred to [005-jira-provider](./005-jira-provider.md).
- Any persisted config or state file.

## Technical Notes

- `exitOnCtrlC: false` so we own the quit path (destroy renderer, then `process.exit(0)`),
  matching monq's shutdown pattern.
- `version.ts` reads a build-time `LANE_VERSION` define, falling back to a short git hash
  (`dev-<sha>`), or `dev` when git is unavailable.
- The provider call is the single seam where Jira will later replace the mock — see
  the `TODO` in `index.tsx`.

## Key Files

| File | Role |
|------|------|
| `src/index.tsx` | Entry point: arg parsing, renderer creation, signal handlers, mounts `<App>` |
| `src/App.tsx` | Root component: board state + composition |
| `src/components/Shell.tsx` | Full-screen themed root box |
| `src/theme.ts` | Tokyo Night colour palette |
| `src/version.ts` | Version string resolution |

## Keyboard

| Key | Action |
|-----|--------|
| `q` / `Ctrl+C` | Quit (destroy renderer, exit) |
