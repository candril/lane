import type { Board, CreateInput, Task } from "../types"

/**
 * One issue as the detail view needs it (specs/007): the board's own record of it,
 * plus the description the board query deliberately doesn't fetch. `description` is
 * Markdown — converted from whatever the source stores (ADF, for Jira) by the
 * provider, so the UI never sees a backend document format.
 */
/** One field change inside a changelog entry (specs/058). Text values, as Jira renders them. */
export interface ChangeItem {
  /** The field's name, lower-cased: `status`, `assignee`, `description`, `summary`, … */
  field: string
  from?: string
  to?: string
}

/** One changelog entry (specs/058): who changed what, when. */
export interface ChangeEntry {
  /** ISO timestamp. */
  at: string
  author: string
  items: ChangeItem[]
}

export interface IssueDetail {
  task: Task
  description: string
  /** The issue's changelog, newest first (specs/058). Absent when the source has none. */
  history?: ChangeEntry[]
  /**
   * Description node types the conversion could not represent (specs/007). Empty for
   * a description that survives a round trip; non-empty makes it read-only rather
   * than risking a lossy save (specs/049).
   */
  unsupported: string[]
}

/**
 * The seam between the UI and a data source. The UI only ever talks to this
 * interface — backed by the in-memory mock or the Jira REST provider (see
 * specs/005). Mutations are async on purpose: a card move is "local update
 * + backend transition", so keeping the write path asynchronous from day one
 * means the optimistic-update / revert-on-failure flow is real, not retrofitted
 * once the network arrives.
 */
export interface BoardProvider {
  loadBoard(): Promise<Board>
  /**
   * Run a JQL query and return what it finds (specs/046). Unlike {@link loadBoard} the
   * result is not a board: these issues can come from any project, so their `columnId`
   * may map to no column here — the search list shows the raw status instead.
   */
  searchIssues?(jql: string, limit: number): Promise<Task[]>
  /**
   * Fetch one issue in full, including its description (specs/007). Separate from
   * {@link loadBoard} because a description is far too heavy to pull for every card;
   * the viewer asks for one only when it opens. Optional — a source without it shows
   * the fields the board already knows and no description.
   */
  loadIssue?(key: string): Promise<IssueDetail>
  /**
   * What hangs off one issue — an epic's stories, a story's sub-tasks — regardless of
   * whether the board's query matched them (specs/057). The viewer asks for this where
   * the board can't answer: an issue reached from search, or an epic whose stories live
   * outside the query. Optional — a source without it lists only what the board holds.
   */
  loadChildren?(key: string): Promise<Task[]>
  /**
   * Transition an issue to a new status (column id). Rejects if the backend refuses.
   * `resolution` names the reason a close carries (specs/053); the provider attaches it
   * only where the workflow's transition asks for one, and falls back to its configured
   * default when the caller passes nothing — so an ordinary move needs no argument.
   */
  moveTask(key: string, toColumnId: string, resolution?: string): Promise<void>
  /**
   * Transition an issue to a status *by name*, bypassing the column mapping (specs/047).
   * A query-backed source derives its columns from the statuses its results carry, so
   * they exist in no board config and {@link moveTask} would reject them. Optional — a
   * source without it simply can't back a query tab.
   */
  transitionTo?(key: string, status: string, resolution?: string): Promise<void>
  /**
   * Create an issue from {@link CreateInput}, returning it as it should land on
   * the board (real key, first column). Rejects if the backend refuses; the UI
   * only inserts the card once this resolves.
   */
  createIssue(input: CreateInput): Promise<Task>
  /** Rename an issue — set its summary/title. Rejects if the backend refuses. */
  editSummary(key: string, summary: string): Promise<void>
  /**
   * Replace an issue's description with `markdown` (specs/049) — the provider converts
   * to whatever the backend stores. Optional: without it the description is read-only
   * and the editor hand-off edits the summary alone.
   */
  editDescription?(key: string, markdown: string): Promise<void>
  /** Replace an issue's labels with `labels` (specs/028). Rejects if the backend refuses. */
  setLabels(key: string, labels: string[]): Promise<void>
  /**
   * Link an issue to an epic by key, or detach it with `null` (specs/038). Writes the
   * configured epic-link field (`parent` on the unified model, else a custom Epic Link
   * field). Rejects if the backend refuses.
   */
  setEpic(key: string, epicKey: string | null): Promise<void>
  /**
   * Re-rank `key` relative to an anchor issue: place it immediately before or after
   * `anchor` in the board's global rank order. Rejects if the backend refuses.
   * Optional — a data source without a rank concept omits it, and the UI hides the
   * reorder gesture.
   */
  rankTask?(key: string, anchor: { before: string } | { after: string }): Promise<void>
  /**
   * Assign an issue to a user by an exact identifier (an `accountId` for Jira, a
   * display name for the mock), or unassign with `null`. The REST assignee
   * endpoint needs an `accountId`, so callers resolve first via
   * {@link resolveAssignee} (specs/027).
   */
  assignTask(key: string, assignee: string | null): Promise<void>
  /**
   * Resolve the current assignee of `sampleKey` to the exact identifier
   * {@link assignTask} needs, plus their display name for a staleness check
   * (specs/027). Providers that already hand back a usable id (the mock) omit
   * this, and the caller uses the candidate value directly.
   */
  resolveAssignee?(sampleKey: string): Promise<{ id: string; displayName: string }>
  /**
   * The reason this source stamps on a close when the caller names none (specs/053).
   * Reported so the optimistic board can show what the write will land, rather than
   * leaving the card reasonless until the next refresh.
   */
  readonly defaultResolution?: string
  /**
   * Every reason a close can carry (specs/053), in the order the backend lists them.
   * Fetched once, lazily — the first time the picker opens. Optional: a source without
   * it offers no reason picker at all.
   */
  listResolutions?(): Promise<string[]>
  /**
   * Set an already-closed issue's resolution without touching its status (specs/053) —
   * the "in hindsight" write. Separate from {@link moveTask} because it is a plain field
   * edit, not a transition. Rejects if the backend refuses.
   */
  setResolution?(key: string, resolution: string): Promise<void>
  /** Web URL for an issue (browser open / copy-URL actions), if this source has one. */
  issueUrl?(key: string): string | undefined
}
