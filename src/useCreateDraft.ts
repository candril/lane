import { useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react"
import { typeGlyph } from "./utils/glyphs"
import type { Lane, ListRow } from "./grouping"
import type { Board as BoardModel, IssueType, Task } from "./types"
import type { BoardProvider } from "./providers/provider"
import type { TabMode } from "./tabs"

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
  submitting: boolean
  error?: string
}

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
 * current focus, cycle the type (Ctrl-T), and create through the provider — adding
 * the card only once it lands (specs/012). Optimistic-insert isn't safe here because
 * the server assigns the key/column.
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
}) {
  const { board, view, focusedKey, laneHeader, rows, listFocus, detailAnchor } = args
  const { provider, setBoard, pendingMutations, settleMutation } = args
  const [creating, setCreating] = useState<Draft | null>(null)
  // Sticky last-used create type — seeds the next quick-add outside a lane.
  const lastTypeRef = useRef<IssueType>("task")

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
   * last-used type. */
  function startCreate(topLevel: boolean) {
    const contextParent = createParent(topLevel ? undefined : contextAnchor(), board.tasks)
    // Under an epic → a child issue (default the sticky type if it's a valid child,
    // else a story). Under a story/task/bug → a sub-task. No context → sticky type.
    const type = !contextParent
      ? lastTypeRef.current
      : contextParent.kind === "epic"
        ? EPIC_CHILD_TYPES.includes(lastTypeRef.current)
          ? lastTypeRef.current
          : "story"
        : "subtask"
    setCreating({ type, contextParent, submitting: false })
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

  /** Pending insert: create through the provider, add the card only once it lands. */
  function submitCreate(summary: string) {
    const draft = creating
    if (!draft || draft.submitting) {
      return
    }
    const trimmed = summary.trim()
    if (!trimmed) {
      setCreating(null)
      return
    }
    const cp = draft.contextParent
    const parentKey = cp?.kind === "issue" && draft.type === "subtask" ? cp.key : undefined
    const epicKey = cp?.kind === "epic" ? cp.key : undefined
    if (draft.type !== "subtask") {
      lastTypeRef.current = draft.type
    }
    setCreating({ ...draft, submitting: true, error: undefined })
    pendingMutations.current++
    void (async () => {
      try {
        const task = await provider.createIssue({
          type: draft.type,
          summary: trimmed,
          parentKey,
          epicKey,
        })
        setBoard((b) => ({ ...b, tasks: [...b.tasks, task] }))
        setCreating(null)
      } catch (err) {
        setCreating((d) =>
          d
            ? { ...d, submitting: false, error: err instanceof Error ? err.message : String(err) }
            : d,
        )
      } finally {
        settleMutation()
      }
    })()
  }

  return { creating, setCreating, startCreate, cycleCreateType, submitCreate }
}
