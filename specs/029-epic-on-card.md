# Epic on Card & Filter

**Status**: Implemented (P1 tag + `epic:` filter; P2 epic name, colour, completion done; epic-source query pending)

## Description

Surface an issue's **epic** — show it on the card, and let you narrow the board to
an epic from the filter bar. The epic is the issue's link *upward* (a story belongs to
an epic) — deliberately **not** the same as sub-tasks, which hang *below* an issue
([008](./008-sub-tasks.md)). So a story card shows a small epic tag (its epic's
name/key), separate from any sub-task rows.

`Task.epicKey` already exists and is populated by the provider (the REST provider reads
the configured epic field — `jira.epic_link_field`, `parent` on SHOP; see
[034](./034-epic-grouped-backlog.md)); today it only feeds epic **grouping**
([034](./034-epic-grouped-backlog.md)) and is invisible on cards. This closes that gap.
It is the read/browse counterpart of [038](./038-change-epic.md) (which *edits* the
link) and the epic twin of [035](./035-labels-on-card-and-filter.md) (labels on card &
filter).

The motivating use: on a team board (e.g. Checkout), you want to see at a glance which
epic a card belongs to, and filter to one epic's cards quickly.

## Capabilities

### P1 — Must Have

- **Show the epic on the card**: a compact tag (epic name, or key when the name isn't
  sourced), visually distinct from the status badge, priority glyph, assignee, and label
  tags ([Card.tsx](../src/components/Card.tsx)). Sub-tasks need not repeat the parent's
  epic. Shown in the list row too ([017](./017-view-modes.md)). Redundant — and so
  hidden — in the epic-grouped views where the lane header already carries it
  ([034](./034-epic-grouped-backlog.md)).
- **Filter by `epic:`**: an `epic:` token in the filter bar
  ([020](./020-filter-and-search.md)) narrows the board to one or more epics, client-side
  over the loaded issues. Match on `epicKey` (and the epic's summary once sourced),
  case-insensitive. OR-within / AND-across like the other fields. The existing
  **keep-parents-of-visible** rule ([020](./020-filter-and-search.md)) applies, so a
  matched card keeps its lane and its sub-tasks. Note free-text search *already* covers
  the epic key and summary ([filter.ts](../src/filter.ts) `taskFields`); this adds the
  **scoped** field so you can filter on the epic alone.

### P2 — Should Have

- **Source the epic name.** The tag wants the epic's summary, not just its key. The
  summary isn't on the child issue — resolve it from the loaded epic issue's summary
  (the `summaryByKey` map [filter.ts](../src/filter.ts) already builds), or add
  `epicName?` to `Task` sourced via the child's nested `parent.fields.summary`. When the
  name is unavailable, the tag falls back to the key.
- **Stable epic colour**: hash the epic (key or name) to a colour — the same
  `avatarColor`/`labelColor` hash assignees and labels use
  ([utils/glyphs](../src/utils/glyphs.ts)) — so cards sharing an epic read as a group at
  a glance, consistent with the label tags ([035](./035-labels-on-card-and-filter.md)).
- **Epic completion** in the filter bar: suggest epics from the loaded issues' epics
  (key + name), with match counts, like the other field suggestions. A richer candidate
  source (an epic-source JQL) is specced with the picker in
  [038](./038-change-epic.md) — the same candidate set feeds both.
- **Hide the epic tag** independently of labels via the card-decoration toggle
  ([039](./039-card-decoration-visibility.md)) — `t e`.

### P3 — Nice to Have

- Match highlighting on the epic tag when an `epic:` filter is active
  ([020](./020-filter-and-search.md) P3).
- Short-key to filter by the epic under the cursor.

## Out of Scope

- **Changing an issue's epic** — [038](./038-change-epic.md) owns the write (the picker,
  `setEpic`, optimistic/revert).
- **Grouping by epic** (one lane/section per epic, backlog view) — [034](./034-epic-grouped-backlog.md)
  owns it. This spec is card tag + filter only.
- Creating or editing the **epics themselves** (name, status) — only reading the link
  for the tag and filter.
- Server-side *board* filtering — the `epic:` filter acts on already-loaded issues, like
  every other filter field ([020](./020-filter-and-search.md)).

## Technical Notes

- **Card** ([Card.tsx](../src/components/Card.tsx)): an epic tag near the summary. Mind
  the tight one-line-card layout — the tag likely sits with (or just above) the label
  tags rather than crowding the type/key/priority row. Gate its render on the
  decoration-visibility state ([039](./039-card-decoration-visibility.md)).
- **Filter** ([filter.ts](../src/filter.ts)): add `epic` to `FilterField`, the
  `FIELD_ALIASES` (`epic`), the `emptyFields()` / `isEmpty` set, and a matcher —
  `fields.epic.some(v => matches task.epicKey or its summary)`. The epic summary already
  reaches the matcher via the `summaryByKey` map used for free-text; reuse it for the
  scoped field. Suggestions come from the loaded issues' `epicKey` (+ names).
- **Colour**: reuse the shared string→colour hash behind `avatarColor`/`labelColor`
  ([utils/glyphs](../src/utils/glyphs.ts)) so epic tags, label tags, and assignee avatars
  stay one visual system.
- This is a **view concern** only — like all filtering, it hides cards without mutating
  the board and composes with grouping and view mode.

## File Structure

| File | Change |
|------|--------|
| `src/types.ts` | `epicName?` on `Task` (`epicKey?` already landed) — only if not sourcing the name from `summaryByKey` |
| `src/providers/jira.ts` | Source `epicName` (nested `parent.fields.summary`), if used |
| `src/providers/mock.ts` | Seed an epic name so the tag shows offline |
| `src/components/Card.tsx` | Epic tag (colour-hashed), gated on visibility ([039](./039-card-decoration-visibility.md)) |
| `src/components/` (list row) | Epic tag in the list view |
| `src/filter.ts` | `epic` field + matcher + suggestions ([020](./020-filter-and-search.md)) |
| `src/filter.test.ts` | Cover `epic:` matching and AND/OR composition |
| `src/utils/glyphs.ts` | Reuse the string→colour hash for the epic tag |
| `src/App.tsx` | Feed epic values into the filter suggestion list |

## Open Questions

- **`epicName` field vs. lookup.** Add `epicName?` to `Task`, or resolve names from the
  loaded epic issue's summary via `summaryByKey`? The lookup is free when the epic issue
  is itself loaded (grouped boards load it); a stored `epicName` is needed only when it
  isn't. Default: reuse `summaryByKey`, fall back to the key; add `epicName?` only if a
  board references epics it doesn't load.
- **Where the tag sits on the card** — its own line with the labels, or a distinct slot —
  decide against the real Checkout cards, whose summaries + labels already fill the card
  ([035](./035-labels-on-card-and-filter.md) has the same open layout question).
