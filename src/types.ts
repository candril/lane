/**
 * Core domain types for the board.
 *
 * These deliberately mirror the shape of a Jira issue so that a real Jira
 * provider can populate them later without the UI having to change. For now
 * they are filled from local mock data (see providers/mock.ts).
 */

export type Priority = "highest" | "high" | "medium" | "low" | "lowest"

export type IssueType = "story" | "bug" | "task" | "epic" | "subtask"

/**
 * A Jira sprint, as the sprint custom field reports it (specs/050). Only `active` and
 * `future` sprints ever reach a card: an issue whose sprints are all closed reads as
 * having none, so a full-project query doesn't grow a lane per historical sprint.
 */
export interface Sprint {
  id: number
  name: string
  state: "active" | "future"
  /** ISO timestamps as Jira returns them; absent on a sprint not yet scheduled. */
  startDate?: string
  endDate?: string
}

/** A single card on the board — one Jira issue. */
export interface Task {
  /** Jira issue key, e.g. "PROJ-123". */
  key: string
  summary: string
  type: IssueType
  priority: Priority
  /** Display name of the assignee, if any (shown on the card). */
  assignee?: string
  /**
   * The assignee's Jira `accountId` — the exact identifier the REST assignee
   * endpoint needs (specs/027); a display name won't do. Absent for the mock /
   * unassigned.
   */
  assigneeId?: string
  /** Story points / estimate, if any. */
  points?: number
  /**
   * ID of the column this task sits in — i.e. its status. For a sub-task this is
   * its own status, which may differ from the column its parent renders in; the
   * board shows it as a status badge (see grouping.ts).
   */
  columnId: string
  /**
   * The issue's own Jira status name. `columnId` is where *this board* puts it, which
   * says nothing about an issue from another project — a search result (specs/046)
   * would otherwise report the fallback column as its status.
   */
  status?: string
  /**
   * The issue's resolution — *why* it ended, not just that it did (specs/053). Jira
   * requires one on the transitions into Done, so a closed card always carries it;
   * absent on anything still open.
   */
  resolution?: string
  /** Key of the parent issue, if this is a sub-task. */
  parentKey?: string
  /**
   * Key of the epic this issue is linked to, if any (specs/034). Distinct from
   * {@link parentKey}: this is the epic link (a different hierarchy level), used to
   * group issues under their epic in the backlog view.
   */
  epicKey?: string
  /**
   * The linked epic's summary, when the provider can source it (specs/029) — Jira's
   * `parent.fields.summary` on the unified model, or a lookup among loaded epics for
   * the mock. Drives the epic tag's label; absent → the tag falls back to {@link epicKey}.
   */
  epicName?: string
  /** Jira labels, for query-based swimlanes (specs/016) and filtering. */
  labels?: string[]
  /**
   * The live sprint this issue sits in (specs/050) — what the `sprint` grouping lanes
   * by. Absent on a kanban board, and on backlog work no sprint has claimed yet.
   */
  sprint?: Sprint
}

/**
 * The fields a caller supplies to create an issue. The provider assigns the rest
 * — the real key, the landing column (always the board's first), and any board
 * defaults (team, component, …) — and returns the resulting {@link Task}.
 */
export interface CreateInput {
  type: IssueType
  summary: string
  /** Sub-task's parent issue key (the lane link) — set only when creating a sub-task. */
  parentKey?: string
  /**
   * Epic to file this issue under (a story/task/bug created in an epic's context).
   * Distinct from {@link parentKey}: this is the epic link, not a sub-task parent, so
   * the created issue is a normal top-level card — not nested as a sub-task.
   */
  epicKey?: string
}

/** A vertical lane on the board — maps to a Jira status / workflow step. */
export interface Column {
  id: string
  title: string
}

/** The full board: ordered columns plus the tasks that populate them. */
export interface Board {
  columns: Column[]
  tasks: Task[]
  /**
   * Statuses the board config keeps *off* the board (specs/044) — Jira's Kanban
   * backlog — as columns, in configured order. An issue in one of these is rendered
   * by the backlog tab, never the board. Absent when the board defines no backlog.
   */
  backlog?: Column[]
}

/** A board with nothing in it — the placeholder shown before the first fetch. */
export const EMPTY_BOARD: Board = { columns: [], tasks: [] }
