/**
 * Tabs and the sources they render (specs/044, specs/045).
 *
 * A tab used to *be* a board: one config entry, one provider, one fetch. That breaks
 * as soon as two tabs show the same issue set differently — a board and its backlog
 * (specs/044), or a board and a filtered clone of it (specs/045). So the two halves
 * are split:
 *
 * - a {@link BoardSource} owns the data: a provider, its query, and the snapshot it
 *   fetched. Cached and refreshed once, however many tabs point at it.
 * - a {@link Tab} owns a {@link Projection}: how that snapshot is rendered — mode,
 *   filter query, grouping. Switching between tabs on one source is instant and
 *   costs no query.
 */

import { homedir } from "os"
import { join } from "path"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { boardKeyFor } from "./cache"
import type { ChildVisibility, SubtaskLayout, SwimlaneConfig } from "./config/types"
import type { Grouping } from "./grouping"
import { createQueryProvider } from "./providers/query"
import type { BoardProvider } from "./providers/provider"

/** A fetched issue set — one provider + query, shared by every tab projecting it. */
export interface BoardSource {
  /** Stable across restarts (the config board's name), so tabs can be persisted. */
  id: string
  name: string
  provider: BoardProvider
  /** Key for this source's on-disk snapshot cache (specs/033). */
  cacheKey: string
  /** Query-based swimlanes from board config; enables the `swimlanes` grouping. */
  swimlanes?: SwimlaneConfig[]
  /** The board's default mode from config (specs/017). */
  defaultMode?: TabMode
  /** The board's default grouping from config (specs/026). */
  defaultGrouping?: Grouping
  /**
   * The JQL this source *is*, when it was made from a query rather than a config board
   * (specs/047). Marks the source as query-backed: creation is refused on it, and its
   * columns are derived rather than configured.
   */
  query?: string
  /** JQL a global search starts inside while this board is active (specs/046). */
  searchScope?: string
  /** Project key, for resolving a bare issue number typed into the search (specs/046). */
  project?: string
  /**
   * The instance's epic-link field — `parent` on the unified hierarchy, a custom field id
   * on classic projects (specs/034). The search grammar needs it to name the clause an
   * `epic:` token becomes (specs/048).
   */
  epicField?: string
  /**
   * The board config declares backlog statuses (specs/044), so `v k` has something to
   * show. Known from config rather than from the loaded board, since tabs exist before
   * the first fetch resolves.
   */
  hasBacklog?: boolean
}

/** How a tab renders its source. `backlog` is the status-split list (specs/044). */
export type TabMode = "board" | "list" | "backlog"

/** The view state a tab owns — everything that isn't the data (specs/045). */
export interface Projection {
  mode: TabMode
  query: string
  grouping: Grouping
  /**
   * Card/row tag visibility (specs/039). Per tab, not global: a backlog is read down
   * the epic while a board is read across the columns, so the same toggle rarely suits
   * both. Absent → the `[display]` default.
   */
  epics?: boolean
  labels?: boolean
  /**
   * Sub-task layout (specs/008), switched per tab with the `v` chord (specs/051) —
   * a clone can read the same query by basket while the original stays a checklist.
   * Absent → the `[display] subtasks` default.
   */
  subtasks?: SubtaskLayout
  /** Which children the board draws (specs/052). Absent → the `[display]` default. */
  children?: ChildVisibility
}

/**
 * A query-backed source, stored on the tab that made it (specs/047). Config-board tabs
 * only need a `sourceId` because the config rebuilds their source on every launch; a
 * query's source exists nowhere else, so the tab carries what it takes to rebuild it.
 */
export interface QuerySpec {
  kind: "query"
  jql: string
  /** The board whose provider ran the query — the one to wrap again on restore. */
  originSourceId: string
  /** The origin's column titles, so restored columns keep the order they had. */
  columnOrder?: string[]
}

export interface Tab {
  id: string
  name: string
  sourceId: string
  projection: Projection
  /** Created in-app rather than by config, so it can be renamed/closed (specs/045). */
  adHoc?: boolean
  /** Set when this tab brought its own source with it (specs/047). */
  source?: QuerySpec
}

export const QUERY_SOURCE_PREFIX = "query:"

/**
 * A query source's id is its query, hashed: two tabs kept on the same search share one
 * source — one fetch, one refresh — and an edited query misses the old snapshot rather
 * than showing it.
 */
export function querySourceId(jql: string): string {
  return `${QUERY_SOURCE_PREFIX}${hash(jql)}`
}

function hash(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) >>> 0
  }
  return h.toString(36)
}

export const BOARD_TAB_PREFIX = "board:"

export function boardTabId(sourceId: string): string {
  return `${BOARD_TAB_PREFIX}${sourceId}`
}

export function defaultProjection(source: BoardSource): Projection {
  return {
    mode: source.defaultMode ?? "board",
    query: "",
    grouping: source.defaultGrouping ?? "parent",
  }
}

/**
 * A projection made safe for the source it lands on: a grouping the source can't
 * offer (swimlanes without lane definitions) would render an empty board, and a
 * persisted mode may outlive the config that allowed it.
 */
export function reconcile(projection: Projection, source: BoardSource): Projection {
  const hasSwimlanes = !!source.swimlanes && source.swimlanes.length > 0
  return {
    ...projection,
    grouping: projection.grouping === "swimlanes" && !hasSwimlanes ? "parent" : projection.grouping,
  }
}

/**
 * Wrap `origin`'s provider in one that loads `jql` instead (specs/047). The origin
 * supplies the credentials and every delegated mutation, and its column titles order the
 * derived columns; what the new source owns is the query.
 */
export function querySource(origin: BoardSource, spec: QuerySpec, name: string): BoardSource {
  return {
    id: querySourceId(spec.jql),
    name,
    provider: createQueryProvider(origin.provider, spec.jql, { columnOrder: spec.columnOrder }),
    cacheKey: boardKeyFor({ query: spec.jql }),
    query: spec.jql,
    defaultMode: "board",
    // Not `parent`: a result set is a flat list of matches, and grouping it by parent
    // would open a lane per parent the query never returned.
    defaultGrouping: "none",
    searchScope: origin.searchScope,
    project: origin.project,
    epicField: origin.epicField,
  }
}

/**
 * Rebuild the sources behind restored query tabs (specs/047), deduped — several tabs can
 * share one query. A tab whose origin board has left the config yields nothing, and
 * {@link findSource} then drops the tab, as it already does for a renamed board.
 */
export function restoreQuerySources(tabs: Tab[], configSources: BoardSource[]): BoardSource[] {
  const built = new Map<string, BoardSource>()
  for (const tab of tabs) {
    const spec = tab.source
    if (!spec || built.has(tab.sourceId)) {
      continue
    }
    const origin = findSource(configSources, spec.originSourceId)
    if (origin) {
      built.set(tab.sourceId, querySource(origin, spec, tab.name))
    }
  }
  return [...built.values()]
}

export function findSource(sources: BoardSource[], id: string): BoardSource | undefined {
  return sources.find((s) => s.id === id)
}

/** Unique ids from board names, which the user could well have duplicated. */
export function uniqueSourceId(name: string, taken: Set<string>): string {
  if (!taken.has(name)) {
    return name
  }
  let n = 2
  while (taken.has(`${name}#${n}`)) {
    n++
  }
  return `${name}#${n}`
}

// ---- ad-hoc tabs (specs/045) -----------------------------------------------

/**
 * Where user-created tabs are stored. Not the session file: that lives under
 * `XDG_CACHE_HOME` and must stay disposable (specs/033), while a saved view is
 * something the user made. Not config.toml either — it is the user's hand-written
 * record of boards, and may not even be writable (a Nix-managed symlink here).
 */
function tabsFile(): string {
  const base = process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state")
  return join(base, "lane", "tabs.json")
}

/** The persisted ad-hoc tabs, best-effort: a broken file costs the tabs, not the app. */
export function readAdHocTabs(): Tab[] {
  try {
    if (!existsSync(tabsFile())) {
      return []
    }
    const raw: unknown = JSON.parse(readFileSync(tabsFile(), "utf8"))
    if (!Array.isArray(raw)) {
      return []
    }
    return raw.filter(isTab).map((tab) => ({ ...tab, adHoc: true }))
  } catch {
    return []
  }
}

function isTab(value: unknown): value is Tab {
  const tab = value as Tab
  return (
    !!tab &&
    typeof tab.id === "string" &&
    typeof tab.name === "string" &&
    typeof tab.sourceId === "string" &&
    !!tab.projection &&
    typeof tab.projection.query === "string" &&
    (tab.source === undefined || isQuerySpec(tab.source))
  )
}

function isQuerySpec(value: unknown): value is QuerySpec {
  const spec = value as QuerySpec
  return (
    !!spec &&
    spec.kind === "query" &&
    typeof spec.jql === "string" &&
    typeof spec.originSourceId === "string"
  )
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

/** Persist the ad-hoc tabs, debounced ~500 ms so a burst of edits is one write. */
export function saveAdHocTabs(tabs: Tab[]): void {
  if (saveTimer) {
    clearTimeout(saveTimer)
  }
  saveTimer = setTimeout(() => {
    saveTimer = null
    try {
      mkdirSync(join(tabsFile(), ".."), { recursive: true })
      writeFileSync(tabsFile(), JSON.stringify(tabs, null, 2))
    } catch {
      // Non-fatal: the tabs live on in this session, just not the next one.
    }
  }, 500)
}

/**
 * Slot a tab in after the last one sharing its source, so a clone sits beside what it
 * was cloned from and the tab bar stays grouped by board.
 */
export function insertBySource(tabs: Tab[], tab: Tab): Tab[] {
  const last = tabs.map((t) => t.sourceId).lastIndexOf(tab.sourceId)
  const at = last < 0 ? tabs.length : last + 1
  return [...tabs.slice(0, at), tab, ...tabs.slice(at)]
}

/** A clone of `tab`: same source and projection, its own identity (specs/045). */
export function cloneOf(tab: Tab, name: string, id: string): Tab {
  return {
    id,
    name,
    sourceId: tab.sourceId,
    projection: { ...tab.projection },
    adHoc: true,
    // Cloning a query tab (specs/047) shares its source, so the clone has to be able to
    // rebuild it too — otherwise a restart that drops the original drops the clone with it.
    ...(tab.source ? { source: tab.source } : {}),
  }
}
