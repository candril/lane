# Data Model & Provider Abstraction

**Status**: Done

## Description

The domain types (`Board`, `Column`, `Task`) and the seam that keeps the UI independent of
where data comes from. The types are shaped like a Jira issue so a real Jira source can
populate them without any UI change. A mock provider fills them today.

## Capabilities

### P1 — Must Have (built)

- `Task` carries the fields a card needs: `key`, `summary`, `type`, `priority`, optional
  `assignee`, optional `points`, and `columnId`.
- `Column` maps to a Jira status / workflow step (`id`, `title`).
- `Board` is `{ columns, tasks }` — ordered columns plus the flat task list.
- A provider is any function returning a `Board`. `loadMockBoard()` returns a representative
  sample so the UI is fully exercisable offline.

## Out of Scope

- The Jira provider itself — [005-jira-provider](./005-jira-provider.md).
- Local caching / persistence of the board between runs.
- Enum coverage beyond what a card renders (only the issue types and priorities the UI uses
  are defined).

## Technical Notes

- The UI imports **only** from `types.ts`, never from a specific provider, so the data
  source is swappable at the single call site in `index.tsx`.
- `Board` is intentionally a plain snapshot, not a live/observable object. Refresh semantics
  (polling, manual reload) are a provider concern to be defined with the Jira work.
- When the Jira provider lands, `loadMockBoard()` stays as an offline/demo fallback.

## Key Files

| File | Role |
|------|------|
| `src/types.ts` | `Board`, `Column`, `Task`, `Priority`, `IssueType` |
| `src/providers/mock.ts` | Sample board (the current data source) |
