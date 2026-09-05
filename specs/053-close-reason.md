# Close Reason

**Status**: Implemented (P1)

## Description

Give a closed issue a *reason* — Jira's **resolution** — rather than letting every close
land as an undifferentiated "done". `⇧R` on the focused issue opens a pick-one list of
the instance's resolutions: on an issue that is not yet in the done column it closes it
*as* that reason, and on one already closed it amends the reason in place. Everything
else keeps closing with a default resolution and no dialog.

The motivating use is twofold. First, correctness: on the SHOP workflow the transitions to
`Resolved` and `Closed` both declare `resolution` as **required**, so lane's bare
transition POST ([041](./041-set-status.md)) is rejected by Jira — closing a card was
broken, not merely unlabelled. Second, honesty about *why* work ended: over a recent 50
closes the board used `Done` 46×, `Obsolete` 3×, `Won't Do` 1×. The rare case is the one
that carries information, and it is the one a hot-path picker would tax hardest — so the
common close stays a single `⇧L` with the default applied silently, and the reason is
something you reach for only when it means something, before or after the fact.

## Capabilities

### P1 — Must Have

- **Closing carries a resolution.** A transition into a status whose Jira transition
  declares a `resolution` field is sent with one. No dialog, no extra keystroke: `⇧L`,
  `⇧S` → Done and the palette's status submenu all keep working exactly as before.
- **A configurable default** — `defaultResolution`, instance-wide with a per-board
  override, falling back to `"Done"`. A default the workflow does not allow fails with
  an error naming the values it does, rather than a bare Jira 400.
- **`⇧R` opens the reason picker** for the issue under the cursor, in every view, with
  the issue's current resolution marked `◉` and highlighted first. Fuzzy-narrow,
  ↑/↓/Enter/Esc — the same `Picker` as assign / epic / status.
- **The picker means two things, and says which.** On an issue that is not in the done
  column the title reads `close KEY as…` and choosing transitions it to the done column
  *with* that resolution. On one already there it reads `reason KEY` and choosing
  rewrites the resolution alone, leaving the status untouched — the "in hindsight" case.
- **Optimistic, revert on failure**, like every other write: apply locally, follow the
  card with the cursor when it moved, persist, restore the previous board and toast the
  reason on failure.
- **Reachable from the palette** ([010](./010-command-palette.md)) as a `resolution`
  submenu, so the reason is discoverable without knowing the key.

### P2 — Should Have

- Offer only the resolutions the *target transition* allows, rather than the instance's
  full list. Today the list comes from `/rest/api/3/resolution` and is filtered by Jira
  on submit; on SHOP the two lists happen to coincide (21 values).

### P3 — Nice to Have

- Show a non-default resolution as a tag on the done card, so `Obsolete` / `Won't Do`
  read at a glance while plain `Done` stays quiet. Deliberately deferred: the board's
  done column is mostly noise-free today and a tag on every closed card would undo that.

## Out of Scope

- **A free-text reason.** The reason is the Jira resolution field and nothing else; a
  comment explaining a close is a separate write (`addComment`) and a separate spec.
- **Other required transition fields.** Only `resolution` is filled. A workflow whose
  transition screen also requires, say, a fix version still fails — with Jira's own
  error, which names the field.
- **Clearing the resolution on reopen.** Whether moving out of the done column clears
  the resolution is a workflow post-function; lane does not guess. The local value
  survives until the next refresh reconciles it against Jira.
- **Resolution as a filter term.** `is:done` already covers the status side
  ([048](./048-one-filter-language.md)); filtering by resolution would need a grammar
  addition and has no demand yet.

## Technical Notes

- **Where "done" is.** The done column is the board's last column — the existing
  `doneColumnId` convention (`useDerivedBoard.ts`, `grouping.ts`), reused rather than
  re-derived, so `⇧R`'s two meanings split on the same line the board already draws.
- **The seam.** `moveTask(key, toColumnId, resolution?)` and
  `transitionTo(key, status, resolution?)` gain an optional resolution;
  `listResolutions?()` and `setResolution?(key, name)` are new and optional — a source
  without them simply never offers `⇧R`.
- **Deciding whether to send one is the provider's job, not the UI's.** Whether a
  transition takes a resolution is a workflow fact, so `transitionTo` reads it from
  `GET /issue/{key}/transitions?expand=transitions.fields` and attaches
  `fields.resolution` only when the chosen transition declares it — sending it to a
  transition that does not would be a 400. When the field is declared and the caller
  passed nothing, the configured default fills in.
- **In hindsight is a plain edit.** `resolution` is on the SHOP edit screen
  (`editmeta`: `required:false, ops:["set"]`), so amending a closed issue is
  `PUT /issue/{key}` with `fields.resolution` — no re-transition, no status change.
- **The list is fetched once, lazily.** `listResolutions()` hits
  `/rest/api/3/resolution` on the first `⇧R` and is cached in the provider for the
  process; the board load stays one request lighter.
- **Reading it back.** `resolution` joins `LIST_FIELDS`, so `Task.resolution` is
  populated for every card by the normal board query and the picker opens on the
  issue's actual value.

## File Structure

| File | Change |
|------|--------|
| `src/types.ts` | `Task.resolution` |
| `src/providers/provider.ts` | resolution arg on `moveTask`/`transitionTo`; `listResolutions`, `setResolution` |
| `src/providers/jira.ts` | `defaultResolution` config, transition-field expand, read/write resolution |
| `src/providers/mock.ts` | offline resolution list + writes |
| `src/config/types.ts`, `src/config/validate.ts` | `defaultResolution` on the instance and per board |
| `src/useDialogs.ts` | `resolving` handle |
| `src/useBoardMutations.ts` | resolution through `moveTo`; `submitResolution` |
| `src/App.tsx` | lazy resolution list, `startResolution` / `submitResolution`, `Picker`, palette submenu |
| `src/useBoardKeymap.ts` | `⇧R` trigger, picker early-return, context fields |
| `src/commands/*` | `issue:resolution` command + `resolution` submenu kind |
| `src/components/ShortcutHelp.tsx` | list `⇧R` |

## Decisions (as built)

- ~~**Ask for the reason on every close, or default it?**~~ **Resolved:** default it.
  46 of 50 closes are plain `Done`; a picker in front of `⇧L` would tax the common case
  to serve the rare one. The reason is opt-in, before (`⇧R` on an open issue) or after
  (`⇧R` on a closed one).
- ~~**Is the reason the resolution field or a comment?**~~ **Resolved:** the resolution
  field. It is what the workflow requires, what Jira reports back, and what other tools
  read; a comment is prose nothing queries.
