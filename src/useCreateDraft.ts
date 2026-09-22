import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react"
import { typeGlyph } from "./utils/glyphs"
import type { Lane, ListRow } from "./grouping"
import type { Board as BoardModel, IssueType, Task } from "./types"
import type { BoardProvider } from "./providers/provider"
import type { TabMode } from "./tabs"
import { discardIssue, isPendingKey, landPending, pendingKey, withoutTask } from "./pendingCreate"

/**
 * An in-progress quick-add. `type` may be toggled (Ctrl-T); `contextParent` is
 * the lane parent this can nest under — the card attaches to it only while
 * `type` is "subtask", and detaches (top-level) once toggled away.
 */
export interface Draft {
  type: IssueType
  /**
   * The issue this new one files under (via Jira's `-P`), and how:
   * - `epic` → a child issue (story/task/bug) linked to the epic,
   * - `issue` → a sub-task under a story/task/bug.
   */
  contextParent: { key: string; color: string; kind: "epic" | "issue" } | null
  /** Seeds the field — a retry reopens with what was typed (specs/059). */
  summary?: string
}

/**
 * The bottom line that follows a create (specs/059). `pending` and `created` offer undo;
 * `failed` stays until dismissed, and carries the draft back when the create was the
 * thing that failed.
 */
export type CreateNotice =
  | { kind: "pending"; tempKey: string; summary: string; openWhenLanded?: boolean }
  | { kind: "created"; tempKey: string; key: string }
  /**
   * Undo asked to confirm (specs/059): it deletes a real issue, which no other key in
   * lane does. `back` is the notice it returns to when the answer is no.
   */
  | { kind: "confirm"; subject: string; back: CreateNotice }
  | { kind: "failed"; message: string; retry?: Draft }

const CREATED_NOTICE_MS = 5000

/** Top-level types the Ctrl-T toggle cycles through (no context parent) — incl. epic. */
const TOP_LEVEL_TYPES: IssueType[] = ["story", "task", "bug", "epic"]
/** An epic's children — never a sub-task, never another epic. */
const EPIC_CHILD_TYPES: IssueType[] = ["story", "task", "bug"]
/** Under a story/task/bug: a sub-task, or detach to a top-level story/task/bug. */
const ISSUE_CONTEXT_TYPES: IssueType[] = ["subtask", "story", "task", "bug"]

/** The type cycle for the current create context. */
function createTypeCycle(context: Draft["contextParent"]): IssueType[] {
  if (!context) {
    return TOP_LEVEL_TYPES
  }
  return context.kind === "epic" ? EPIC_CHILD_TYPES : ISSUE_CONTEXT_TYPES
}

/**
 * What a quick-add needs of the issue it files under. A {@link Task} wherever the
 * board or the viewer's fetch holds one — but a link to an issue neither holds, the
 * epic above a board's stories above all (specs/057), is never more than this.
 */
export interface CreateAnchor {
  key: string
  type: IssueType
  parentKey?: string
}

/**
 * The parent a quick-add files under, given the issue in context: that issue, or — a
 * sub-task cannot parent another — the parent it hangs off, which is what makes `n`
 * on a sub-task a sibling rather than a refusal.
 */
export function createParent(
  anchor: CreateAnchor | undefined,
  tasks: Task[],
): Draft["contextParent"] {
  const parent = anchor?.parentKey ? tasks.find((t) => t.key === anchor.parentKey) : anchor
  if (!parent || parent.type === "subtask") {
    return null
  }
  return {
    key: parent.key,
    color: typeGlyph(parent.type).color,
    kind: parent.type === "epic" ? "epic" : "issue",
  }
}

/**
 * The quick-add flow: open a draft that picks a sensible parent + type from the
 * current focus, cycle the type (Ctrl-T), and create through the provider. The card
 * lands at once under a placeholder key and takes the real one when Jira answers
 * (specs/059); the notice that follows offers undo, or keeps a failure until dismissed.
 */
export function useCreateDraft(args: {
  board: BoardModel
  view: TabMode
  focusedKey: string | null
  laneHeader: Lane["header"]
  rows: ListRow[]
  listFocus: number
  /** The item the detail viewer's cursor is on, when it is the thing on screen. */
  detailAnchor: CreateAnchor | undefined
  provider: BoardProvider
  setBoard: Dispatch<SetStateAction<BoardModel>>
  pendingMutations: MutableRefObject<number>
  settleMutation: () => void
  showToast: (message: string) => void
  /** Open the viewer on an issue — what `↵` on the notice does (specs/059). */
  openIssue: (key: string) => void
}) {
  const { board, view, focusedKey, laneHeader, rows, listFocus, detailAnchor } = args
  const { provider, setBoard, pendingMutations, settleMutation, showToast, openIssue } = args
  const [creating, setCreating] = useState<Draft | null>(null)
  // Sticky last-used create type — seeds the next quick-add outside a lane.
  const lastTypeRef = useRef<IssueType>("task")
  const pendingCount = useRef(0)
  // Placeholders undone while their POST was still out: the POST can't be recalled,
  // so the issue it creates is discarded as soon as it lands.
  const cancelled = useRef(new Set<string>())

  const [notice, setNotice] = useState<CreateNotice | null>(null)
  // Async landings decide off the notice as it is *now*, not as their closure saw it.
  const noticeRef = useRef<CreateNotice | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (noticeTimer.current) {
        clearTimeout(noticeTimer.current)
      }
    },
    [],
  )

  function showNotice(next: CreateNotice | null) {
    if (noticeTimer.current) {
      clearTimeout(noticeTimer.current)
      noticeTimer.current = null
    }
    noticeRef.current = next
    setNotice(next)
    if (next?.kind === "created") {
      noticeTimer.current = setTimeout(() => showNotice(null), CREATED_NOTICE_MS)
    }
  }

  /**
   * The issue in context for a quick-add. The viewer owns it while it is up
   * (specs/057) — the item under *its* cursor, never the card left behind the
   * overlay. On the board a focused card wins, falling back to a focused parent-lane
   * header (by-parent view / an empty cell in a parent lane).
   */
  function contextAnchor(): CreateAnchor | undefined {
    if (detailAnchor) {
      return detailAnchor
    }
    if (view !== "board") {
      return rows[listFocus]?.task
    }
    const focus = focusedKey ? board.tasks.find((t) => t.key === focusedKey) : undefined
    return focus ?? (laneHeader?.kind === "issue" ? laneHeader.task : undefined)
  }

  /** Open the quick-add line. `n` defaults to a sub-task under the issue in context
   * (its own parent if that issue is a sub-task, so `n` on one gives a sibling).
   * `topLevel` (N) skips that and always starts a top-level issue of the sticky
   * last-used type. Over a failed create, `n` reopens that draft instead and `N`
   * drops it (specs/059). */
  function startCreate(topLevel: boolean) {
    const failed = noticeRef.current?.kind === "failed" ? noticeRef.current : null
    if (failed) {
      showNotice(null)
      if (!topLevel && failed.retry) {
        setCreating(failed.retry)
        return
      }
    }
    const contextParent = createParent(topLevel ? undefined : contextAnchor(), board.tasks)
    if (isPendingKey(contextParent?.key)) {
      showToast("still being created")
      return
    }
    // Under an epic → a child issue (default the sticky type if it's a valid child,
    // else a story). Under a story/task/bug → a sub-task. No context → sticky type.
    const type = !contextParent
      ? lastTypeRef.current
      : contextParent.kind === "epic"
        ? EPIC_CHILD_TYPES.includes(lastTypeRef.current)
          ? lastTypeRef.current
          : "story"
        : "subtask"
    setCreating({ type, contextParent })
  }

  function cycleCreateType() {
    setCreating((d) => {
      if (!d) {
        return d
      }
      const cycle = createTypeCycle(d.contextParent)
      const next = cycle[(cycle.indexOf(d.type) + 1) % cycle.length]!
      return { ...d, type: next }
    })
  }

  function submitCreate(summary: string) {
    const draft = creating
    if (!draft) {
      return
    }
    const trimmed = summary.trim()
    setCreating(null)
    if (!trimmed) {
      return
    }
    const cp = draft.contextParent
    const parentKey = cp?.kind === "issue" && draft.type === "subtask" ? cp.key : undefined
    const epicKey = cp?.kind === "epic" ? cp.key : undefined
    if (draft.type !== "subtask") {
      lastTypeRef.current = draft.type
    }
    const tempKey = pendingKey(++pendingCount.current)
    const placeholder: Task = {
      key: tempKey,
      summary: trimmed,
      type: draft.type,
      priority: "medium",
      columnId: board.columns[0]?.id ?? "",
      parentKey,
      epicKey,
      epicName: epicKey ? board.tasks.find((t) => t.key === epicKey)?.summary : undefined,
    }
    setBoard((b) => ({ ...b, tasks: [...b.tasks, placeholder] }))
    showNotice({ kind: "pending", tempKey, summary: trimmed })
    pendingMutations.current++
    void (async () => {
      try {
        const task = await provider.createIssue({
          type: draft.type,
          summary: trimmed,
          parentKey,
          epicKey,
        })
        if (cancelled.current.delete(tempKey)) {
          void discard(task)
          return
        }
        setBoard((b) => landPending(b, tempKey, task))
        const current = noticeRef.current
        if (current?.kind === "pending" && current.tempKey === tempKey) {
          showNotice({ kind: "created", tempKey, key: task.key })
          // ↵ pressed while it was still in flight: open it now that there is
          // something to open (specs/059).
          if (current.openWhenLanded) {
            openIssue(task.key)
          }
        }
      } catch (err) {
        setBoard((b) => withoutTask(b, tempKey))
        if (!cancelled.current.delete(tempKey)) {
          showNotice({
            kind: "failed",
            message: `not created: ${errorText(err)}`,
            retry: { ...draft, summary: trimmed },
          })
        }
      } finally {
        settleMutation()
      }
    })()
  }

  /**
   * `↵` on the notice: open the new issue in the viewer, where its children, assignee
   * and the rest can be set. Before the key lands there is nothing to open, so the
   * press is remembered and honoured on arrival (specs/059).
   */
  function openCreated() {
    const current = noticeRef.current
    if (current?.kind === "created") {
      showNotice(null)
      openIssue(current.key)
    } else if (current?.kind === "pending") {
      showNotice({ ...current, openWhenLanded: true })
    }
  }

  /** `u` on the notice: ask first — this deletes an issue (specs/059). */
  function undoCreate() {
    const current = noticeRef.current
    if (current?.kind !== "pending" && current?.kind !== "created") {
      return
    }
    showNotice({
      kind: "confirm",
      subject: current.kind === "created" ? current.key : `“${current.summary}”`,
      back: current,
    })
  }

  /** The answer is no: back to the notice it interrupted. */
  function cancelUndoCreate() {
    const current = noticeRef.current
    showNotice(current?.kind === "confirm" ? current.back : current)
  }

  /** The answer is yes: drop the card and delete the issue behind it. */
  function confirmUndoCreate() {
    const confirming = noticeRef.current
    if (confirming?.kind !== "confirm") {
      return
    }
    const current = confirming.back
    if (current.kind !== "pending" && current.kind !== "created") {
      return
    }
    showNotice(null)
    if (current.kind === "pending") {
      cancelled.current.add(current.tempKey)
      setBoard((b) => withoutTask(b, current.tempKey))
      showToast("create undone")
      return
    }
    const task = board.tasks.find((t) => t.key === current.key)
    setBoard((b) => withoutTask(b, current.key))
    if (task) {
      void discard(task)
    }
  }

  /**
   * Delete a landed issue whose card is already gone, or close it where deleting is
   * refused — in which case it still exists, so its card comes back in the last
   * column. When both fail the card comes back as it was.
   */
  async function discard(task: Task) {
    const doneColumnId = board.columns[board.columns.length - 1]?.id ?? task.columnId
    pendingMutations.current++
    try {
      const result = await discardIssue(provider, task.key, doneColumnId)
      if (result.deleted) {
        showToast(`${task.key} deleted`)
      } else {
        const closed = { ...task, columnId: doneColumnId, resolution: result.resolution }
        setBoard((b) => ({ ...b, tasks: [...b.tasks, closed] }))
        showToast(`${task.key} closed as ${result.resolution} (couldn't delete)`)
      }
    } catch (err) {
      setBoard((b) => ({ ...b, tasks: [...b.tasks, task] }))
      showNotice({ kind: "failed", message: `${task.key} not undone: ${errorText(err)}` })
    } finally {
      settleMutation()
    }
  }

  /** Esc over a failure: only a failure — the undo notice leaves by itself. */
  function dismissCreateFailure(): boolean {
    if (noticeRef.current?.kind !== "failed") {
      return false
    }
    showNotice(null)
    return true
  }

  return {
    creating,
    setCreating,
    startCreate,
    cycleCreateType,
    submitCreate,
    createNotice: notice,
    openCreated,
    undoCreate,
    cancelUndoCreate,
    confirmUndoCreate,
    dismissCreateFailure,
  }
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
