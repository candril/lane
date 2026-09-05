import type { Board, Column, CreateInput, IssueType, Priority, Sprint, Task } from "../types"
import type { BoardConfig, JiraSettings } from "../config/types"
import type { BoardProvider, ChangeEntry, IssueDetail } from "./provider"
import { adfToMarkdown, markdownToAdf } from "../adf"
import { logRequest } from "../utils/logger"
import {
  createJiraClient,
  expandHome,
  JiraApiError,
  JiraAuthError,
  resolveCredentials,
  type JiraClient,
} from "./jira/http"

/**
 * Per-instance Jira settings. Built from the config file (specs/015) via
 * {@link boardToJiraConfig}; without a config.toml there is no Jira board to show,
 * and the app opens the offline demo instead.
 */
export interface JiraConfig {
  project: string
  /** JQL selecting the board's issues; `ORDER BY Rank ASC` is applied on top. */
  jql: string
  storyPointsField?: string
  /**
   * The custom field carrying an issue's sprints (specs/050), e.g. `customfield_10020`.
   * Unset → cards carry no sprint and the `sprint` grouping never appears.
   */
  sprintField?: string
  /**
   * Keep only sprints belonging to this Jira board (specs/050). One project's issues
   * can sit in sprints from several boards, which routinely reuse each other's sprint
   * names, so lanes would otherwise double up. Omitted → every live sprint counts.
   */
  sprintBoardId?: number
  /**
   * The field carrying an issue's epic link. On classic (company-managed via the
   * old scheme) projects this is a custom field, typically `customfield_10014`;
   * on newer projects the epic is `parent`. Used both to read the link and to
   * attach a created issue to an epic.
   */
  epicLinkField?: string
  /**
   * Ordered board columns. Each folds one or more Jira statuses (a board column
   * can map several statuses — see specs/005). `statuses[0]` is the status a card
   * is transitioned to when moved into that column.
   */
  columns: { title: string; statuses: string[] }[]
  /**
   * The reason a close carries when the caller names none (specs/053) — Jira's
   * resolution. The transitions into Done *require* one on most workflows, so without
   * this a close is rejected outright; `"Done"` is assumed when it is unset.
   */
  defaultResolution?: string
  /**
   * Statuses that are the board's *backlog* rather than a column (specs/044). They
   * become {@link Board.backlog} columns, so an issue in one is rendered by the
   * backlog tab instead of falling into the first board column.
   */
  backlogStatuses?: string[]
  /** Jira issue-type name per kind (specs/012); overrides the built-in defaults. */
  issueTypes?: Partial<Record<IssueType, string>>
  /**
   * Path to a `jira` CLI YAML to source this board's `server:`/`login:` from
   * (specs/031) — so a board on another instance authenticates against it. The
   * API token still comes from `JIRA_API_TOKEN`. A leading `~/` expands.
   */
  jiraConfigPath?: string
  /**
   * Fields stamped onto every issue created from this board, so a create screen
   * with required fields (team, component, …) doesn't reject the REST create.
   */
  createDefaults?: {
    /** Component names. */
    components?: string[]
    labels?: string[]
    priority?: string
    /** Custom fields by their Jira field id, e.g. `{ customfield_10001: "<id>" }`. */
    custom?: Record<string, unknown>
  }
}

/** Build a {@link JiraConfig} from parsed config: instance settings + one board. */
export function boardToJiraConfig(jira: JiraSettings, board: BoardConfig): JiraConfig {
  return {
    // Per-board project/columns win, falling back to the instance-wide settings
    // (specs/030) — so a board on another project/workflow renders correctly.
    project: board.project ?? jira.project,
    jql: board.jql,
    storyPointsField: jira.storyPointsField,
    sprintField: jira.sprintField,
    sprintBoardId: board.sprintBoardId,
    // Jira's unified hierarchy makes an issue's epic its `parent`, which is what any
    // instance not carrying the classic Epic Link custom field uses (specs/034). Left
    // unset, the epic link was simply never read — no tags, no `epic:` filter, no
    // epic-grouped anything.
    epicLinkField: jira.epicLinkField ?? "parent",
    columns: board.columns ?? jira.columns,
    backlogStatuses: board.backlogStatuses ?? jira.backlogStatuses,
    defaultResolution: board.defaultResolution ?? jira.defaultResolution,
    issueTypes: { ...jira.issueTypes, ...board.issueTypes },
    jiraConfigPath: board.jiraConfig,
    createDefaults: board.createDefaults,
  }
}

/** The subset of a Jira issue's fields we read from `/rest/api/3/search/jql`. */
interface RawIssue {
  key: string
  fields: {
    summary?: string
    issuetype?: { name?: string; subtask?: boolean }
    status?: { name?: string }
    resolution?: { name?: string } | null
    priority?: { name?: string }
    assignee?: { displayName?: string; accountId?: string }
    parent?: {
      key?: string
      fields?: { summary?: string; issuetype?: { name?: string; subtask?: boolean } }
    }
    labels?: string[]
    /** ADF, and only ever requested for a single issue (specs/007). */
    description?: unknown
    // The epic-link custom field is looked up dynamically by its configured id.
    [field: string]: unknown
  }
  /** Only with `?expand=changelog`, on the single-issue fetch (specs/058). */
  changelog?: {
    histories?: {
      created?: string
      author?: { displayName?: string }
      items?: { field?: string; fromString?: string | null; toString?: string | null }[]
    }[]
  }
}

/**
 * Changelog fields that are churn rather than history: every reorder writes a Rank
 * entry, and time tracking logs a line per worklog. Left in, they would bury the
 * status and assignee changes a reader actually came for.
 */
const HISTORY_NOISE = new Set([
  "Rank",
  "WorklogId",
  "timespent",
  "timeestimate",
  "timeoriginalestimate",
  "RemoteIssueLink",
])

/**
 * The changelog as newest-first entries with the noise dropped. Sorted by timestamp
 * rather than reversed: the order `expand=changelog` returns has proven to differ
 * from the changelog endpoint's, and the viewer's contract is newest first regardless.
 */
export function toHistory(changelog: RawIssue["changelog"]): ChangeEntry[] {
  return (changelog?.histories ?? [])
    .map((entry) => ({
      at: entry.created ?? "",
      author: entry.author?.displayName ?? "someone",
      items: (entry.items ?? [])
        .filter((item) => !!item.field && !HISTORY_NOISE.has(item.field))
        .map((item) => ({
          field: item.field!.toLowerCase(),
          from: item.fromString ?? undefined,
          to: item.toString ?? undefined,
        })),
    }))
    .filter((entry) => entry.items.length > 0)
    .sort((a, b) => b.at.localeCompare(a.at))
}

/** One workflow transition, as `?expand=transitions.fields` reports it. */
interface TransitionMeta {
  id: string
  name: string
  to?: { name?: string }
  fields?: Record<string, { required?: boolean; allowedValues?: { name?: string }[] }>
}

interface SearchPage {
  issues?: RawIssue[]
  nextPageToken?: string
}

export function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function mapType(type?: { name?: string; subtask?: boolean }): IssueType {
  if (type?.subtask) {
    return "subtask"
  }
  switch (type?.name?.toLowerCase()) {
    case "story":
      return "story"
    case "bug":
      return "bug"
    case "epic":
      return "epic"
    default:
      return "task"
  }
}

function mapPriority(name?: string): Priority {
  switch (name?.toLowerCase()) {
    case "highest":
      return "highest"
    case "high":
      return "high"
    case "low":
      return "low"
    case "lowest":
      return "lowest"
    default:
      // Jira's default "Medium" — and the "Normal" some schemes use — both land here.
      return "medium"
  }
}

/** The sprint custom field's element shape on Jira Cloud — objects, not the legacy string. */
interface RawSprint {
  id?: number
  name?: string
  state?: string
  boardId?: number
  startDate?: string
  endDate?: string
}

/**
 * The one sprint a card reads as being in (specs/050): the active sprint if the issue
 * is in one, else the earliest-starting future sprint. Carry-over work sits in a closed
 * sprint *and* the current one, and it is the live sprint you are working in.
 *
 * Closed sprints are dropped outright rather than ranked last — a card whose sprints are
 * all closed belongs in the backlog lane, not in a lane of its own.
 */
function resolveSprint(value: unknown, boardId?: number): Sprint | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }
  const live = (value as RawSprint[])
    .filter((s) => typeof s?.id === "number" && (s.state === "active" || s.state === "future"))
    .filter((s) => boardId === undefined || s.boardId === boardId)
    .map((s) => ({
      id: s.id as number,
      name: s.name ?? `Sprint ${s.id}`,
      state: s.state as Sprint["state"],
      startDate: s.startDate,
      endDate: s.endDate,
    }))
  const active = live.filter((s) => s.state === "active")
  const pool = active.length > 0 ? active : live
  return pool.sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""))[0]
}

const DEFAULT_TYPE_NAMES: Record<IssueType, string> = {
  story: "Story",
  bug: "Bug",
  epic: "Epic",
  subtask: "Sub-task",
  task: "Task",
}

/**
 * Our issue-type enum → the Jira issue-type name a create expects. A board's
 * `issueTypes` config overrides the defaults per kind (specs/012) — Jira type names
 * vary by project scheme (e.g. a sub-task is "Technical task" on one board,
 * "Subtask" on another), so the create name must be configurable.
 */
function jiraTypeName(type: IssueType, config: JiraConfig): string {
  return config.issueTypes?.[type] ?? DEFAULT_TYPE_NAMES[type]
}

function jiraPriorityName(priority: string): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1)
}

/** Append rank ordering unless the JQL already carries its own `ORDER BY`. */
function withRankOrder(jql: string): string {
  return /order\s+by/i.test(jql) ? jql : `${jql} ORDER BY Rank ASC`
}

/**
 * The message a rank response's 207 body carries when Jira refused the rank, or null
 * on success (a 204 has no body at all). The agile rank endpoint reports per-issue
 * refusal this way instead of an error status, so callers must read the entries.
 */
export function rankFailure(result: unknown): string | null {
  const entries = (result as { entries?: unknown } | undefined)?.entries
  if (!Array.isArray(entries)) {
    return null
  }
  for (const entry of entries) {
    const e = entry as { issueKeys?: unknown; status?: unknown; errors?: unknown }
    const errors = Array.isArray(e.errors) ? e.errors.filter((x) => typeof x === "string") : []
    const status = typeof e.status === "number" ? e.status : 200
    if (errors.length > 0 || status >= 400) {
      if (errors.length > 0) {
        return errors.join("; ")
      }
      const keys = Array.isArray(e.issueKeys) ? e.issueKeys.join(", ") : ""
      return `rank refused${keys ? ` for ${keys}` : ""} (HTTP ${status})`
    }
  }
  return null
}

export function createJiraProvider(config: JiraConfig): BoardProvider {
  const columns: Column[] = config.columns.map((c) => ({ id: slug(c.title), title: c.title }))
  // Backlog statuses are columns too — just not the board's (specs/044). Modelling
  // them this way keeps `Task.columnId` pointing at exactly one place, so status
  // matching, filtering and the status picker need no backlog-specific branch.
  const backlog: Column[] = (config.backlogStatuses ?? []).map((status) => ({
    id: slug(status),
    title: status,
  }))
  const fallbackColumn = columns[0]?.id ?? "todo"
  const cliPath = config.jiraConfigPath ? expandHome(config.jiraConfigPath) : undefined
  const client: JiraClient = createJiraClient(resolveCredentials(cliPath))
  // The in-flight promise, not the array: two pickers opened back to back share one
  // request rather than racing two.
  let resolutions: Promise<string[]> | undefined

  const statusToColumn = new Map<string, string>()
  for (const c of config.columns) {
    for (const status of c.statuses) {
      statusToColumn.set(status.toLowerCase(), slug(c.title))
    }
  }
  for (const status of config.backlogStatuses ?? []) {
    statusToColumn.set(status.toLowerCase(), slug(status))
  }

  // Resolved assignee ids, keyed by the sample issue (specs/027). The list model
  // already carries accountId, but keeping the cache preserves the App's flow.
  const assigneeIdCache = new Map<string, { id: string; displayName: string }>()

  function toTask(raw: RawIssue): Task {
    const fields = raw.fields
    const type = mapType(fields.issuetype)
    const assignee = fields.assignee?.displayName?.trim()
    // Only a sub-task's `parent` is a lane link. A story's `parent` is its epic
    // (a different hierarchy level) and must not make it nest as a sub-task.
    const laneParent = type === "subtask" ? fields.parent?.key : undefined
    return {
      key: raw.key,
      summary: fields.summary ?? "",
      type,
      priority: mapPriority(fields.priority?.name),
      assignee: assignee ? assignee : undefined,
      assigneeId: assignee ? fields.assignee?.accountId : undefined,
      columnId: statusToColumn.get((fields.status?.name ?? "").toLowerCase()) ?? fallbackColumn,
      status: fields.status?.name,
      resolution: fields.resolution?.name,
      parentKey: laneParent,
      epicKey: epicKeyOf(raw, type),
      epicName: epicNameOf(raw, type),
      labels: fields.labels ?? [],
      sprint: config.sprintField
        ? resolveSprint(fields[config.sprintField], config.sprintBoardId)
        : undefined,
    }
  }

  // The epic's summary, for the card tag (specs/029). Available from the nested
  // `parent.fields.summary` only under the `parent` epic model; a custom Epic Link
  // field carries just the key, so the name stays unset there (tag falls back to key).
  function epicNameOf(raw: RawIssue, type: IssueType): string | undefined {
    if (config.epicLinkField !== "parent" || type === "subtask" || type === "epic") {
      return undefined
    }
    const parent = raw.fields.parent
    return mapType(parent?.fields?.issuetype) === "epic" ? parent?.fields?.summary : undefined
  }

  // The epic-link field's value is the epic's key: a custom field on classic
  // projects, or `parent` on newer unified-hierarchy ones. A sub-task's
  // `parent` is its story, not an epic, so never read the epic from a sub-task;
  // and under the `parent` model, only count a parent that is itself an epic.
  function epicKeyOf(raw: RawIssue, type: IssueType): string | undefined {
    const field = config.epicLinkField
    if (!field || type === "subtask" || type === "epic") {
      return undefined
    }
    if (field === "parent") {
      const parent = raw.fields.parent
      return mapType(parent?.fields?.issuetype) === "epic" ? parent?.key : undefined
    }
    const value = raw.fields[field]
    return typeof value === "string" ? value : undefined
  }

  const LIST_FIELDS = [
    "summary",
    "issuetype",
    "status",
    // Why an issue ended, not just that it did (specs/053) — so the reason picker
    // opens on what the issue actually carries.
    "resolution",
    "priority",
    "assignee",
    "parent",
    "labels",
    // The epic link, when it's a custom field (`parent` is already requested).
    ...(config.epicLinkField && config.epicLinkField !== "parent" ? [config.epicLinkField] : []),
    ...(config.sprintField ? [config.sprintField] : []),
  ]

  /** Page through the token-paged JQL search — no 100-row cap (specs/005). */
  async function fetchIssues(jql: string, max?: number): Promise<RawIssue[]> {
    const cap = max ?? Number.MAX_SAFE_INTEGER
    const issues: RawIssue[] = []
    let nextPageToken: string | undefined
    do {
      const page: SearchPage = await client.request("POST", "/rest/api/3/search/jql", {
        jql: withRankOrder(jql),
        fields: LIST_FIELDS,
        maxResults: Math.min(100, cap),
        ...(nextPageToken ? { nextPageToken } : {}),
      })
      issues.push(...(page.issues ?? []))
      nextPageToken = page.nextPageToken
      if (issues.length >= cap) {
        break
      }
    } while (nextPageToken)
    return issues.slice(0, cap)
  }

  /**
   * Transition `key` to the named status. Rejects when that step isn't available.
   *
   * The transition's own fields are expanded because whether a step takes a resolution
   * is a workflow fact, not something the UI can know (specs/053): many workflows' steps
   * into Resolved/Closed *require* one, and a bare POST is rejected — while sending a
   * resolution to a step that doesn't declare one is equally a 400. So it is attached
   * exactly when the chosen transition asks for it, defaulting when the caller named
   * nothing.
   */
  async function transitionTo(key: string, status: string, resolution?: string): Promise<void> {
    await logRequest(`move ${key} → ${status}`, async () => {
      const { transitions } = await client.request<{ transitions: TransitionMeta[] }>(
        "GET",
        `/rest/api/3/issue/${key}/transitions?expand=transitions.fields`,
      )
      const transition = transitions.find((t) => t.to?.name?.toLowerCase() === status.toLowerCase())
      if (!transition) {
        const available = transitions.map((t) => t.to?.name ?? t.name).join(", ")
        throw new Error(`no transition to "${status}" from ${key}'s status (have: ${available})`)
      }
      await client.request("POST", `/rest/api/3/issue/${key}/transitions`, {
        transition: { id: transition.id },
        ...resolutionFields(transition, resolution, status),
      })
    })
  }

  /**
   * The `fields` half of a transition POST: `{ resolution: { name } }` when this step
   * declares the field, nothing otherwise. An unusable value is caught here rather than
   * left to Jira, whose 400 names neither the value nor the alternatives.
   */
  function resolutionFields(
    transition: TransitionMeta,
    resolution: string | undefined,
    status: string,
  ): { fields?: { resolution: { name: string } } } {
    const field = transition.fields?.resolution
    if (!field) {
      return {}
    }
    const name = resolution ?? config.defaultResolution ?? "Done"
    const allowed = field.allowedValues?.map((v) => v.name).filter((v): v is string => !!v)
    if (
      allowed &&
      allowed.length > 0 &&
      !allowed.some((v) => v.toLowerCase() === name.toLowerCase())
    ) {
      throw new Error(
        `"${name}" is not a resolution ${status} accepts (have: ${allowed.join(", ")})`,
      )
    }
    return { fields: { resolution: { name } } }
  }

  return {
    async loadBoard(): Promise<Board> {
      // Fetch the lanes: every non-sub-task issue in the board, in rank order.
      // Parenthesise the configured JQL: a board query can contain a top-level
      // `OR` (e.g. `team = X OR labels = Y`), and without the parens the appended
      // `AND issuetype …` binds only to the last `OR` branch — leaking sub-tasks
      // into the parents set, where they'd also arrive from the sub-task query and
      // render twice.
      const parentJql = `(${config.jql}) AND issuetype not in subTaskIssueTypes()`
      const parents = await logRequest("list top-level", () => fetchIssues(parentJql))

      const seen = new Set<string>()
      const tasks: Task[] = []
      const add = (raw: RawIssue) => {
        if (seen.has(raw.key)) {
          return
        }
        seen.add(raw.key)
        tasks.push(toTask(raw))
      }
      parents.forEach(add)

      // Sub-tasks come from a second query, filtered by parent rather than the
      // board's team JQL: a sub-task often has no team field of its own, so a
      // team-filtered query would drop it. `subTaskIssueTypes()` keeps epic children
      // (whose `parent` is the epic, in Jira's unified parent model) out of the set.
      const parentKeys = parents.map((p) => p.key)
      if (parentKeys.length > 0) {
        const subJql = `parent in (${parentKeys.join(",")}) AND issuetype in subTaskIssueTypes()`
        const subs = await logRequest("list sub-tasks", () => fetchIssues(subJql))
        // `add` dedups by key — belt-and-suspenders against any query overlap.
        subs.forEach(add)
      }
      return { columns, tasks, backlog: backlog.length > 0 ? backlog : undefined }
    },

    async searchIssues(jql: string, limit: number): Promise<Task[]> {
      const issues = await logRequest(`search ${jql}`, () => fetchIssues(jql, limit))
      return issues.map(toTask)
    },

    async moveTask(key: string, toColumnId: string, resolution?: string): Promise<void> {
      const target = config.columns.find((c) => slug(c.title) === toColumnId)
      // A backlog column is one status, named by it — so moving an issue back into
      // the backlog (specs/044) transitions to that status directly.
      const status =
        target?.statuses[0] ?? config.backlogStatuses?.find((st) => slug(st) === toColumnId)
      if (!status) {
        throw new Error(`No Jira status mapped for column "${toColumnId}"`)
      }
      await transitionTo(key, status, resolution)
    },

    transitionTo,

    defaultResolution: config.defaultResolution ?? "Done",

    /**
     * Every resolution the instance defines (specs/053), fetched once and held for the
     * process — the list is workflow configuration, not board data, so re-reading it on
     * each picker would be a request spent to learn nothing new.
     */
    async listResolutions(): Promise<string[]> {
      resolutions ??= logRequest("list resolutions", async () => {
        const all = await client.request<{ name?: string }[]>("GET", "/rest/api/3/resolution")
        return all.map((r) => r.name).filter((n): n is string => !!n)
      })
      return resolutions
    },

    /**
     * Amend a closed issue's reason without re-transitioning it (specs/053). Jira keeps
     * `resolution` on the edit screen, so this is a plain field write — the status, and
     * the resolution date, stay as they were.
     */
    async setResolution(key: string, resolution: string): Promise<void> {
      await logRequest(`set ${key} resolution`, async () => {
        await client.request("PUT", `/rest/api/3/issue/${key}`, {
          fields: { resolution: { name: resolution } },
        })
      })
    },

    /**
     * One issue in full (specs/007). Reuses `toTask`, so the viewer's header agrees
     * with the card it was opened from, and converts the ADF description to Markdown
     * here — the UI never sees Atlassian's document format.
     */
    async loadIssue(key: string): Promise<IssueDetail> {
      const raw = await logRequest(`load issue ${key}`, () =>
        client.request<RawIssue>(
          "GET",
          // The changelog rides on the same request (specs/058): one issue, one call.
          `/rest/api/3/issue/${key}?fields=${[...LIST_FIELDS, "description"].join(",")}&expand=changelog`,
        ),
      )
      const { markdown, unsupported } = adfToMarkdown(raw.fields?.description)
      return {
        task: toTask(raw),
        description: markdown,
        unsupported,
        history: toHistory(raw.changelog),
      }
    },

    async editSummary(key: string, summary: string): Promise<void> {
      await logRequest(`edit ${key} summary`, async () => {
        await client.request("PUT", `/rest/api/3/issue/${key}`, { fields: { summary } })
      })
    },

    /**
     * Write the description back as ADF (specs/049). An empty description is sent as
     * `null` rather than an empty document — that is how Jira spells "no description",
     * and an empty `doc` renders as a stray blank paragraph in the web UI.
     */
    async loadChildren(key: string): Promise<Task[]> {
      // `parent` covers a story's sub-tasks and, under the unified parent model, an
      // epic's stories; an instance still on the classic Epic Link needs that field
      // asked as well — the same split the `epic:` filter makes (search.ts).
      const field = config.epicLinkField
      const jql =
        field && field !== "parent" ? `parent = ${key} OR "${field}" = ${key}` : `parent = ${key}`
      const found = await logRequest(`load children of ${key}`, () => fetchIssues(jql))
      return found.map(toTask)
    },

    async editDescription(key: string, markdown: string): Promise<void> {
      const description = markdown.trim() ? markdownToAdf(markdown) : null
      await logRequest(`edit ${key} description`, async () => {
        await client.request("PUT", `/rest/api/3/issue/${key}`, { fields: { description } })
      })
    },

    async setLabels(key: string, labels: string[]): Promise<void> {
      await logRequest(`set labels ${key}`, async () => {
        await client.request("PUT", `/rest/api/3/issue/${key}`, { fields: { labels } })
      })
    },

    async setEpic(key: string, epicKey: string | null): Promise<void> {
      // Write the same field the board reads for the epic link. `parent` takes a
      // `{ key }` object (or `null` to detach); a custom Epic Link field takes the
      // epic key string (or `null`). Without a configured field there's nowhere to write.
      const field = config.epicLinkField
      if (!field) {
        throw new Error("no epic-link field configured (jira.epic_link_field)")
      }
      const value = field === "parent" ? (epicKey ? { key: epicKey } : null) : epicKey
      await logRequest(`set epic ${key} → ${epicKey ?? "none"}`, async () => {
        await client.request("PUT", `/rest/api/3/issue/${key}`, { fields: { [field]: value } })
      })
    },

    async rankTask(key: string, anchor: { before: string } | { after: string }): Promise<void> {
      const body =
        "before" in anchor
          ? { issues: [key], rankBeforeIssue: anchor.before }
          : { issues: [key], rankAfterIssue: anchor.after }
      const where = "before" in anchor ? `before ${anchor.before}` : `after ${anchor.after}`
      await logRequest(`rank ${key} ${where}`, async () => {
        // 204 on success — but a refused rank is a 207 whose body carries the errors,
        // and fetch's `ok` is true for 207. Without reading the body the failure is
        // silent: the optimistic order stands until the next refresh snaps it back.
        const result = await client.request<unknown>("PUT", "/rest/agile/1.0/issue/rank", body)
        const failure = rankFailure(result)
        if (failure) {
          throw new Error(failure)
        }
      })
    },

    async assignTask(key: string, assignee: string | null): Promise<void> {
      // `assignee` is an exact accountId (resolved via resolveAssignee); `null`
      // unassigns via the REST assignee endpoint.
      await logRequest(`assign ${key} → ${assignee ?? "unassigned"}`, async () => {
        await client.request("PUT", `/rest/api/3/issue/${key}/assignee`, { accountId: assignee })
      })
    },

    async resolveAssignee(sampleKey: string): Promise<{ id: string; displayName: string }> {
      const cached = assigneeIdCache.get(sampleKey)
      if (cached) {
        return cached
      }
      return logRequest(`resolve assignee ${sampleKey}`, async () => {
        const issue = await client.request<{
          fields?: { assignee?: { accountId?: string; displayName?: string } }
        }>("GET", `/rest/api/3/issue/${sampleKey}?fields=assignee`)
        const assignee = issue.fields?.assignee
        if (!assignee?.accountId) {
          throw new Error(`no assignee id on ${sampleKey} — reload the board`)
        }
        const resolved = { id: assignee.accountId, displayName: assignee.displayName ?? "" }
        assigneeIdCache.set(sampleKey, resolved)
        return resolved
      })
    },

    async createIssue({ type, summary, parentKey, epicKey }: CreateInput): Promise<Task> {
      // Board create-defaults (team, components, …) live on the parent issue-type's
      // create screen, not a sub-task's — sending them to a sub-task create is
      // rejected ("field cannot be set"). A sub-task inherits its context from its
      // parent, so it needs none of them.
      const defaults = type === "subtask" ? undefined : config.createDefaults
      const fields: Record<string, unknown> = {
        // Pin the project explicitly so a board on another project creates into it,
        // not some default (specs/030).
        project: { key: config.project },
        issuetype: { name: jiraTypeName(type, config) },
        summary,
      }
      // A sub-task's parent and a child issue's epic link may be the same field
      // (`parent`, on the unified model) or different (a custom Epic Link field on
      // classic projects). A custom field takes the epic key as a string; `parent`
      // takes a `{ key }` object.
      if (parentKey) {
        fields.parent = { key: parentKey }
      } else if (epicKey) {
        if (config.epicLinkField && config.epicLinkField !== "parent") {
          fields[config.epicLinkField] = epicKey
        } else {
          fields.parent = { key: epicKey }
        }
      }
      if (defaults?.components?.length) {
        fields.components = defaults.components.map((name) => ({ name }))
      }
      if (defaults?.labels?.length) {
        fields.labels = defaults.labels
      }
      if (defaults?.priority) {
        fields.priority = { name: jiraPriorityName(defaults.priority) }
      }
      for (const [field, value] of Object.entries(defaults?.custom ?? {})) {
        fields[field] = value
      }

      const created = await logRequest(`create ${jiraTypeName(type, config)}`, () =>
        client.request<{ key?: string }>("POST", "/rest/api/3/issue", { fields }),
      )
      if (!created.key) {
        throw new Error("Jira create returned no issue key")
      }
      // A new issue lands in the project's default status, which maps to the first
      // column — so we build the Task locally rather than round-trip a refetch.
      return {
        key: created.key,
        summary,
        type,
        priority: mapPriority(defaults?.priority),
        columnId: fallbackColumn,
        parentKey,
        epicKey,
      }
    },

    issueUrl(key) {
      return `${client.baseUrl}/browse/${key}`
    },
  }
}

export interface Preflight {
  /** A human-readable reason Jira can't be used, or `null` when it answered. */
  problem: string | null
  /**
   * The authenticated account's display name (specs/027). Jira reports the assignee
   * of an issue by display name too, so this is what `assignee:me` / `@me` and the
   * picker's "me" entry compare against.
   */
  user?: string
}

/**
 * Startup check: can we authenticate against Jira? Resolves credentials and calls
 * `/myself`, which also names the account — the only place the API volunteers it.
 */
export async function preflightJira(): Promise<Preflight> {
  const creds = tryResolve()
  if (typeof creds === "string") {
    return { problem: creds }
  }
  try {
    const me = await createJiraClient(creds).request<{ displayName?: string }>(
      "GET",
      "/rest/api/3/myself",
    )
    return { problem: null, user: me?.displayName?.trim() || undefined }
  } catch (err) {
    if (err instanceof JiraApiError && (err.status === 401 || err.status === 403)) {
      return {
        problem: "Jira rejected the credentials — check JIRA_API_TOKEN and the account email.",
      }
    }
    return { problem: `Jira is unreachable: ${err instanceof Error ? err.message : String(err)}` }
  }
}

function tryResolve(): ReturnType<typeof resolveCredentials> | string {
  try {
    return resolveCredentials()
  } catch (err) {
    if (err instanceof JiraAuthError) {
      return `Jira is not configured — ${err.message}`
    }
    throw err
  }
}
