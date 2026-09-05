/* eslint-disable no-console -- CLI entry point: --version output and startup diagnostics */
import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { App } from "./App"
import { bugsOnly, createDemoProvider, DEMO_USER, epicsBoard, teamBoard } from "./providers/demo"
import { boardToJiraConfig, createJiraProvider, preflightJira } from "./providers/jira"
import { createJiraClient, resolveCredentials } from "./providers/jira/http"
import { importBoard, toToml } from "./config/import"
import { configPath, loadConfig } from "./config/loader"
import { boardKeyFor, readBoardCache } from "./cache"
import { readSession, type SessionState } from "./session"
import { adfToMarkdown } from "./adf"
import { setupFocusReporting } from "./utils/focus-reporting"
import { uniqueSourceId, type BoardSource } from "./tabs"
import type { ChildVisibility, Config, SubtaskLayout, SwimlaneConfig } from "./config/types"
import { EMPTY_BOARD, type Board } from "./types"
import { version } from "./version"

/**
 * Fetch one issue and print it as Markdown — the pager-friendly twin of the in-app
 * detail view (specs/007), and what `⇧O` opens in a tmux window. Shares the ADF
 * conversion with the provider, so the two agree on what a description says.
 */
async function viewIssue(key: string | undefined): Promise<void> {
  if (!key) {
    console.error("usage: lane view <issue-key>")
    process.exitCode = 1
    return
  }
  const client = createJiraClient(resolveCredentials())
  const fields = "summary,issuetype,status,assignee,priority,labels,description"
  const issue = await client.request<{
    fields?: {
      summary?: string
      issuetype?: { name?: string }
      status?: { name?: string }
      assignee?: { displayName?: string }
      priority?: { name?: string }
      labels?: string[]
      description?: unknown
    }
  }>("GET", `/rest/api/3/issue/${key}?fields=${fields}`)
  const f = issue.fields ?? {}
  const lines = [
    `${key}  ${f.summary ?? ""}`,
    `${f.issuetype?.name ?? "?"} · ${f.status?.name ?? "?"} · ${f.priority?.name ?? "?"}`,
    `Assignee: ${f.assignee?.displayName ?? "Unassigned"}`,
    ...(f.labels?.length ? [`Labels: ${f.labels.join(", ")}`] : []),
    "",
    adfToMarkdown(f.description).markdown || "(no description)",
  ]
  console.log(lines.join("\n"))
}

/** Print a board's config as a pasteable `[[boards]]` block (specs/018). */
async function importBoardConfig(boardId: string | undefined): Promise<void> {
  if (!boardId) {
    console.error("usage: lane import <board-id>")
    process.exitCode = 1
    return
  }
  const board = await importBoard(boardId)
  console.log(toToml(board))
  // Swimlanes aren't exposed by the public Agile API — flag that they're missing.
  console.error(
    "\n# note: swimlanes are not importable; add [[boards.swimlanes]] by hand if needed.",
  )
}

// lane --version / -v  → print version and exit
const args = process.argv.slice(2)
if (args.includes("--version") || args.includes("-v")) {
  console.log(version)
  process.exit(0)
}

// lane view <key>  → print an issue as plain text (used by the `O` action's tmux
// window). Kept off the TUI path so its output can be piped through a pager.
if (args[0] === "view") {
  await viewIssue(args[1])
  process.exit(0)
}

// lane import <boardId>  → scaffold a [[boards]] config block from a Jira board
// and print it for the user to paste into config.toml (specs/018).
if (args[0] === "import") {
  await importBoardConfig(args[1])
  process.exit(0)
}

interface Startup {
  /** Every configured board as a source, in config order (specs/016, specs/044). */
  sources: BoardSource[]
  /** The source behind the restored active tab (specs/033). */
  initialSourceId: string
  /** That source's cached snapshot, or an empty board when there's no cache. */
  board: Board
  /** True when we booted from an empty board (no cache) — show a loading state. */
  loading: boolean
  /** Restored view/filter/grouping session state (specs/033), if any. */
  session: Partial<SessionState> | null
  /** Background refresh cadence (specs/033): seconds between polls; 0 disables. */
  refreshInterval: number
  /** Whether to refresh when the terminal regains focus (specs/033). */
  refreshOnFocus: boolean
  /** Display name behind `assignee:me` filters, if known. */
  currentUser?: string
  /** Sub-task layout from `[display]` (specs/008); applies to any provider. */
  subtaskLayout?: SubtaskLayout
  childVisibility?: ChildVisibility
  /** Quick filters from `[filters]` (specs/036): letter → filter query. */
  filters?: Record<string, string>
  /** Initial card-tag visibility from `[display]` (specs/039). */
  displayEpics?: boolean
  displayLabels?: boolean
}

/**
 * Which source to boot the cache from: the one behind the restored active tab. Every
 * tab id ends in its source id (specs/044), so this needs no tab list — App builds
 * that and picks the tab itself. Falls back to the first source when the config has
 * changed under a stale session.
 */
function restoreActiveSource(
  session: Partial<SessionState> | null,
  sources: BoardSource[],
): string {
  const saved = session?.activeTabId
  const match = saved && sources.find((s) => saved.endsWith(`:${s.id}`))
  return match ? match.id : sources[0]!.id
}

const DEMO_NAME = "Team Board"

// Query swimlanes over the demo seed's labels, so `g → swimlanes` works offline.
const DEMO_SWIMLANES: SwimlaneConfig[] = [
  { name: "Daily work", jql: "labels not in (UX, PO) OR labels is EMPTY" },
  { name: "PO/UX stream", jql: "labels in (UX, PO)" },
]

/** The offline demo: the team's board, an epic tab and a bugs list over one data set. */
function demoSources(): BoardSource[] {
  const provider = createDemoProvider()
  return [
    {
      id: DEMO_NAME,
      name: DEMO_NAME,
      provider: teamBoard(provider),
      cacheKey: boardKeyFor("demo"),
      swimlanes: DEMO_SWIMLANES,
      defaultMode: "board",
      project: "SHOP",
      hasBacklog: true,
    },
    {
      id: "Epics",
      name: "Epics",
      provider: epicsBoard(provider),
      cacheKey: boardKeyFor("demo-epics"),
      defaultMode: "board",
      defaultGrouping: "parent",
      project: "SHOP",
    },
    {
      id: "Bugs",
      name: "Bugs",
      provider: bugsOnly(provider),
      cacheKey: boardKeyFor("demo-bugs"),
      defaultMode: "list",
      defaultGrouping: "none",
      project: "SHOP",
    },
  ]
}

/**
 * Pick the data source and load the first board — all on the normal screen, before
 * the TUI takes over, so any startup diagnostics render cleanly. Jira is the
 * default; the mock is used only with `--mock`, when Jira is unreachable, or when
 * the initial load fails — so the app always starts.
 */
async function startup(): Promise<Startup> {
  const wantMock = args.includes("--mock")

  // config.toml is optional and provider-independent for display prefs, so load it
  // once up front: `[display]` then applies to the mock board too, and the Jira
  // branch reuses the same parse for the board definitions.
  let config: Config | null = null
  try {
    config = await loadConfig()
  } catch (err) {
    console.error(`lane: ${err instanceof Error ? err.message : err}\n      Ignoring config.toml.`)
  }
  const subtaskLayout = config?.display?.subtasks
  const childVisibility = config?.display?.children
  const displayEpics = config?.display?.epics
  const displayLabels = config?.display?.labels
  const session = readSession()
  const refreshInterval = config?.refresh?.interval ?? 60
  const refreshOnFocus = config?.refresh?.onFocus ?? true

  if (!wantMock) {
    const { problem, user } = await preflightJira()
    const cfg = config
    if (problem) {
      console.error(`lane: ${problem}\n      Using the demo board instead.`)
    } else if (!cfg || cfg.boards.length === 0) {
      console.error(
        `lane: no boards configured — add a [[boards]] entry to ${configPath()}\n` +
          `      (\`lane import <board-id>\` prints one from a Jira board). Using the demo board instead.`,
      )
    } else {
      const taken = new Set<string>()
      const sources: BoardSource[] = cfg.boards.map((b) => {
        const jc = boardToJiraConfig(cfg.jira, b)
        const id = uniqueSourceId(b.name, taken)
        taken.add(id)
        return {
          id,
          name: b.name,
          provider: createJiraProvider(jc),
          cacheKey: boardKeyFor({ project: jc.project, jql: jc.jql, columns: jc.columns }),
          swimlanes: b.swimlanes,
          defaultMode: b.view,
          defaultGrouping: b.grouping,
          searchScope: b.searchScope,
          project: jc.project,
          epicField: jc.epicLinkField,
          hasBacklog: (jc.backlogStatuses?.length ?? 0) > 0,
        }
      })
      // Stale-while-revalidate: boot from the active source's cache (if any) and let
      // App revalidate on mount; no cache → an empty board with a loading state.
      const initialSourceId = restoreActiveSource(session, sources)
      const cached = readBoardCache(sources.find((s) => s.id === initialSourceId)!.cacheKey)
      return {
        sources,
        initialSourceId,
        board: cached?.board ?? EMPTY_BOARD,
        loading: !cached,
        session,
        refreshInterval,
        refreshOnFocus,
        currentUser: user,
        subtaskLayout,
        childVisibility,
        filters: config?.filters,
        displayEpics,
        displayLabels,
      }
    }
  }

  const sources = demoSources()
  const initialSourceId = restoreActiveSource(session, sources)
  return {
    sources,
    initialSourceId,
    board: await sources.find((s) => s.id === initialSourceId)!.provider.loadBoard(),
    loading: false,
    session,
    refreshInterval,
    refreshOnFocus,
    currentUser: DEMO_USER,
    subtaskLayout,
    childVisibility,
    filters: config?.filters,
    displayEpics,
    displayLabels,
  }
}

const {
  sources,
  initialSourceId,
  board,
  loading,
  session,
  refreshInterval,
  refreshOnFocus,
  currentUser,
  subtaskLayout,
  childVisibility,
  filters,
  displayEpics,
  displayLabels,
} = await startup()

const renderer = await createCliRenderer({
  exitOnCtrlC: false,
})

// Terminal focus reporting (specs/033): fan focus in/out out to App-registered
// callbacks. Only enabled when the config allows on-focus refresh.
const focusCallbacks = new Set<(focused: boolean) => void>()
const teardownFocus = refreshOnFocus
  ? setupFocusReporting(renderer, (focused) => focusCallbacks.forEach((cb) => cb(focused)))
  : () => {}
function registerFocus(cb: (focused: boolean) => void): () => void {
  focusCallbacks.add(cb)
  return () => {
    focusCallbacks.delete(cb)
  }
}

function exit() {
  teardownFocus()
  renderer.destroy()
  process.exit(0)
}

process.on("SIGINT", exit)
process.on("SIGTERM", exit)

createRoot(renderer).render(
  <App
    sources={sources}
    initialSourceId={initialSourceId}
    initialBoard={board}
    initialLoading={loading}
    session={session}
    refreshInterval={refreshInterval}
    registerFocus={registerFocus}
    currentUser={currentUser}
    subtaskLayout={subtaskLayout}
    childVisibility={childVisibility}
    filters={filters}
    displayEpics={displayEpics}
    displayLabels={displayLabels}
    onExit={exit}
  />,
)
