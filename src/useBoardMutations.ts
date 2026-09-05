import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { nextStatus } from "./grouping"
import type { AssignCandidate } from "./assign"
import type { PickItem } from "./components/Picker"
import type { Editing } from "./useDialogs"
import type { Board as BoardModel, Task } from "./types"
import type { BoardProvider } from "./providers/provider"

interface BulkFailure {
  key: string
  message: string
}

/**
 * Every board-writing operation, each optimistic: apply to the local board, call the
 * provider, revert on failure — the same path the real Jira transition takes. The
 * `transition`/`applyRank` primitives take an `onApplied(next)` callback so the caller
 * can follow the moved card with the cursor. Every `submit*` takes the issue key
 * outright rather than reading a dialog handle, so the same write serves the bottom-bar
 * editors and the command palette's submenus (specs/010); closing the overlay is the
 * caller's business. `pendingMutations` is shared with useBoardData so a refresh
 * defers until in-flight writes settle.
 */
export function useBoardMutations(args: {
  board: BoardModel
  setBoard: Dispatch<SetStateAction<BoardModel>>
  provider: BoardProvider
  pendingMutations: MutableRefObject<number>
  settleMutation: () => void
  showToast: (message: string) => void
  editing: Editing | null
  setEditing: Dispatch<SetStateAction<Editing | null>>
}) {
  const { board, setBoard, provider, pendingMutations, settleMutation, showToast } = args
  const { editing, setEditing } = args

  /**
   * Set an issue's status (move it to `toColumnId`), optimistically, reverting on
   * failure. `resolution` is the reason a close should carry (specs/053); left unset,
   * the provider fills in the configured default where its workflow demands one — so
   * the ordinary ⇧H/⇧L path passes nothing and still closes.
   */
  async function moveTo(
    key: string,
    toColumnId: string,
    onApplied?: (next: BoardModel) => void,
    resolution?: string,
  ) {
    const task = board.tasks.find((t) => t.key === key)
    if (!task || task.columnId === toColumnId) {
      return
    }
    const previous = board
    // A close the caller gave no reason for still lands one — the provider's default
    // (specs/053) — so show that rather than leaving the card reasonless until the
    // next refresh. "Closing" is the board's last column, the same line every other
    // done-ness check draws.
    const closing = toColumnId === board.columns[board.columns.length - 1]?.id
    const landed = resolution ?? (closing ? provider.defaultResolution : undefined)
    const next: BoardModel = {
      ...board,
      tasks: board.tasks.map((t) =>
        t.key === key ? { ...t, columnId: toColumnId, resolution: landed ?? t.resolution } : t,
      ),
    }
    setBoard(next)
    onApplied?.(next)
    pendingMutations.current++
    try {
      await provider.moveTask(key, toColumnId, resolution)
    } catch (err) {
      setBoard(previous)
      showToast(`${key} not moved: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      settleMutation()
    }
  }

  /**
   * Rewrite an already-closed issue's reason in place (specs/053) — no transition, so
   * its status and resolution date stand. Optimistic like every other field write.
   */
  function submitResolution(key: string, resolution: string) {
    if (!provider.setResolution) {
      return
    }
    const previous = board
    setBoard((b) => ({
      ...b,
      tasks: b.tasks.map((t) => (t.key === key ? { ...t, resolution } : t)),
    }))
    // Nothing on the board draws the resolution, so the toast is the only confirmation
    // the amend landed at all.
    showToast(`${key} closed as ${resolution}`)
    pendingMutations.current++
    void (async () => {
      try {
        await provider.setResolution!(key, resolution)
      } catch (err) {
        setBoard(previous)
        showToast(`reason failed: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        settleMutation()
      }
    })()
  }

  /**
   * Transition an issue one step left/right, optimistically, reverting on failure.
   *
   * The step walks the backlog statuses *and* the board columns as one sequence
   * (specs/044), so ⇧L promotes through refinement and onto the board while ⇧H sends
   * it back the same way — the two directions stay symmetric rather than the backlog
   * being a one-way door. Crossing the boundary moves the issue to the other tab, so
   * it is announced.
   */
  async function transition(
    key: string,
    direction: -1 | 1,
    onApplied?: (next: BoardModel) => void,
  ) {
    const task = board.tasks.find((t) => t.key === key)
    if (!task) {
      return
    }
    const target = nextStatus(board, task.columnId, direction)
    if (!target) {
      return
    }
    const isBacklog = (id: string) => (board.backlog ?? []).some((c) => c.id === id)
    if (isBacklog(task.columnId) !== isBacklog(target.id)) {
      showToast(`${key} → ${target.title}`)
    }
    await moveTo(key, target.id, onApplied)
  }

  /**
   * Re-rank `key` to sit immediately before/after `neighborKey` (specs/006). The
   * optimistic reorder mirrors the server op exactly: pull the card out of the
   * global rank list and reinsert it against the anchor, so a failed write reverts
   * to precisely the prior order.
   */
  async function applyRank(
    key: string,
    neighborKey: string,
    direction: -1 | 1,
    onApplied?: (next: BoardModel) => void,
  ) {
    if (!provider.rankTask) {
      return
    }
    const from = board.tasks.findIndex((t) => t.key === key)
    if (from < 0 || !board.tasks.some((t) => t.key === neighborKey)) {
      return
    }
    const previous = board
    const tasks = [...board.tasks]
    const [moved] = tasks.splice(from, 1)
    const at = tasks.findIndex((t) => t.key === neighborKey)
    tasks.splice(direction < 0 ? at : at + 1, 0, moved!)
    const next: BoardModel = { ...board, tasks }
    setBoard(next)
    onApplied?.(next)
    const anchor = direction < 0 ? { before: neighborKey } : { after: neighborKey }
    pendingMutations.current++
    try {
      await provider.rankTask(key, anchor)
    } catch (err) {
      setBoard(previous)
      showToast(`rank failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      settleMutation()
    }
  }

  /**
   * Re-link (or detach) the focused issue's epic optimistically: update the card's
   * epic tag immediately, then persist. Revert on failure. Re-slotting in the epic
   * views falls out of the normal state update + buildLanes (specs/034). Only an
   * explicit candidate acts — the "(no epic)" item detaches; free text is a no-op
   * since it can't resolve to an epic key.
   */
  function submitEpic(key: string, chosen: PickItem | null) {
    if (!chosen) {
      return
    }
    const epicKey = chosen.value
    const epicName = epicKey ? chosen.label : undefined
    const previous = board
    setBoard((b) => ({
      ...b,
      tasks: b.tasks.map((t) =>
        t.key === key ? { ...t, epicKey: epicKey ?? undefined, epicName } : t,
      ),
    }))
    showToast(epicKey ? `${key} → ${chosen.label}` : `${key} epic cleared`)
    pendingMutations.current++
    void (async () => {
      try {
        await provider.setEpic(key, epicKey)
      } catch (err) {
        setBoard(previous)
        showToast(`epic failed: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        settleMutation()
      }
    })()
  }

  /**
   * Persist the edited label set optimistically: apply to the card immediately,
   * then reconcile. Revert on failure. Re-slotting into swimlanes/filters falls out
   * of the normal state update + buildLanes (specs/016).
   */
  function submitLabels(key: string, labels: string[]) {
    const previous = board
    setBoard((b) => ({
      ...b,
      tasks: b.tasks.map((t) => (t.key === key ? { ...t, labels } : t)),
    }))
    // Name the resulting set rather than just "updated": with label tags hidden
    // (`t l` — specs/039) or on a checklist sub-task row, the toast is the only
    // feedback the edit landed at all.
    showToast(labels.length > 0 ? `${key} labels: ${labels.join(" ")}` : `${key} labels cleared`)
    pendingMutations.current++
    void (async () => {
      try {
        await provider.setLabels(key, labels)
      } catch (err) {
        setBoard(previous)
        showToast(`labels failed: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        settleMutation()
      }
    })()
  }

  /**
   * The exact identifier to hand `assignTask`: `null` to unassign, the resolved
   * `accountId` for a board person (looked up via the provider when the candidate
   * only carries a display name — specs/027), or the raw text for a mock/off-list
   * assign. Throws when a Jira person can't be resolved, rather than passing a name
   * that would trip jira-cli's interactive picker.
   */
  async function resolveAssignId(
    chosen: AssignCandidate | null,
    typed: string,
  ): Promise<string | null> {
    if (chosen && chosen.value === null) {
      return null // "Unassigned"
    }
    if (chosen?.sampleKey && provider.resolveAssignee) {
      const resolved = await provider.resolveAssignee(chosen.sampleKey)
      if (resolved.displayName !== chosen.label) {
        throw new Error(`${chosen.label} no longer holds ${chosen.sampleKey}; refresh the board`)
      }
      return resolved.id
    }
    if (chosen) {
      return chosen.value // mock display name, or an already-resolved id
    }
    if (provider.resolveAssignee) {
      throw new Error(`can't resolve "${typed}" — pick someone already on the board`)
    }
    return typed // mock: assign a free-typed name verbatim
  }

  /**
   * Reassign the focused issue optimistically: show `label` on the card immediately,
   * resolve the exact identifier, then persist. Revert on failure. The resolved id is
   * stamped onto the card so re-assigning the same person skips the lookup.
   */
  function submitAssign(key: string, chosen: AssignCandidate | null, typed: string) {
    const unassign = chosen?.value === null
    const label = unassign ? undefined : chosen ? chosen.label : typed
    const previous = board
    setBoard((b) => ({
      ...b,
      // Clear the old id; the resolved one is stamped back after the write succeeds.
      tasks: b.tasks.map((t) =>
        t.key === key ? { ...t, assignee: label, assigneeId: undefined } : t,
      ),
    }))
    showToast(unassign ? `${key} unassigned` : `${key} → ${label}`)
    pendingMutations.current++
    void (async () => {
      try {
        const id = await resolveAssignId(chosen, typed)
        await provider.assignTask(key, id)
        if (id !== null) {
          setBoard((b) => ({
            ...b,
            tasks: b.tasks.map((t) => (t.key === key ? { ...t, assigneeId: id } : t)),
          }))
        }
      } catch (err) {
        setBoard(previous)
        showToast(`assign failed: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        settleMutation()
      }
    })()
  }

  /** Rename optimistically: apply the new summary, persist, revert on failure. */
  function submitEdit(summary: string) {
    const edit = editing
    if (!edit || edit.submitting) {
      return
    }
    const trimmed = summary.trim()
    if (!trimmed || trimmed === edit.current) {
      setEditing(null)
      return
    }
    const previous = board
    setEditing({ ...edit, submitting: true, error: undefined })
    setBoard((b) => ({
      ...b,
      tasks: b.tasks.map((t) => (t.key === edit.key ? { ...t, summary: trimmed } : t)),
    }))
    pendingMutations.current++
    void (async () => {
      try {
        await provider.editSummary(edit.key, trimmed)
        setEditing(null)
      } catch (err) {
        setBoard(previous)
        setEditing((d) =>
          d
            ? { ...d, submitting: false, error: err instanceof Error ? err.message : String(err) }
            : d,
        )
      } finally {
        settleMutation()
      }
    })()
  }

  /**
   * Write back what `$EDITOR` produced (specs/049): the summary optimistically, since
   * it is on screen, and the description as a plain await, since nothing shows it until
   * the viewer reopens. Only the fields that actually changed are sent, so editing a
   * title never rewrites a description that a lossy conversion might degrade.
   *
   * Returns the description that ended up stored, so the caller can refresh its cache;
   * null if nothing was written or the write failed.
   */
  async function submitIssueEdit(
    key: string,
    edited: { summary: string; description: string },
    original: { summary: string; description: string },
  ): Promise<string | null> {
    const renamed = edited.summary !== original.summary
    const rewritten = edited.description !== original.description && !!provider.editDescription
    if (!renamed && !rewritten) {
      showToast(`${key} unchanged`)
      return null
    }
    const previous = board
    if (renamed) {
      setBoard((b) => ({
        ...b,
        tasks: b.tasks.map((t) => (t.key === key ? { ...t, summary: edited.summary } : t)),
      }))
    }
    pendingMutations.current++
    try {
      if (renamed) {
        await provider.editSummary(key, edited.summary)
      }
      if (rewritten) {
        await provider.editDescription!(key, edited.description)
      }
      showToast(`${key} updated`)
      return rewritten ? edited.description : null
    } catch (err) {
      setBoard(previous)
      showToast(`${key} not saved: ${err instanceof Error ? err.message : String(err)}`)
      return null
    } finally {
      settleMutation()
    }
  }

  // ——— Bulk edits over a selection (specs/056) ———
  //
  // The single-issue writes above capture the whole board as their revert point,
  // which concurrent calls would clobber — a failure in one would silently roll back
  // the others' optimistic state. The bulk shape instead applies every change in one
  // functional update, fans the provider calls out per issue, and reverts only the
  // issues whose write failed.

  /** One provider write per issue; every write settles, failures are collected. */
  async function fanOut(
    keys: string[],
    write: (key: string) => Promise<void>,
  ): Promise<{ ok: string[]; failed: BulkFailure[] }> {
    pendingMutations.current += keys.length
    const results = await Promise.allSettled(
      keys.map(async (key) => {
        try {
          await write(key)
        } finally {
          settleMutation()
        }
      }),
    )
    const ok: string[] = []
    const failed: BulkFailure[] = []
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        const reason: unknown = result.reason
        failed.push({
          key: keys[i]!,
          message: reason instanceof Error ? reason.message : String(reason),
        })
      } else {
        ok.push(keys[i]!)
      }
    })
    return { ok, failed }
  }

  /** Restore the edited fields of just the failed issues from their pre-edit snapshots. */
  function revertFailed(
    originals: Map<string, Task>,
    failed: BulkFailure[],
    restore: (task: Task, original: Task) => Task,
  ) {
    if (failed.length === 0) {
      return
    }
    setBoard((b) => ({
      ...b,
      tasks: b.tasks.map((t) => {
        const original = originals.get(t.key)
        return original && failed.some((f) => f.key === t.key) ? restore(t, original) : t
      }),
    }))
  }

  /** `3 moved`, or `2 moved · 1 failed (SHOP-9: …)` — the whole outcome in one toast. */
  function bulkToast(done: number, verb: string, failed: BulkFailure[]) {
    if (failed.length === 0) {
      showToast(`${done} ${verb}`)
      return
    }
    const first = failed[0]!
    showToast(`${done} ${verb} · ${failed.length} failed (${first.key}: ${first.message})`)
  }

  /** The selected issues as tasks, minus ones a refresh may have dropped. */
  function bulkTargets(keys: string[]): Task[] {
    return keys.map((key) => board.tasks.find((t) => t.key === key)).filter((t): t is Task => !!t)
  }

  /** Move several issues to one status; `resolution` makes it a bulk close (specs/053). */
  async function bulkMoveTo(keys: string[], toColumnId: string, resolution?: string) {
    const targets = bulkTargets(keys).filter((t) => t.columnId !== toColumnId)
    if (targets.length === 0) {
      return
    }
    const originals = new Map(targets.map((t) => [t.key, t]))
    const closing = toColumnId === board.columns[board.columns.length - 1]?.id
    const landed = resolution ?? (closing ? provider.defaultResolution : undefined)
    setBoard((b) => ({
      ...b,
      tasks: b.tasks.map((t) =>
        originals.has(t.key)
          ? { ...t, columnId: toColumnId, resolution: landed ?? t.resolution }
          : t,
      ),
    }))
    const { ok, failed } = await fanOut([...originals.keys()], (key) =>
      provider.moveTask(key, toColumnId, resolution),
    )
    revertFailed(originals, failed, (t, original) => ({
      ...t,
      columnId: original.columnId,
      resolution: original.resolution,
    }))
    bulkToast(ok.length, resolution ? `closed as ${resolution}` : "moved", failed)
  }

  /** Rewrite the reason on several already-closed issues (specs/053), no transition. */
  function bulkResolution(keys: string[], resolution: string) {
    if (!provider.setResolution) {
      return
    }
    const targets = bulkTargets(keys)
    if (targets.length === 0) {
      return
    }
    const originals = new Map(targets.map((t) => [t.key, t]))
    setBoard((b) => ({
      ...b,
      tasks: b.tasks.map((t) => (originals.has(t.key) ? { ...t, resolution } : t)),
    }))
    void (async () => {
      const { ok, failed } = await fanOut([...originals.keys()], (key) =>
        provider.setResolution!(key, resolution),
      )
      revertFailed(originals, failed, (t, original) => ({ ...t, resolution: original.resolution }))
      bulkToast(ok.length, `closed as ${resolution}`, failed)
    })()
  }

  /** Reassign several issues to the one picked person (or unassign them all). */
  function bulkAssign(keys: string[], chosen: AssignCandidate | null, typed: string) {
    const unassign = chosen?.value === null
    const label = unassign ? undefined : chosen ? chosen.label : typed
    const targets = bulkTargets(keys)
    if (targets.length === 0) {
      return
    }
    const originals = new Map(targets.map((t) => [t.key, t]))
    setBoard((b) => ({
      ...b,
      tasks: b.tasks.map((t) =>
        originals.has(t.key) ? { ...t, assignee: label, assigneeId: undefined } : t,
      ),
    }))
    void (async () => {
      const resolved = await resolveAssignId(chosen, typed).catch((err: unknown) => {
        // The one shared step: with no id nothing was written, so everything reverts.
        revertFailed(
          originals,
          targets.map((t) => ({ key: t.key, message: "" })),
          (t, original) => ({ ...t, assignee: original.assignee, assigneeId: original.assigneeId }),
        )
        showToast(`assign failed: ${err instanceof Error ? err.message : String(err)}`)
        return undefined
      })
      if (resolved === undefined) {
        return
      }
      const { ok, failed } = await fanOut([...originals.keys()], (key) =>
        provider.assignTask(key, resolved),
      )
      if (resolved !== null && ok.length > 0) {
        setBoard((b) => ({
          ...b,
          tasks: b.tasks.map((t) => (ok.includes(t.key) ? { ...t, assigneeId: resolved } : t)),
        }))
      }
      revertFailed(originals, failed, (t, original) => ({
        ...t,
        assignee: original.assignee,
        assigneeId: original.assigneeId,
      }))
      bulkToast(ok.length, unassign ? "unassigned" : `→ ${label}`, failed)
    })()
  }

  /** Re-link (or detach) the epic on several issues. */
  function bulkSetEpic(keys: string[], chosen: PickItem | null) {
    if (!chosen) {
      return
    }
    const epicKey = chosen.value
    const epicName = epicKey ? chosen.label : undefined
    const targets = bulkTargets(keys)
    if (targets.length === 0) {
      return
    }
    const originals = new Map(targets.map((t) => [t.key, t]))
    setBoard((b) => ({
      ...b,
      tasks: b.tasks.map((t) =>
        originals.has(t.key) ? { ...t, epicKey: epicKey ?? undefined, epicName } : t,
      ),
    }))
    void (async () => {
      const { ok, failed } = await fanOut([...originals.keys()], (key) =>
        provider.setEpic(key, epicKey),
      )
      revertFailed(originals, failed, (t, original) => ({
        ...t,
        epicKey: original.epicKey,
        epicName: original.epicName,
      }))
      bulkToast(ok.length, epicKey ? `→ ${chosen.label}` : "epics cleared", failed)
    })()
  }

  /**
   * Apply a label *diff* to several issues: `add`/`remove` against each issue's own
   * set, so labels the bulk editor never showed stay untouched — a replace would
   * silently wipe whatever the issues didn't have in common.
   */
  function bulkSetLabels(keys: string[], add: string[], remove: string[]) {
    if (add.length === 0 && remove.length === 0) {
      return
    }
    const targets = bulkTargets(keys)
    if (targets.length === 0) {
      return
    }
    const nexts = new Map(
      targets.map((t) => [
        t.key,
        [
          ...(t.labels ?? []).filter((l) => !remove.includes(l)),
          ...add.filter((l) => !(t.labels ?? []).includes(l)),
        ],
      ]),
    )
    const originals = new Map(targets.map((t) => [t.key, t]))
    setBoard((b) => ({
      ...b,
      tasks: b.tasks.map((t) => (nexts.has(t.key) ? { ...t, labels: nexts.get(t.key) } : t)),
    }))
    void (async () => {
      const { ok, failed } = await fanOut([...originals.keys()], (key) =>
        provider.setLabels(key, nexts.get(key)!),
      )
      revertFailed(originals, failed, (t, original) => ({ ...t, labels: original.labels }))
      const change = [...add.map((l) => `+${l}`), ...remove.map((l) => `-${l}`)].join(" ")
      bulkToast(ok.length, `labels ${change}`, failed)
    })()
  }

  return {
    moveTo,
    submitResolution,
    transition,
    applyRank,
    submitEpic,
    submitLabels,
    submitAssign,
    submitEdit,
    submitIssueEdit,
    bulkMoveTo,
    bulkResolution,
    bulkAssign,
    bulkSetEpic,
    bulkSetLabels,
  }
}
