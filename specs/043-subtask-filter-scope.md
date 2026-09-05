# Sub-Task Filter Scope

**Status**: Implemented (P1)

## Description

A toggle for how the filter ([020](./020-filter-and-search.md)) treats **sub-tasks**:

- **strict** (default, today's behaviour): every issue is matched on its own merits. A
  sub-task that doesn't match is gone, even when its parent matched.
- **inherit**: a sub-task rides along with its parent. If the parent matches, *all* its
  sub-tasks stay on the board, matched or not.

`⇧F` flips the two; the state shows in the filter bar and survives a restart.

The motivating use: `@me` should answer "what am I on?" — and the answer is the work item
*with its checklist*, not the two sub-tasks that happen to be assigned to me. Under strict
scope, filtering to yourself shreds every parent's sub-task list; under inherit scope the
same query keeps each matching item whole.

The complementary direction already exists and is unconditional: a matching sub-task always
keeps its parent, so the match never becomes an orphan lane.

## Capabilities

### P1 — Must Have

- **Toggle**: `⇧F` switches between strict and inherit, with a toast naming the new scope.
  Bare `f` still arms the quick-filter chord ([036](./036-quick-filters.md)) — only the
  unshifted key does.
- **Inherit semantics**: an issue that matches the query keeps all of its own sub-tasks;
  a parent kept only *because* a child matched does not drag in its other children. Order
  is unchanged, so lanes and cards stay where they were.
- **Everywhere the filter applies**: board and list views, all groupings — the scope acts on
  the task set, before grouping, so counts and lanes agree with what is drawn.
- **Visible state**: the filter bar shows `↳ subs` while inherit is on, so a surprising
  result set is explainable at a glance.
- **Persisted**: stored in the session file ([033](./033-cached-boot-and-refresh.md)) with
  the query, view, and grouping.

### P2 — Should Have

- No effect on an empty query: with nothing filtered, both scopes show the whole board.

### P3 — Nice to Have

- A per-board or config default (`[display] subtask_scope`), for boards that always want it.
- A query token (`subs:all`) so a quick filter can carry its own scope, instead of the
  toggle being global view state.

## Out of Scope

- Epics: `epic:` matching is a separate hierarchy ([029](./029-epic-on-card.md)) and is not
  widened by this toggle — an epic that matches does not pull in its issues.
- Folding: hiding sub-tasks on screen is [042](./042-fold-subtasks.md); this decides which
  sub-tasks are in the view at all. Both can be on: inherit keeps them, a fold hides them.
- Server-side JQL ([025](./025-jql-search.md)) — this is the client-side filter only.

## Technical Notes

- **Model**: `FilterContext.subtaskScope` (`"strict" | "inherit"`, default strict), so every
  `applyFilter` caller — board, list, and the post-mutation re-locate in the keymap — sees
  one consistent scope.
- **Matching**: `applyFilter` collects the tasks that match on their own, then keeps their
  parents (as before) and, under inherit, the children of each *matched* task. Deriving the
  children from the matched set rather than the kept set is what stops a parent that was
  only kept for context from pulling in unmatched siblings.
- **Toggle**: `⇧F` in the keymap; bare `f` gains a `!shift` guard so the two don't collide.

## File Structure

| File | Change |
|------|--------|
| `src/filter.ts` | `FilterContext.subtaskScope`; inherit pass in `applyFilter` |
| `src/useDerivedBoard.ts` | Thread the scope into `filterCtx` |
| `src/App.tsx` | `subtaskScope` state, session persistence, toggle + toast |
| `src/useBoardKeymap.ts` | `⇧F` toggle; `!shift` guard on the quick-filter chord |
| `src/components/FilterBar.tsx` | `↳ subs` indicator |
| `src/session.ts` | Persist `subtaskScope` |
| `src/components/ShortcutHelp.tsx` | Document `⇧F` |

## Open Questions

- Should inherit also widen *free text*? It does today — text and fields go through the same
  match — so `payment` keeps the sub-tasks of any item whose summary mentions payment.
