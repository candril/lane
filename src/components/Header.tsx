import { Fragment } from "react"
import { theme } from "../theme"
import type { Grouping } from "../grouping"
import { version } from "../version"
import type { TabMode } from "../tabs"

interface HeaderProps {
  /** Tabs in order, active one highlighted (specs/016). Ad-hoc tabs are marked (specs/045). */
  boards: { name: string; adHoc?: boolean }[]
  /** Index of the active board within {@link boards}. */
  activeBoard: number
  view: TabMode
  grouping: Grouping
  /** Present while a filter narrows the board — shows the query and match count. */
  filter?: { visible: number; query: string } | null
  /** A background board refresh is in flight (specs/033). */
  refreshing?: boolean
  /** When the active board was last refreshed (epoch ms), for the age readout (specs/033). */
  lastRefresh?: number | null
  /** True once the data is older than ~2× the refresh interval (specs/033). */
  stale?: boolean
  /** Transient confirmation (copy / open); replaces the mode readout while shown. */
  toast?: string | null
}

/** "just now" / "Nm ago" / "Nh ago" — a terse age for the last refresh. */
function ageLabel(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000)
  if (secs < 60) {
    return "just now"
  }
  const mins = Math.floor(secs / 60)
  if (mins < 60) {
    return `${mins}m ago`
  }
  return `${Math.floor(mins / 60)}h ago`
}

const MAX_TAB_NAME = 20

/**
 * The tab bar is one line, and tabs now multiply — a board, its backlog (specs/044)
 * and any clones (specs/045) — so a long name would push later tabs off the edge
 * where they can't be seen at all. Better to shorten the name than to lose the tab.
 */
function elide(name: string): string {
  return name.length > MAX_TAB_NAME ? `${name.slice(0, MAX_TAB_NAME - 1)}…` : name
}

/**
 * A tab the user made (specs/045) is tinted rather than badged: the tab bar is one
 * line and a glyph per tab eats it, while a colour distinguishes at a glance which
 * tabs are yours — and so which ones `⇧T r`/`⇧T x` will act on.
 */
function adHocColor(tab: { adHoc?: boolean }, active: boolean): string {
  if (tab.adHoc) {
    return active ? theme.secondary : theme.textDim
  }
  return active ? theme.text : theme.textDim
}

const GROUPING_LABEL: Record<Grouping, string> = {
  none: "flat",
  parent: "by parent",
  type: "by type",
  swimlanes: "swimlanes",
  sprint: "by sprint",
}

export function Header({
  boards,
  activeBoard,
  view,
  grouping,
  filter,
  refreshing,
  lastRefresh,
  stale,
  toast,
}: HeaderProps) {
  const mode = view === "board" ? `board · ${GROUPING_LABEL[grouping]}` : view
  const active = filter && filter.query !== ""
  return (
    <box height={1} backgroundColor={theme.headerBg} paddingX={1} flexDirection="row">
      <text>
        <span fg={theme.textMuted}>{"lane  "}</span>
        {boards.map((tab, i) => (
          <Fragment key={tab.name}>
            <span fg={theme.textMuted}>{`${i + 1} `}</span>
            <span fg={adHocColor(tab, i === activeBoard)}>
              {i === activeBoard ? <strong>{elide(tab.name)}</strong> : elide(tab.name)}
            </span>
            {i < boards.length - 1 ? <span fg={theme.textMuted}>{"   "}</span> : null}
          </Fragment>
        ))}
      </text>
      <box flexGrow={1} />
      {/* The status tail keeps its width — when space runs out the tab list gives,
          not the mode/version readout at the edge. */}
      <box flexShrink={0} marginLeft={2}>
        {toast ? (
          <text>
            <span fg={theme.success}>✓ {toast}</span>
          </text>
        ) : (
          <text>
            {refreshing ? (
              <span fg={theme.warning}>⟳ refreshing · </span>
            ) : lastRefresh ? (
              <span fg={stale ? theme.warning : theme.textMuted}>
                updated {ageLabel(lastRefresh)} ·{" "}
              </span>
            ) : null}
            {active && <span fg={theme.warning}>⧉ filtered · </span>}
            <span fg={theme.primary}>{mode}</span>
            <span fg={theme.textMuted}> · v{version}</span>
          </text>
        )}
      </box>
    </box>
  )
}
