import { theme } from "../theme"
import type { Suggestion } from "../filter"
import { priorityGlyph, typeGlyph } from "../utils/glyphs"
import { Avatar } from "./Avatar"
import type { Task } from "../types"

export interface SearchState {
  query: string
  results: Task[]
  index: number
  /** Whether the configured scope is applied — toggled while searching (specs/046). */
  scoped: boolean
  loading: boolean
  /** A JQL query typed but not yet run — it waits for ↵ (specs/046). */
  pending?: boolean
  error?: string
  /** Highlighted completion, while a field token is open (specs/048). */
  suggestIndex?: number
  /** `@name`s the board couldn't resolve to an account (specs/048). */
  unresolved?: string[]
}

interface SearchPromptProps {
  state: SearchState
  /** Label for the configured scope, e.g. the team. Absent → nothing to scope by. */
  scopeLabel?: string
  /** Completions for an open field token — the same list `/` offers (specs/048). */
  suggestions: Suggestion[]
  onQueryChange: (query: string) => void
}

/**
 * The global-search palette (specs/046): a centered dialog — one input over a result
 * list — in the shape every editor's Ctrl-P has, because that is the shape everyone
 * already knows for "find the thing and go to it". It renders
 * state App owns rather than owning its own, because the results come from the network
 * — the keyboard, the debounce and the latest-wins bookkeeping all live with the
 * request, not with the list.
 *
 * The scope chip is the important affordance: a search starts inside your team, and
 * the prompt has to say so, or "no results" reads as "not in Jira" when it means "not
 * in your team".
 */
export function SearchPrompt({ state, scopeLabel, suggestions, onQueryChange }: SearchPromptProps) {
  const { query, results, index, scoped, loading, pending, error, unresolved } = state
  const completing = suggestions.length > 0
  const hint =
    error ??
    unresolved?.map((who) => `unknown: ${who}`).join(" ") ??
    (loading ? "searching…" : pending ? "↵ to run" : `${results.length} found`)
  return (
    <box
      position="absolute"
      width="100%"
      height="100%"
      justifyContent="center"
      alignItems="center"
      zIndex={100}
    >
      <box
        flexDirection="column"
        width="70%"
        backgroundColor={theme.modalBg}
        paddingX={2}
        paddingY={1}
      >
        <box flexDirection="row" paddingBottom={1}>
          <text>
            <span fg={theme.textDim}>search </span>
            {scopeLabel ? (
              <span fg={scoped ? theme.primary : theme.textMuted}>
                {scoped ? `⟨${scopeLabel}⟩` : "⟨all of Jira⟩"}
              </span>
            ) : null}
            <span fg={theme.textDim}> ▸ </span>
          </text>
          <box flexGrow={1}>
            <input width="100%" focused value={query} onInput={onQueryChange} />
          </box>
          <text fg={error ? theme.error : theme.textMuted}> {hint}</text>
        </box>
        {completing &&
          suggestions.map((s, i) => {
            const on = i === (state.suggestIndex ?? 0)
            return (
              <box
                key={s.insert}
                flexDirection="row"
                paddingX={1}
                backgroundColor={on ? theme.cardBgFocused : undefined}
              >
                <text fg={s.color ?? (on ? theme.text : theme.textDim)}>{s.label}</text>
                <box flexGrow={1} />
                {s.detail && <text fg={theme.textMuted}>{s.detail}</text>}
              </box>
            )
          })}
        {!completing &&
          results.map((task, i) => {
            const type = typeGlyph(task.type)
            const priority = priorityGlyph(task.priority)
            return (
              <box
                key={task.key}
                flexDirection="row"
                paddingX={1}
                backgroundColor={i === index ? theme.cardBgFocused : undefined}
              >
                <text>
                  <span fg={type.color}>{type.char} </span>
                  <span fg={theme.text}>{task.key}</span>
                  <span fg={theme.textDim}> {task.summary}</span>
                </text>
                <box flexGrow={1} />
                <text fg={theme.textDim}>{task.status ?? task.columnId} </text>
                <text fg={priority.color}>{priority.char} </text>
                <Avatar name={task.assignee} />
              </box>
            )
          })}
        <box paddingTop={1}>
          <text fg={theme.textMuted}>
            {completing ? (
              "↑↓ ^y/tab complete · esc"
            ) : (
              <span>
                {pending ? "↵ run" : "↵ open"} · ^T keep as tab · ^O browser · ^Y/^U copy key/url ·
                ^A {scoped ? "all of Jira" : "back to scope"} · esc
              </span>
            )}
          </text>
        </box>
      </box>
    </box>
  )
}
