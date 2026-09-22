# Optimistic Create

**Status**: Implemented

## Description

A quick-add ([019](./019-quick-create.md)) used to wait for Jira: Enter left the prompt on
`creating…` and the card appeared only once the provider returned its key. That write is a
single `POST /rest/api/3/issue`, and Jira Cloud takes one to three seconds to answer it — there
is nothing on lane's side to trim. So the card has to appear before Jira answers.

What made create the one write that wasn't optimistic is the key: every other mutation edits an
issue that already has one, while a new issue gets its key from the server. The card therefore
lands under a **placeholder key** and is **inert** until the real key arrives; once it does,
the placeholder is swapped out and the card is an ordinary card.

Two things come with it. An instant insert needs a way back, so the notice that confirms a
create offers **undo**. And a failure can no longer be shown in the prompt, which has already
closed, so it gets a **notice that stays** until dismissed and keeps what was typed.

## Capabilities

### P1 — Must Have

- **Enter closes the prompt and inserts the card at once**, in the first column, under a
  placeholder key (`pending-N`). The card draws `new…` where the key goes.
- **The pending card is inert**, on the board and as a child in the viewer
  ([057](./057-detail-navigation.md)), where a quick-add under the shown issue lands.
  Everything keyed off the focused issue — edit, assign, labels, epic, status, reason, open,
  copy, drilling into it, marking — does nothing on it, and any
  write that names a placeholder key (a move, a rank against it as the anchor, a bulk write
  over a selection that caught it, a quick-add under it) is refused with "still being created"
  and reverted like any other failed optimistic write. Queueing those writes until the key lands
  was considered and rejected: a lot of machinery for a window of two seconds.
- **The real key replaces the placeholder in place** when Jira answers, so the card keeps its
  position and the cursor stays on it.
- **A bottom notice** follows the create:
  - while it is in flight, `creating "<summary>"… · ↵ open · u undo`;
  - once it lands, `created SHOP-123 · ↵ open · u undo`, for five seconds.

  With several creates in flight, the notice follows the latest one.
- **`↵` opens the new issue in the viewer**, which is where its children, assignee, epic
  and the rest are set — the natural next step after filing something. Pressed while the
  create is still in flight it is remembered and honoured the moment the key lands, since
  before that there is nothing to open. The viewer's own `↵` opens the link under its
  cursor ([057](./057-detail-navigation.md)), so the notice doesn't offer this while the
  viewer is up and doesn't take the key there.
- **`u` asks before it undoes**: the notice becomes `delete SHOP-123? this can't be taken
  back · y delete · n keep`, and only `y` goes through. Deleting an issue is the one
  irreversible thing lane does, and `u` sits next to `y`, which copies a key — a near-miss
  must not destroy anything. `n` or `esc` puts the notice back; any other key answers "no"
  and then does its own job, so the confirmation can never strand the keyboard.
- **`u` undoes the latest create** once confirmed, over the viewer too:
  - landed → the card is removed and the issue deleted;
  - still in flight → the card is removed at once. The POST cannot be recalled, since Jira may
    already have created the issue, so the issue is deleted once it lands.
- **Undo falls back to closing.** Deleting an issue needs Jira's *Delete issues* permission,
  which many instances keep to admins. When the delete is refused, the issue is closed into the
  last column instead, with the instance's "Won't Do" resolution if it defines one and the
  default close reason otherwise ([053](./053-close-reason.md)). The card is then shown there,
  since the issue still exists. The toast says which of the two happened.
- **A failed create** removes the card and leaves a notice that stays: `not created: <reason> ·
  n retry · esc dismiss`. `n` reopens the prompt as it was — type, parent and the typed summary
  — so nothing is lost; `N` starts a fresh top-level create and drops the failure. A failed
  undo is reported the same way, without the retry, and puts the card back.

### P2 — Should Have

- Keep the prompt open after Enter for the next summary, so a run of issues can be typed in one
  go. The instant insert is what makes this worth having.

## Out of Scope

- Undo for any other write. Every other mutation is already reversible by making the opposite
  edit; a create is the one whose opposite (delete) the board had no key for.
- Undo history beyond the latest create.

## Technical Notes

- The placeholder is recognised by its prefix (`isPendingKey`), not by a flag on `Task`: a Jira
  key is always `PROJECT-123`, so `pending-` can never collide with one, and no other code has
  to learn a new field.
- The refusal is one wrapper around the provider (`withPendingGuard`), not a check in every
  write path. Keys reach the provider from the cursor, the list rows, rank anchors, selections
  and create inputs; the provider is the one place all of them pass through. `issueUrl`, the
  only synchronous method, returns nothing for a placeholder so `o`/`⇧Y` do nothing on it.
- App resolves `currentKey` to `null` on a pending card or child, which is what makes the
  focused-issue actions no-ops without touching them. `↵` in the viewer drills by its own
  selection, so it checks separately.
- Landing and undoing update the board functionally, by key, never by restoring a snapshot: a
  snapshot taken at Enter would erase whatever else changed during the round trip.
- A refresh already defers while `pendingMutations` is non-zero ([033](./033-cached-boot-and-refresh.md)),
  and a create counts as one until it lands, so a refresh cannot drop the pending card.
- `BoardProvider.deleteIssue` is optional. A source without it goes straight to the close.

## File Structure

| File | Change |
|------|--------|
| `src/pendingCreate.ts` | Placeholder keys, the provider guard, landing a pending card, undo by delete-or-close |
| `src/useCreateDraft.ts` | Optimistic submit, the notice, undo and retry |
| `src/components/CreateNotice.tsx` | The bottom notice line |
| `src/components/CreatePrompt.tsx` | Seeded summary for a retry; no in-prompt submitting/error state |
| `src/providers/provider.ts`, `jira.ts`, `mock.ts` | `deleteIssue` |
| `src/useBoardKeymap.ts` | `u` undo, `esc` dismiss, `n` retry |
| `src/components/Card.tsx`, `ListView.tsx`, `IssueDetail.tsx` | `new…` in place of a placeholder key |
