/**
 * A provider whose board *is* a query (specs/047).
 *
 * It wraps the provider the query was run through and overrides only how the board is
 * loaded: run the JQL, then shape the results into a `Board`. Every mutation that takes
 * a key and a value — assign, rename, labels, epic — delegates untouched, which is the
 * whole point: a search result set becomes a board and the existing mutation layer works
 * on it with no per-action plumbing.
 *
 * Two things can't delegate. `moveTask` is a column concept and the columns here are
 * derived (see below), so it transitions by status name instead. `createIssue` is refused
 * outright: a new issue would be filed into the origin board's project and then vanish on
 * the next refresh, since it rarely matches the query that made the tab.
 */

import type { Board, Column, CreateInput, Task } from "../types"
import { slug } from "./jira"
import type { BoardProvider } from "./provider"

/**
 * How many issues a query tab will hold. A board's JQL is written to bound itself; a
 * text search is not, so something has to stop `text ~ "a*"` from paging all day.
 */
export const QUERY_LIMIT = 200

/**
 * Sub-tasks are fetched on top of the matched issues, so they need their own ceiling —
 * a set of parents routinely carries more sub-tasks than parents.
 */
const SUBTASK_LIMIT = QUERY_LIMIT * 2

const UNKNOWN_STATUS = "Unknown"

export interface QueryProviderOptions {
  /**
   * Column titles to order the derived columns by — the origin board's, so a query that
   * stayed inside one project reads left-to-right like the board it came from. Statuses
   * the order doesn't mention are appended.
   */
  columnOrder?: string[]
}

/**
 * The columns a result set implies: one per status present, since results can come from
 * any project and the origin board's columns would map nothing for those that didn't
 * (specs/047). The board's shape therefore shifts as results change — accepted: a status
 * no result carries has no column worth keeping.
 */
export function deriveColumns(tasks: Task[], columnOrder: string[] = []): Column[] {
  const rank = new Map(columnOrder.map((title, i) => [title.toLowerCase(), i]))
  const statuses = [...new Set(tasks.map((t) => t.status?.trim() || UNKNOWN_STATUS))]
  const unranked = Number.MAX_SAFE_INTEGER
  return statuses
    .map((status, seen) => ({ status, seen }))
    .sort((a, b) => {
      const byRank =
        (rank.get(a.status.toLowerCase()) ?? unranked) -
        (rank.get(b.status.toLowerCase()) ?? unranked)
      return byRank !== 0 ? byRank : a.seen - b.seen
    })
    .map(({ status }) => ({ id: slug(status) || UNKNOWN_STATUS.toLowerCase(), title: status }))
}

/**
 * The sub-tasks of what the query matched, as a second query — the same two-step a board
 * load does (specs/005), and for the same reason: a sub-task's parent is its story, so a
 * query for an epic's issues returns the stories and none of their sub-tasks. Without
 * this a query tab has no sub-task tree to fold, filter or nest (specs/008, specs/042,
 * specs/043) — it is half a board.
 */
async function subtasksOf(matched: Task[], base: BoardProvider): Promise<Task[]> {
  const parents = matched.filter((t) => t.type !== "subtask").map((t) => t.key)
  if (parents.length === 0 || !base.searchIssues) {
    return []
  }
  const jql = `parent in (${parents.join(",")}) AND issuetype in subTaskIssueTypes()`
  const found = await base.searchIssues(jql, SUBTASK_LIMIT)
  // A query that already returned sub-tasks (`type:subtask`) would otherwise get them twice.
  const seen = new Set(matched.map((t) => t.key))
  return found.filter((t) => !seen.has(t.key))
}

export function createQueryProvider(
  base: BoardProvider,
  jql: string,
  options: QueryProviderOptions = {},
): BoardProvider {
  // The status behind each derived column, refreshed with every load — `moveTask` gets a
  // column id and has to name a status, and the columns only exist once results arrive.
  let statusOf = new Map<string, string>()

  return {
    async loadBoard(): Promise<Board> {
      if (!base.searchIssues) {
        throw new Error("this data source can't run a query")
      }
      const matched = await base.searchIssues(jql, QUERY_LIMIT)
      const found = [...matched, ...(await subtasksOf(matched, base))]
      const columns = deriveColumns(found, options.columnOrder)
      statusOf = new Map(columns.map((c) => [c.id, c.title]))
      const columnFor = new Map(columns.map((c) => [c.title.toLowerCase(), c.id]))
      const tasks = found.map((task) => ({
        ...task,
        columnId:
          columnFor.get((task.status?.trim() || UNKNOWN_STATUS).toLowerCase()) ?? columns[0]!.id,
      }))
      return { columns, tasks }
    },

    async moveTask(key: string, toColumnId: string): Promise<void> {
      const status = statusOf.get(toColumnId)
      if (!status || !base.transitionTo) {
        throw new Error(`can't move ${key} here`)
      }
      // The target status belongs to *this* board's result set, which a cross-project
      // issue's workflow may not offer. Let the transition say so rather than guessing.
      await base.transitionTo(key, status)
    },

    createIssue(_input: CreateInput): Promise<Task> {
      return Promise.reject(new Error("can't create an issue in a search tab"))
    },

    searchIssues: base.searchIssues?.bind(base),
    // The per-issue reads and writes are keyed, not column-shaped, so they delegate
    // like the mutations above: without `loadIssue` the viewer (specs/007) shows a
    // result with no description and can't follow a link off the tab (specs/057).
    loadIssue: base.loadIssue?.bind(base),
    loadChildren: base.loadChildren?.bind(base),
    editSummary: base.editSummary.bind(base),
    editDescription: base.editDescription?.bind(base),
    setLabels: base.setLabels.bind(base),
    setEpic: base.setEpic.bind(base),
    assignTask: base.assignTask.bind(base),
    resolveAssignee: base.resolveAssignee?.bind(base),
    transitionTo: base.transitionTo?.bind(base),
    listResolutions: base.listResolutions?.bind(base),
    setResolution: base.setResolution?.bind(base),
    defaultResolution: base.defaultResolution,
    issueUrl: base.issueUrl?.bind(base),
    // `rankTask` is deliberately absent: rank is a board's global order, and a result set
    // has none of its own to persist — so the reorder gesture hides itself (specs/047).
  }
}
