/**
 * User config schema (specs/015). Parsed from `~/.config/lane/config.toml` and
 * validated into these types before anything else runs. The `[jira]` table holds
 * instance-wide provider settings; each `[[boards]]` entry is one board
 * (specs/016) with its own filter query.
 *
 * Columns / filter / swimlanes are defined here by hand; the schema deliberately
 * mirrors a Jira board's shape so `lane import` can also scaffold an entry from a
 * real board's config (specs/018).
 */

import type { IssueType } from "../types"

/**
 * Override the Jira issue-type *name* per kind (specs/012). Jira type names vary
 * by project/scheme — e.g. a sub-task is "Technical task" on one board and
 * "Subtask" on another — so the name a create sends is configurable.
 * Omitted kinds fall back to the built-in standard names.
 */
export type IssueTypeNames = Partial<Record<IssueType, string>>

/** A board column and the Jira statuses that fold into it, in display order. */
export interface ColumnConfig {
  title: string
  statuses: string[]
}

/** Fields stamped onto issues created from a board — keeps `create` headless. */
export interface CreateDefaults {
  components?: string[]
  labels?: string[]
  priority?: string
  /**
   * Custom fields by their Jira field id, sent verbatim as the field's REST value,
   * e.g. `{ customfield_10001: "<team-id>" }` for the Team field.
   */
  custom?: Record<string, string>
}

/** A query-based swimlane (specs/016): issues matching `jql` form one lane. */
export interface SwimlaneConfig {
  name: string
  jql: string
}

export interface BoardConfig {
  name: string
  /** JQL defining the board's issues; passed to the REST issue search. */
  jql: string
  view?: "board" | "list" | "backlog"
  /**
   * The grouping a tab opens in (specs/026). An epic board is read flat — epics are
   * cards, their issues render inside them like sub-tasks (specs/034) — while a work
   * board is usually read by parent, so the default belongs to the board.
   */
  grouping?: "none" | "parent" | "type" | "swimlanes"
  /**
   * Statuses that belong to this board's backlog rather than to a column
   * (specs/044) — Jira's Kanban backlog. Issues in them are kept off the board and
   * shown by a tab in backlog mode instead of falling into the first column. Display
   * order; falls back to {@link JiraSettings.backlogStatuses}.
   */
  backlogStatuses?: string[]
  /**
   * Per-board columns (specs/030). When set, they replace the instance-wide
   * {@link JiraSettings.columns} for this board — so boards on different projects or
   * workflows each render correctly. Omitted → the instance columns are used.
   */
  columns?: ColumnConfig[]
  /**
   * Per-board project key (specs/030). Overrides {@link JiraSettings.project} as
   * the project a created issue is filed into. Omitted → the instance project.
   */
  project?: string
  /**
   * The JQL a global search starts inside while this board is active (specs/046) —
   * a team or project filter, so searching finds your work first. Removable in the
   * prompt, since the point of a global search is that it can leave.
   */
  searchScope?: string
  /**
   * The reason this board's closes carry by default (specs/053); overrides
   * {@link JiraSettings.defaultResolution}. Set it where one board's workflow names its
   * everyday close something other than the instance default.
   */
  defaultResolution?: string
  /** Per-board issue-type name overrides (specs/012); merged over the instance ones. */
  issueTypes?: IssueTypeNames
  /**
   * Jira board id whose sprints this board reads (specs/050). One project's issues can
   * sit in sprints belonging to several boards — and two boards routinely name theirs
   * the same, e.g. two distinct "Sprint 193" — so without this the sprint grouping
   * grows duplicate lanes. Omitted → every live sprint an issue reports counts.
   */
  sprintBoardId?: number
  /**
   * Path to a `jira` YAML this board sources its `server:`/`login:` from
   * (specs/031), so a board on another instance authenticates against it. The API
   * token still comes from `JIRA_API_TOKEN`. A leading `~/` expands.
   */
  jiraConfig?: string
  createDefaults?: CreateDefaults
  swimlanes?: SwimlaneConfig[]
}

/** Instance-wide provider settings, shared by every board. */
export interface JiraSettings {
  project: string
  storyPointsField?: string
  /**
   * The Jira custom field carrying an issue's sprints (specs/050) — instance-wide, e.g.
   * `customfield_10020`. Unset → no sprint data, and the `sprint` grouping is never
   * offered, which is exactly right for a kanban-only instance.
   */
  sprintField?: string
  teamField?: string
  /**
   * The field carrying an issue's epic link. Defaults to `parent`, Jira's unified
   * hierarchy; set it to a custom field id on classic projects that still carry the
   * old Epic Link (specs/034).
   */
  epicLinkField?: string
  columns: ColumnConfig[]
  /** Instance-wide backlog statuses (specs/044); a board may override them. */
  backlogStatuses?: string[]
  /**
   * The Jira resolution a close carries when none is picked (specs/053). The workflow
   * transitions into Done usually *require* a resolution, so this is what makes an
   * ordinary `⇧L` into Done work without a dialog. Defaults to `"Done"`.
   */
  defaultResolution?: string
  /** Instance-wide issue-type name overrides (specs/012); a board may override further. */
  issueTypes?: IssueTypeNames
}

/**
 * How sub-tasks lay out in the flat / by-type / query-swimlane views (specs/008):
 * - `own-column` — each sub-task sits in the column matching its own status,
 *   tagged with a `↳PARENT` reference (the default).
 * - `under-parent` — each sub-task nests under its parent in the parent's column,
 *   indented with a `↳` connector and a badge showing its own status.
 * - `checklist` — each sub-task becomes a compact checklist row *inside* the parent
 *   card: a status icon (no `[status]` text, no issue key), still selectable, with
 *   status changed in place via the board's `Shift+H`/`Shift+L`.
 * - `basket` — `own-column` cells, with each parent's run of cards wrapped in a tray
 *   headed by the parent (specs/051).
 * (The by-parent view always uses its own columns; this setting doesn't touch it.)
 *
 * A tab may override the setting at runtime with the `v` chord (specs/051).
 */
export type SubtaskLayout = "own-column" | "under-parent" | "checklist" | "basket"

/**
 * Which children a board draws at all (specs/052) — orthogonal to {@link SubtaskLayout},
 * which says *where* they sit:
 * - `all` — every child (the default).
 * - `hide-done` — everything but the finished ones, so a long-lived story stops
 *   dragging its completed sub-tasks through the Done column.
 * - `none` — parents only; each card says how many children it is not showing.
 * Switched per tab with the `v` chord.
 */
export type ChildVisibility = "all" | "hide-done" | "none"

export interface DisplayConfig {
  subtasks?: SubtaskLayout
  /** Which children the board draws (specs/052); default `all`. */
  children?: ChildVisibility
  /** Initial card-tag visibility (specs/039); toggled live via the `t` chord. Default true. */
  epics?: boolean
  labels?: boolean
}

/** Background refresh settings (specs/033). */
export interface RefreshConfig {
  /** Seconds between background polls; `0` disables the interval. Default 60. */
  interval?: number
  /** Refresh when the terminal regains focus. Default true. */
  onFocus?: boolean
}

export interface Config {
  jira: JiraSettings
  boards: BoardConfig[]
  display?: DisplayConfig
  refresh?: RefreshConfig
  /**
   * Quick filters (specs/036): a single letter → a filter query string, applied
   * to the active board with the `f`+letter chord. E.g. `{ b: "type:bug", m:
   * "assignee:me -is:done" }`. Instance-wide, shared by every board.
   */
  filters?: Record<string, string>
}
