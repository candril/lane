# Alternative Backend — Markdown in Git

**Status**: Draft

## Description

lane is **not tied to Jira**. The UI depends only on the `BoardProvider` seam
([004](./004-data-model-and-provider.md)) — `loadBoard` / `moveTask` / `createIssue` /
`editSummary` / `assignTask` — and `providers/mock.ts` already proves a non-Jira source
works. This spec captures a **local-first backend** that stores each issue as a Markdown
file (front-matter + body) in a directory, versioned in **git** and pushed to a GitHub
repo — a board you own, offline-capable, no Jira account.

## Capabilities

### P1 — Must Have

- A `markdown` provider implementing `BoardProvider`, backed by a directory of `.md`
  files — one per issue, front-matter carrying the fields the UI needs (`key`, `type`,
  `status`, `assignee`, `parentKey`, `epicKey`, `labels`, `priority`) and the body as the
  description. `loadBoard` reads the directory; columns come from config
  ([015](./015-configuration.md), reusing `[[…columns]]`).
- Mutations write the file and stage it: `moveTask` (status), `editSummary`, `assignTask`,
  `createIssue` (allocate the next key, write a new file). Optimistic UI is unchanged — it
  already assumes async writes ([004](./004-data-model-and-provider.md)).
- Backend selection in config (e.g. `[board] backend = "jira" | "markdown"` with a `path`),
  so a board is either Jira- or Markdown-backed. Composes with per-board settings
  ([030](./030-per-board-columns.md), [031](./031-per-board-jira-cli-config.md)).

### P2 — Should Have

- **Git sync**: commit each mutation (or batch) and `git push` to the configured remote
  (GitHub). Pull/merge on load. Surface push failures like any provider error
  ([nfr/004](./nfr/004-reliability-and-errors.md)).
- A stable, human-diffable file format so the repo is reviewable as plain Markdown.

### P3 — Nice to Have

- Two-way with GitHub **Issues** (as opposed to raw files) via `gh`, mirroring the
  `jira` CLI shell-out pattern ([005](./005-jira-provider.md)).
- Import/export between backends (Jira ↔ Markdown).

## Out of Scope

- Real-time multi-user collaboration / locking — git is the concurrency model; conflicts
  are resolved as git conflicts.
- A hosted service — this is local files + a git remote.

## Technical Notes

- New `src/providers/markdown.ts` implementing `BoardProvider`; no UI changes (the seam is
  the whole point). Front-matter parsed with the same TOML/YAML approach as config.
- Key allocation is local (a counter or max-existing + 1) since there's no server.
- Git operations shell out (`git add/commit/push`, or `gh`) — same shape as the `jira`
  provider, and subject to [nfr/003](./nfr/003-security-and-credentials.md) (the tool owns
  credentials, lane never does).
- This validates the provider abstraction: if a Markdown/git backend drops in cleanly, the
  seam is right.

## File Structure

| File | Change |
|------|--------|
| `src/providers/markdown.ts` | New: `BoardProvider` over a directory of `.md` files + git |
| `src/config/types.ts` | Per-board `backend` selector + path/remote |
| `src/config/validate.ts` | Validate the backend selection |
| `src/index.tsx` | Pick the provider by board backend |
