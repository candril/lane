# Labels on Card & Filter by Label

**Status**: Implemented (P1 display + filter; P2 completion, colour, `#tag`; instance-wide completion pending)

## Description

Surface an issue's **labels** — show them on the card, and let you narrow the board by
label from the filter bar. `Task.labels` already exists and is populated by the provider,
but today it only feeds **query-swimlanes** ([016](./016-multiple-boards.md) via
`jql/match.ts`); labels are invisible on cards and absent from the filter bar
([020](./020-filter-and-search.md)). This closes that gap. It is the read/browse
counterpart to [028](./028-change-labels.md) (which *edits* labels).

The motivating use: on a team board, labels like `UX`, `PO`, `BFF`, `tech-debt` carry
real routing meaning — you want to see them at a glance and filter to one quickly.

## Capabilities

### P1 — Must Have

- **Show labels on the card**: render `task.labels` as compact tags, visually distinct
  from the status badge, priority glyph, and assignee ([Card.tsx](../src/components/Card.tsx)).
  Cap the number shown (e.g. first N + `+M`) so cards stay compact — card width is already
  tightly managed. Shown in the list row too ([017](./017-view-modes.md)).
- **Filter by `label:`**: a `label:` token in the filter bar
  ([020](./020-filter-and-search.md)) narrows the board client-side over the loaded
  issues. OR-within / AND-across like the other fields; a card matches if it carries the
  label (case-insensitive exact match on a label, not substring — labels are atomic). The
  existing **keep-parents-of-visible** rule ([020](./020-filter-and-search.md)) applies so
  a matched sub-task keeps its lane.

### P2 — Should Have

- **Label completion** in the filter bar: suggest labels from the **loaded issues'**
  labels, with match counts, like the existing field suggestions.
- **Stable label colour**: hash each label to a colour (as assignee avatars and the
  epic tag do — [029](./029-epic-on-card.md) P2) so a shared label reads as a group
  across cards. Reuse the `avatarColor`-style hash in [utils/glyphs](../src/utils/glyphs.ts).
- **`#label` shorthand** in the filter bar, mirroring `@name` for assignee
  ([020](./020-filter-and-search.md)) — `#UX` ≡ `label:UX`.
- **Instance-wide label completion**: now reachable over REST via `GET /rest/api/3/label`
  (the `jira` CLI passthrough limit that blocked this — [028](./028-change-labels.md) P3,
  [025](./025-jql-search.md) — is gone since the provider moved to REST). Optional; the
  loaded-issue set covers the common case.

### P3 — Nice to Have

- Match highlighting on the label tag when a `label:` filter is active
  ([020](./020-filter-and-search.md) P3).
- Click/short-key to filter by the label under the cursor.

## Out of Scope

- **Editing labels** — [028](./028-change-labels.md) owns add/remove.
- **Group by label** — a card can carry many labels, so a single lane assignment is
  ambiguous; label-based lanes already exist as **query-swimlanes**
  ([016](./016-multiple-boards.md)). Use those.
- **Component filter** — a sibling of label filtering, tracked in
  [020](./020-filter-and-search.md) P2; not this spec.

## Technical Notes

- **Filter** ([filter.ts](../src/filter.ts)): add `label` to `FilterField`, the
  `FIELD_ALIASES` (`label`, `labels`, and the `#` prefix alongside the `@` handling), the
  `emptyFields()` / `isEmpty` set, and a matcher — `fields.label.some(v => task.labels
  ?.some(l => l.toLowerCase() === v.toLowerCase()))`. Suggestions come from
  `board.tasks.flatMap(t => t.labels)` in the App/[FilterBar](../src/components/FilterBar.tsx)
  suggestion builder.
- **Card** ([Card.tsx](../src/components/Card.tsx)): a labels line/row of dim tags,
  capped with an overflow count. Mind the one-line-card layout — labels likely want their
  own wrapped line beneath the title, not the crowded first row.
- **Colour**: a shared string→colour hash (extract the one behind `avatarColor` if not
  already generic) so labels, assignee avatars, and epic tags stay consistent.
- This is a **view concern** only — like all filtering, it hides cards without mutating
  the board and composes with grouping and view mode.

## File Structure

| File | Change |
|------|--------|
| `src/filter.ts` | `label` field + `#` alias + matcher + suggestions |
| `src/filter.test.ts` | Cover `label:` / `#` matching and AND/OR composition |
| `src/components/Card.tsx` | Render capped label tags |
| `src/components/` (list row) | Render labels in the list view |
| `src/utils/glyphs.ts` | Generic string→colour hash for label tags |
| `src/App.tsx` | Feed label values into the filter suggestion list |

## Open Questions

- **How many labels before truncating**, and where the tags sit (a wrapped second line
  vs. the footer) — decide against the real Checkout cards, whose labels can be long.
- **Do sub-task cards show labels?** Sub-tasks often inherit context from the parent;
  showing labels only on roots may keep the board calmer. Default: show on all, cap tight.
- **`#` shorthand collision**: confirm `#` doesn't clash with any quoting/token rule in
  the filter grammar before adopting it.
