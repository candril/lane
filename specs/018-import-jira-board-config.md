# Import Jira Board Config

**Status**: Implemented — `lane import <boardId>`

## Resolution of the open question

**Implemented via the REST API.** Once lane dropped the `jira` CLI for a direct REST
client ([nfr/003](../specs/nfr/003-security-and-credentials.md) was rewritten to
allow token handling), the Agile endpoints became reachable. `lane import <boardId>`
(`src/config/import.ts`) reads `/rest/agile/1.0/board/{id}/configuration` for the
column→status mapping and the filter id, `/rest/api/3/filter/{id}` for the JQL, and
`/rest/api/2/status` to resolve status ids to names, then prints a pasteable
`[[boards]]` block. It does not write `config.toml` — the user pastes it.

**Swimlanes remain out of scope**: the public Agile config response doesn't include
swimlane definitions, so query swimlanes are still added by hand
([016](./016-multiple-boards.md)). The import prints a note to that effect.

## Description

Rather than writing board config by hand, read an existing **Jira board's configuration** and
generate a local board entry from it: its filter (JQL), its columns (status mapping), and its
swimlanes. Exploratory — feasibility depends on what the `jira` CLI exposes.

## Capabilities

### P1 — Must Have

- Given a Jira board (by id/name), produce a `board` config entry
  ([015](./015-configuration.md)) with its JQL and column/status order.

### P2 — Should Have

- Also import the board's swimlane configuration into per-board swimlanes
  ([016](./016-multiple-boards.md)).
- Write the generated entry into `config.toml` (or print it for the user to paste).

## Out of Scope

- Live two-way sync with Jira board config — this is a one-time import/scaffold, not a mirror.
- Editing Jira board config from here.

## Open Question — can the `jira` CLI read board config?

**Unverified.** `ankitpokhrel/jira-cli` exposes boards/sprints (`jira board`, `jira sprint`),
but whether it surfaces a board's **column mapping** and **swimlane** definitions is unknown.
Options, in order of preference:

1. `jira` CLI provides it → use it directly.
2. The CLI can reach the Agile REST endpoints (`/rest/agile/1.0/board/{id}/configuration`) in a
   raw/passthrough mode → use that.
3. Neither → **drop this feature** or require the user to supply the JQL/columns manually. Do
   **not** add a direct REST client just for this (would break the "app holds no credentials"
   property, [nfr/003](./nfr/003-security-and-credentials.md)).

Resolve by checking the installed CLI before committing to this spec.

## Technical Notes

- If pursued, this is a one-shot generator (likely `lane import <board>` or part of
  `lane --init`), not a runtime dependency of the board views.
- Column mapping matters: a Jira board column can map several statuses to one column; the
  generated `columns` order must preserve that intent.

## File Structure

| File | Change |
|------|--------|
| `src/config/import.ts` | New (if feasible): read Jira board config → `BoardConfig` |
| `src/index.tsx` | Wire an `import` / `--init` entry point |
