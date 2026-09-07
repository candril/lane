import { forwardRef } from "react"
import { TextAttributes, type ScrollBoxRenderable } from "@opentui/core"
import { theme } from "../theme"
import { markdownStyle, markdownTreeSitter } from "../markdown-style"
import { priorityGlyph, typeGlyph } from "../utils/glyphs"
import type { DetailState } from "../useIssueDetail"
import type { DetailHistoryRow } from "../history"
import type { HiddenChildren } from "../grouping"
import type { IssueType, Task } from "../types"
import { Avatar } from "./Avatar"
import { JumpGlyph } from "./JumpTag"
import { LabelTags } from "./LabelTags"

/**
 * An issue this one links to, drawn as a selectable row (specs/057): its epic, its
 * parent, or one of its children. `index` is the viewer cursor position that selects
 * it — 0 being the issue itself, so links start at 1.
 */
export interface DetailLink {
  key: string
  kind: "epic" | "parent" | "child"
  summary: string
  /** Unknown for a link the board never loaded, which then draws by its `kind`. */
  type?: IssueType
  status?: string
  statusColor?: string
  statusGlyph?: string
  /** Finished work: struck through and dimmed, as the card and the list row draw it. */
  done?: boolean
  index: number
}

interface IssueDetailProps {
  task: Task
  detail: DetailState
  /** The issue's status as the board names it, with its column's glyph and colour. */
  status: string
  statusColor: string
  statusGlyph: string
  /** In the done column: the key reads struck through, as it does on its card. */
  done: boolean
  /** The issues this one links to, drawn in list order (specs/057). */
  links: DetailLink[]
  /** Which item the viewer's cursor is on: 0 the issue itself, else a link's `index`. */
  focusIndex: number
  /** Jump labels by link key while a jump is active (specs/037) — `s` works here too. */
  jumpLabels?: Map<string, string>
  /** How many children the issue has — drawn on the heading while they are folded. */
  childCount: number
  /** The children section folded away (`z a`): heading only, no rows (specs/057). */
  childrenFolded: boolean
  /** Children the visibility setting is keeping out of the list (specs/052). */
  hiddenChildren?: HiddenChildren
  /** Keys in the multi-select (specs/055) — the same set the board tints. */
  selectedKeys?: Set<string>
  /** The changelog rows drawn (specs/058) — empty while the section is folded. */
  history: DetailHistoryRow[]
  historyCount: number
  historyFolded: boolean
  /** A history edit shown as a diff in place of the description (specs/058). */
  diff: { title: string; text: string } | null
  /** Cursor index of each section's heading — a stop of its own (specs/057) — and of
   * the history's `… N more` line while it hides the rest (specs/058). */
  sections: { children?: number; history?: number; more?: number }
}

/** The label gutter every field hangs off; wide enough for `assignee`, the longest. */
const LABEL_WIDTH = 10

/**
 * A linked issue's status sits in a column of its own, right-aligned, so a list of
 * sub-tasks scans down one edge instead of each status landing wherever its summary
 * happened to end — the same reason the list view fixes it (specs/017).
 */
const STATUS_COLUMN = 16

/** Pad to `width` (right-aligned), eliding anything longer. */
function column(text: string, width: number): string {
  return text.length > width ? `${text.slice(0, width - 1)}…` : text.padStart(width)
}

/** Pad to `width` (left-aligned), eliding anything longer — a history row's date cell. */
function cell(text: string, width: number): string {
  return text.length > width ? `${text.slice(0, width - 1)}…` : text.padEnd(width)
}

function Field({
  label,
  selected,
  marked,
  children,
}: {
  label: string
  /** A link row the viewer's cursor is on — the actions target it (specs/057). */
  selected?: boolean
  /** In the multi-select: tinted like a marked card, the cursor's colour winning. */
  marked?: boolean
  children: React.ReactNode
}) {
  return (
    <box
      flexDirection="row"
      backgroundColor={selected ? theme.cardBgFocused : marked ? theme.cardBgSelected : undefined}
    >
      <box width={LABEL_WIDTH} flexShrink={0}>
        <text fg={theme.textDim}>{label}</text>
      </box>
      <box flexGrow={1} flexShrink={1}>
        {children}
      </box>
    </box>
  )
}

/**
 * One linked issue: type glyph, `KEY summary`, and its status in the right-hand column.
 * An epic the board never loaded has no type of its own, so it draws as one.
 */
function LinkRow({
  link,
  jumpLabel,
  emphasis,
}: {
  link: DetailLink
  jumpLabel?: string
  /** Focused *and* marked: the cursor owns the background, so the key says "marked". */
  emphasis?: boolean
}) {
  const type = typeGlyph(link.type ?? (link.kind === "epic" ? "epic" : "task"))
  return (
    <box flexDirection="row">
      <box flexGrow={1} flexShrink={1} marginRight={1}>
        <text>
          <JumpGlyph label={jumpLabel} char={type.char} color={type.color} />
          <span
            fg={emphasis ? theme.warning : theme.textDim}
            attributes={link.done ? TextAttributes.STRIKETHROUGH : undefined}
          >
            {link.key}
          </span>
          <span fg={link.done ? theme.textDim : theme.text}> {link.summary}</span>
        </text>
      </box>
      {link.status && (
        <box flexShrink={0}>
          <text fg={link.statusColor ?? theme.textDim}>
            {column(`${link.statusGlyph ?? ""} ${link.status}`.trim(), STATUS_COLUMN)}
          </text>
        </box>
      )}
    </box>
  )
}

/**
 * The single-issue viewer (specs/007): the issue's fields, then its description
 * rendered as Markdown.
 *
 * It takes over the content region rather than floating above everything, so the
 * board's header stays put (tabs, toasts) and the bottom prompts — the field pickers
 * this view exists to host — still open *below* it, where an absolute overlay would
 * have painted over them.
 *
 * It renders nothing it owns: the header comes from board state, so a status set
 * with `⇧S` while the viewer is open shows up here as soon as the optimistic update
 * lands, and the description comes from the lazy fetch. The scrollbox is exposed by
 * ref because the keymap, not this component, owns the keyboard (specs/003).
 *
 * The fields reuse the board's own vocabulary — the status glyph, the assignee chip,
 * the label tags — so an issue reads the same here as on its card, just spelled out.
 */
export const IssueDetail = forwardRef<ScrollBoxRenderable, IssueDetailProps>(function IssueDetail(
  {
    task,
    detail,
    status,
    statusColor,
    statusGlyph,
    done,
    links,
    focusIndex,
    jumpLabels,
    childCount,
    childrenFolded,
    hiddenChildren,
    selectedKeys,
    history,
    historyCount,
    historyFolded,
    diff,
    sections,
  },
  ref,
) {
  const type = typeGlyph(task.type)
  const priority = priorityGlyph(task.priority)
  const marked = (key: string) => !!selectedKeys?.has(key)
  const linkRow = (link: DetailLink) => (
    <LinkRow
      link={link}
      jumpLabel={jumpLabels?.get(link.key)}
      emphasis={focusIndex === link.index && marked(link.key)}
    />
  )
  const epic = links.find((l) => l.kind === "epic")
  const parent = links.find((l) => l.kind === "parent")
  const children = links.filter((l) => l.kind === "child")

  return (
    <box flexGrow={1} flexDirection="column" backgroundColor={theme.bg}>
      <box
        flexDirection="row"
        flexShrink={0}
        backgroundColor={
          focusIndex === 0
            ? theme.cardBgFocused
            : marked(task.key)
              ? theme.cardBgSelected
              : theme.headerBg
        }
        paddingX={2}
      >
        <box flexShrink={0}>
          <text fg={type.color}>{type.char} </text>
        </box>
        <box flexGrow={1} flexShrink={1}>
          <text>
            <span
              fg={focusIndex === 0 && marked(task.key) ? theme.warning : theme.primary}
              attributes={
                done ? TextAttributes.BOLD | TextAttributes.STRIKETHROUGH : TextAttributes.BOLD
              }
            >
              {task.key}
            </span>
            <span fg={done ? theme.textDim : theme.text}> {task.summary}</span>
          </text>
        </box>
      </box>

      <box flexDirection="column" flexShrink={0} paddingX={2} paddingTop={1}>
        <Field label="status">
          <text>
            <span fg={statusColor} attributes={TextAttributes.BOLD}>
              {statusGlyph} {status}
            </span>
            <span fg={theme.textDim}> · </span>
            <span fg={priority.color}>{priority.char} </span>
            <span fg={theme.textDim}>{task.priority}</span>
            {task.points != null && <span fg={theme.textDim}> · {task.points} pts</span>}
          </text>
        </Field>
        <Field label="assignee">
          {task.assignee ? (
            <box flexDirection="row">
              <Avatar name={task.assignee} />
              <text fg={theme.text}> {task.assignee}</text>
            </box>
          ) : (
            // No chip here: its blank placeholder exists to keep list rows aligned,
            // which a lone field has no need of.
            <text fg={theme.textMuted}>unassigned</text>
          )}
        </Field>
        {epic && (
          <Field label="epic" selected={focusIndex === epic.index} marked={marked(epic.key)}>
            {linkRow(epic)}
          </Field>
        )}
        {parent && (
          <Field label="parent" selected={focusIndex === parent.index} marked={marked(parent.key)}>
            {linkRow(parent)}
          </Field>
        )}
        {!!task.labels?.length && (
          <Field label="labels">
            <LabelTags labels={task.labels} max={task.labels.length} />
          </Field>
        )}

        {sections.children !== undefined && (
          // The children get a section of their own rather than a value slot: a list
          // wants the full width, and a heading over it reads as "what hangs off this"
          // where a label beside the first row read as a field with a long value. The
          // heading folds like a list row does (`▾`/`▸`), keeping the count in view,
          // and is a cursor stop so the fold can be reached from the keyboard.
          <box flexDirection="column" marginTop={1}>
            <box
              backgroundColor={focusIndex === sections.children ? theme.cardBgFocused : undefined}
            >
              <text fg={theme.textDim}>
                {childrenFolded ? "▸" : "▾"} {task.type === "epic" ? "stories" : "subtasks"}
                {childrenFolded ? ` ${childCount}` : ""}
              </text>
            </box>
            {children.map((child) => (
              <box
                key={child.key}
                paddingLeft={2}
                backgroundColor={
                  focusIndex === child.index
                    ? theme.cardBgFocused
                    : marked(child.key)
                      ? theme.cardBgSelected
                      : undefined
                }
              >
                {linkRow(child)}
              </box>
            ))}
            {!!hiddenChildren && !childrenFolded && (
              // The card's marker, as a note under the list: children kept out by the
              // visibility setting read as hidden, never as absent (specs/052).
              <box paddingLeft={2}>
                <text fg={theme.textMuted}>
                  {hiddenChildren.done
                    ? `✓ ${hiddenChildren.count} done`
                    : `▸ ${hiddenChildren.count} hidden`}
                </text>
              </box>
            )}
          </box>
        )}
        {sections.history !== undefined && (
          // Folded by default: a peek, between the links and the description, where
          // "what happened to this" sits between "what it is" and "what it says".
          <box flexDirection="column" marginTop={1}>
            <box
              backgroundColor={focusIndex === sections.history ? theme.cardBgFocused : undefined}
            >
              <text fg={theme.textDim}>
                {historyFolded ? "▸" : "▾"} history{historyFolded ? ` ${historyCount}` : ""}
              </text>
            </box>
            {history.map((row) => (
              <box
                key={row.index}
                paddingLeft={2}
                backgroundColor={focusIndex === row.index ? theme.cardBgFocused : undefined}
              >
                <box flexDirection="row">
                  <text fg={theme.textDim}>{cell(row.when, 13)}</text>
                  {/* The author as the board's initials chip: the same person reads
                      the same everywhere, and a name column cost half the row. */}
                  <Avatar name={row.author} />
                  <text fg={theme.text}> {row.summary}</text>
                </box>
              </box>
            ))}
            {sections.more !== undefined && (
              // A stop, not a footnote: reachable with j, opened with ↵ or l.
              <box
                paddingLeft={2}
                backgroundColor={focusIndex === sections.more ? theme.cardBgFocused : undefined}
              >
                <text fg={theme.textMuted}>… {historyCount - history.length} more</text>
              </box>
            )}
          </box>
        )}
      </box>

      <scrollbox ref={ref} flexGrow={1} paddingX={2} paddingY={1}>
        {diff ? (
          // The board's Markdown highlighting inside the diff, so a changed heading
          // or list still reads as one — the change is the only new thing on screen.
          <box flexDirection="column">
            <text fg={theme.textDim}>{diff.title}</text>
            <diff
              diff={diff.text}
              view="unified"
              filetype="markdown"
              syntaxStyle={markdownStyle()}
              treeSitterClient={markdownTreeSitter()}
              wrapMode="word"
              addedSignColor={theme.success}
              removedSignColor={theme.error}
            />
          </box>
        ) : detail.error ? (
          <text fg={theme.error}>{detail.error}</text>
        ) : detail.loading ? (
          <text fg={theme.textDim}>loading…</text>
        ) : detail.description ? (
          <markdown
            content={detail.description}
            syntaxStyle={markdownStyle()}
            treeSitterClient={markdownTreeSitter()}
          />
        ) : (
          <text fg={theme.textMuted}>(no description)</text>
        )}
      </scrollbox>
    </box>
  )
})
