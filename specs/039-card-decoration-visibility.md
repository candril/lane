# Card Decoration Visibility

**Status**: Implemented (P1 + `t a` + `[display]` defaults; command-palette entry pending)

## Description

Toggle, at runtime, which **decorations** a card carries — its **epic tag**
([029](./029-epic-on-card.md)) and its **label tags** ([035](./035-labels-on-card-and-filter.md)) —
so you can trade detail for density without changing config. A board scoped to one epic
doesn't need the epic tag on every card; a board where labels are noise wants them off;
scanning a lot of cards at once wants everything off. This makes each decoration a live,
independent toggle instead of a fixed layout choice.

The toggles are per-session view state (not a data change), grouped under one chord so the
tag toggles live together rather than each eating a scarce top-level key.

Sub-task visibility deliberately stays out of this chord: hiding sub-tasks is a *filter*,
not a tag decoration — reachable as a quick filter (`-type:subtask`, negated token
[020](./020-filter-and-search.md) via the `f…` chord, [036](./036-quick-filters.md)). It
used to be a bespoke `Shift+S` toggle; that was removed in favour of the filter. See Out
of Scope.

## The `t` (tags) chord

A `t` (tags) prefix chord, in the family of the existing `z…` fold chord
([021](./021-fold-and-collapse-controls.md)) and `f…` quick-filter chord
([036](./036-quick-filters.md)): press `t`, then a letter selects which tag kind to
toggle. `t` (not `v`) because `v` is the **view** chord (`v b` / `v l`,
[017](./017-view-modes.md)) — and "tags" is the sharper mnemonic here anyway, since what
toggles *is* the tags.

| Keys | Toggles |
|------|---------|
| `t e` | Epic tags ([029](./029-epic-on-card.md)) |
| `t l` | Label tags ([035](./035-labels-on-card-and-filter.md)) |
| `t a` | Both tag kinds on/off (a quick "clean cards" vs. "everything") |

`t` alone (chord armed, no follow key, then `Esc` or a non-member key) is a no-op, like
the other chords. Sub-task visibility is *not* a member — it's a filter, not a tag
(`-type:subtask`; see Out of Scope).

## Capabilities

### P1 — Must Have

- **`t e` toggles epic-tag visibility** and **`t l` toggles label-tag visibility** on
  cards, live. State is per-session view state (`showEpics`, `showLabels` in
  [App.tsx](../src/App.tsx)); [Card.tsx](../src/components/Card.tsx), the list row, and
  the checklist card gate the epic tag and `<LabelTags>` on it. Applies in board and list
  views.
- The `t` chord is armed by `t` and resolved by the next key, matching the `z…` / `f…`
  chord handling in [App.tsx](../src/App.tsx) (`zPendingRef` / `fPendingRef` → a
  `tPendingRef`). An unrecognized follow key cancels the chord.
- **Persist** the toggles in the session, so the next launch restores them
  ([033](./033-cached-boot-and-refresh.md) / [session.ts](../src/session.ts)).

### P2 — Should Have

- **`t a` toggles all** epic + label decorations together (one keystroke to strip cards
  to the essentials, or restore).
- **Config defaults** in `[display]` ([config/types.ts](../src/config/types.ts) —
  `DisplayConfig`, beside `subtasks`): `display.epics` / `display.labels` (bool, default
  `true`) set the initial visibility, overridden per-session by the toggles.
- Reachable from the command palette ([010](./010-command-palette.md)) as
  "Toggle epic tags" / "Toggle labels".
- Surface the chord in the shortcut dialog ([011](./011-shortcut-dialog.md)).

### P3 — Nice to Have

- A subtle indicator (header/help bar) of which decorations are currently hidden, so an
  empty-looking card isn't mistaken for a card with no epic/labels.
- Per-board default decoration visibility ([026](./026-default-view-per-board.md)) — an
  epic-scoped board defaulting epic tags off.

## Out of Scope

- **What** the epic and label tags contain / how they look — [029](./029-epic-on-card.md)
  and [035](./035-labels-on-card-and-filter.md) own the tags themselves; this spec only
  shows/hides them.
- **Sub-task visibility** ([008](./008-sub-tasks.md)) — hiding sub-tasks is a filter, not
  a tag decoration: the quick filter `-type:subtask` (negated token
  [020](./020-filter-and-search.md), applied via the `f…` chord
  [036](./036-quick-filters.md)). Not a `t…` member — the chord is card *tags* only.
- **Folding** lanes and sub-task *trees* — that's the `z…` chord
  ([021](./021-fold-and-collapse-controls.md)); `t…` toggles decoration *visibility*, a
  different axis (a card stays; its tags come and go).
- **Filtering** by epic/label — hiding a tag doesn't filter; the `epic:` / `label:`
  filters ([029](./029-epic-on-card.md), [035](./035-labels-on-card-and-filter.md)) still
  act regardless of tag visibility.
- New decoration *kinds* (priority glyph, assignee avatar) — those are always-on card
  essentials, not toggled here.

## Technical Notes

- **State**: `showEpics` / `showLabels` in [App.tsx](../src/App.tsx), seeded from
  `session ?? display.* config ?? true` and written back in the `saveSession` effect.
- **Chord**: a `tPendingRef` armed on `t` (board and list views), resolved on the next
  keypress before other consumers, mirroring the `z…` (`zPendingRef`) and `f…`
  (`fPendingRef`) resolution blocks.
- **Distribution via context, not props.** Visibility is a global view preference, so it
  rides a small [`TagVisibility`](../src/components/TagVisibility.tsx) context
  (`{ epics, labels }`) that App provides around the board/list render — rather than
  threading two booleans through Board → Column → Swimlane → Card. `Card`, the list row,
  and `ChecklistCard` read it via `useTagVisibility()` and gate their epic tag /
  `<LabelTags>`.
- **Session**: two flags on the session shape ([session.ts](../src/session.ts)).
- Pure **view concern** — no provider or data-model change; composes with filtering,
  grouping, and view mode.

## File Structure

| File | Change |
|------|--------|
| `src/App.tsx` | `showEpics` / `showLabels` state + session init/persist; `t…` chord (`tPendingRef`); wrap render in the visibility provider |
| `src/components/TagVisibility.tsx` | The `{ epics, labels }` context + `useTagVisibility()` hook |
| `src/components/Card.tsx` / `ListView.tsx` / `ChecklistCard.tsx` | Gate epic tag + `<LabelTags>` on the context |
| `src/session.ts` | Persist `showEpics` / `showLabels` |
| `src/config/types.ts` / `validate.ts` | `display.epics` / `display.labels` defaults |
| `src/components/ShortcutHelp.tsx` | Document the `t…` chord ([011](./011-shortcut-dialog.md)) |

## Open Questions

- ~~**`v` collision check**~~ **Resolved:** `v` is the view chord (`v b` / `v l`), so the
  tag chord uses `t` (tags) instead. Bare `t` has no binding — only `Ctrl+T` is used — so
  it's free.
- ~~**Do hidden tags still take card height?**~~ **Resolved:** the tag rows are
  conditionally *not rendered* (React `&&`), so a hidden tag takes no height — hiding
  genuinely buys density.
