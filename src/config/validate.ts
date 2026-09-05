/**
 * Validate a parsed TOML object into a typed {@link Config}, failing with a
 * message that names the offending key (specs/015 — "don't crash, don't silently
 * ignore"). TOML keys are snake_case; the typed shape is camelCase.
 */

import type {
  BoardConfig,
  ColumnConfig,
  Config,
  CreateDefaults,
  DisplayConfig,
  IssueTypeNames,
  JiraSettings,
  RefreshConfig,
  ChildVisibility,
  SubtaskLayout,
  SwimlaneConfig,
} from "./types"
import type { IssueType } from "../types"

function fail(where: string, message: string): never {
  throw new Error(`config (${where}): ${message}`)
}

function asObject(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(where, "expected a table")
  }
  return value as Record<string, unknown>
}

function asString(value: unknown, where: string): string {
  if (typeof value !== "string" || value === "") {
    fail(where, "expected a non-empty string")
  }
  return value
}

function asStringArray(value: unknown, where: string): string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    fail(where, "expected an array of strings")
  }
  return value as string[]
}

function optString(value: unknown, where: string): string | undefined {
  return value === undefined ? undefined : asString(value, where)
}

function optNumber(value: unknown, where: string): number | undefined {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(where, "expected a number")
  }
  return value
}

function parseColumns(value: unknown, where: string): ColumnConfig[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail(where, "expected a non-empty array of { title, statuses } tables")
  }
  return value.map((raw, i) => {
    const col = asObject(raw, `${where}[${i}]`)
    return {
      title: asString(col.title, `${where}[${i}].title`),
      statuses: asStringArray(col.statuses, `${where}[${i}].statuses`),
    }
  })
}

function parseCreateDefaults(value: unknown, where: string): CreateDefaults | undefined {
  if (value === undefined) {
    return undefined
  }
  const raw = asObject(value, where)
  const custom = raw.custom === undefined ? undefined : asObject(raw.custom, `${where}.custom`)
  if (custom) {
    for (const [k, v] of Object.entries(custom)) {
      asString(v, `${where}.custom.${k}`)
    }
  }
  return {
    components:
      raw.components === undefined
        ? undefined
        : asStringArray(raw.components, `${where}.components`),
    labels: raw.labels === undefined ? undefined : asStringArray(raw.labels, `${where}.labels`),
    priority: optString(raw.priority, `${where}.priority`),
    custom: custom as Record<string, string> | undefined,
  }
}

function parseSwimlanes(value: unknown, where: string): SwimlaneConfig[] | undefined {
  if (value === undefined) {
    return undefined
  }
  if (!Array.isArray(value)) {
    fail(where, "expected an array of { name, jql } tables")
  }
  return value.map((raw, i) => {
    const lane = asObject(raw, `${where}[${i}]`)
    return {
      name: asString(lane.name, `${where}[${i}].name`),
      // A catch-all lane may use an empty jql, so don't require non-empty here.
      jql:
        typeof lane.jql === "string" ? lane.jql : fail(`${where}[${i}].jql`, "expected a string"),
    }
  })
}

const GROUPINGS = ["none", "parent", "type", "swimlanes", "sprint"]

function parseBoard(value: unknown, where: string): BoardConfig {
  const raw = asObject(value, where)
  const view = raw.view
  if (view !== undefined && view !== "board" && view !== "list" && view !== "backlog") {
    fail(`${where}.view`, 'expected "board", "list" or "backlog"')
  }
  const grouping = raw.grouping
  if (grouping !== undefined && !GROUPINGS.includes(grouping as string)) {
    fail(`${where}.grouping`, `expected one of ${GROUPINGS.map((g) => `"${g}"`).join(", ")}`)
  }
  return {
    name: asString(raw.name, `${where}.name`),
    jql: asString(raw.jql, `${where}.jql`),
    view,
    grouping: grouping as BoardConfig["grouping"],
    backlogStatuses:
      raw.backlog_statuses === undefined
        ? undefined
        : asStringArray(raw.backlog_statuses, `${where}.backlog_statuses`),
    project: optString(raw.project, `${where}.project`),
    searchScope: optString(raw.search_scope, `${where}.search_scope`),
    sprintBoardId: optNumber(raw.sprint_board_id, `${where}.sprint_board_id`),
    defaultResolution: optString(raw.default_resolution, `${where}.default_resolution`),
    columns: raw.columns === undefined ? undefined : parseColumns(raw.columns, `${where}.columns`),
    issueTypes: parseIssueTypes(raw.issue_types, `${where}.issue_types`),
    jiraConfig: optString(raw.jira_config, `${where}.jira_config`),
    createDefaults: parseCreateDefaults(raw.create_defaults, `${where}.create_defaults`),
    swimlanes: parseSwimlanes(raw.swimlanes, `${where}.swimlanes`),
  }
}

const SUBTASK_LAYOUTS: SubtaskLayout[] = ["own-column", "under-parent", "checklist", "basket"]
const CHILD_VISIBILITIES: ChildVisibility[] = ["all", "hide-done", "none"]

function parseDisplay(value: unknown): DisplayConfig | undefined {
  if (value === undefined) {
    return undefined
  }
  const raw = asObject(value, "display")
  const subtasks = raw.subtasks
  if (subtasks !== undefined && !SUBTASK_LAYOUTS.includes(subtasks as SubtaskLayout)) {
    fail("display.subtasks", `expected one of ${SUBTASK_LAYOUTS.map((l) => `"${l}"`).join(", ")}`)
  }
  const children = raw.children
  if (children !== undefined && !CHILD_VISIBILITIES.includes(children as ChildVisibility)) {
    fail(
      "display.children",
      `expected one of ${CHILD_VISIBILITIES.map((c) => `"${c}"`).join(", ")}`,
    )
  }
  return {
    subtasks: subtasks as SubtaskLayout | undefined,
    children: children as ChildVisibility | undefined,
    epics: optBool(raw.epics, "display.epics"),
    labels: optBool(raw.labels, "display.labels"),
  }
}

function optBool(value: unknown, where: string): boolean | undefined {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== "boolean") {
    fail(where, "expected a boolean")
  }
  return value
}

function parseRefresh(value: unknown): RefreshConfig | undefined {
  if (value === undefined) {
    return undefined
  }
  const raw = asObject(value, "refresh")
  if (raw.interval !== undefined && (typeof raw.interval !== "number" || raw.interval < 0)) {
    fail("refresh.interval", "expected a non-negative number of seconds")
  }
  if (raw.on_focus !== undefined && typeof raw.on_focus !== "boolean") {
    fail("refresh.on_focus", "expected a boolean")
  }
  return {
    interval: raw.interval as number | undefined,
    onFocus: raw.on_focus as boolean | undefined,
  }
}

const ISSUE_TYPE_KINDS: IssueType[] = ["story", "bug", "task", "epic", "subtask"]

function parseIssueTypes(value: unknown, where: string): IssueTypeNames | undefined {
  if (value === undefined) {
    return undefined
  }
  const raw = asObject(value, where)
  const out: IssueTypeNames = {}
  for (const [kind, name] of Object.entries(raw)) {
    if (!ISSUE_TYPE_KINDS.includes(kind as IssueType)) {
      fail(`${where}.${kind}`, `unknown issue kind; expected one of ${ISSUE_TYPE_KINDS.join(", ")}`)
    }
    out[kind as IssueType] = asString(name, `${where}.${kind}`)
  }
  return out
}

function parseJira(value: unknown): JiraSettings {
  const raw = asObject(value, "jira")
  return {
    project: asString(raw.project, "jira.project"),
    storyPointsField: optString(raw.story_points_field, "jira.story_points_field"),
    sprintField: optString(raw.sprint_field, "jira.sprint_field"),
    teamField: optString(raw.team_field, "jira.team_field"),
    epicLinkField: optString(raw.epic_link_field, "jira.epic_link_field"),
    defaultResolution: optString(raw.default_resolution, "jira.default_resolution"),
    columns: parseColumns(raw.columns, "jira.columns"),
    backlogStatuses:
      raw.backlog_statuses === undefined
        ? undefined
        : asStringArray(raw.backlog_statuses, "jira.backlog_statuses"),
    issueTypes: parseIssueTypes(raw.issue_types, "jira.issue_types"),
  }
}

/** `[filters]`: single-letter chord → filter query string (specs/036). */
function parseFilters(value: unknown): Record<string, string> | undefined {
  if (value === undefined) {
    return undefined
  }
  const raw = asObject(value, "filters")
  const out: Record<string, string> = {}
  for (const [key, query] of Object.entries(raw)) {
    if (!/^[a-z]$/i.test(key)) {
      fail(`filters.${key}`, "expected a single letter a–z as the chord key")
    }
    out[key.toLowerCase()] = asString(query, `filters.${key}`)
  }
  return out
}

export function validateConfig(raw: unknown, path: string): Config {
  const root = asObject(raw, path)
  const boards = root.boards
  if (!Array.isArray(boards) || boards.length === 0) {
    fail("boards", "at least one [[boards]] entry is required")
  }
  return {
    jira: parseJira(root.jira),
    boards: boards.map((b, i) => parseBoard(b, `boards[${i}]`)),
    display: parseDisplay(root.display),
    refresh: parseRefresh(root.refresh),
    filters: parseFilters(root.filters),
  }
}
