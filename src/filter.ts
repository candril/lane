/**
 * Client-side filtering for the board (specs/020). A query string of
 * `field:value` tokens plus free text becomes a {@link ParsedQuery}, applied to
 * `board.tasks` *before* grouping so lane and column counts reflect the matches.
 * This is view state — it never mutates the board.
 *
 * Grammar: `type:bug @ada is:review p:high some text`. Repeated fields OR within
 * a field and AND across fields; the leftover words are fuzzy free-text over
 * key + summary. Values may be quoted to hold spaces: `assignee:"Ada Lovelace"`.
 */

import type { Board, Column, Task } from "./types"
import { fuzzyMatches } from "./utils/fuzzy"
import {
  avatarColor,
  columnColor,
  epicColor,
  labelColor,
  priorityGlyph,
  typeGlyph,
} from "./utils/glyphs"

export type FilterField = "type" | "assignee" | "status" | "priority" | "label" | "epic"

export interface ParsedQuery {
  text: string
  /** OR-ed values per field; absent/empty means the field is unconstrained. */
  fields: Record<FilterField, string[]>
  /** Negated values per field (`-type:bug`): a task matching any is excluded. */
  negFields: Record<FilterField, string[]>
}

/**
 * How the filter treats sub-tasks (specs/043). `strict` matches every issue on its own
 * merits; `inherit` keeps all sub-tasks of a matching issue, so `@me` answers "what am I
 * on?" with the whole work item rather than the two rows assigned to me.
 */
export type SubtaskScope = "strict" | "inherit"

export interface FilterContext {
  columns: Column[]
  /** Display name behind `assignee:me`. */
  currentUser?: string
  /** Defaults to `strict`. */
  subtaskScope?: SubtaskScope
}

/** Short and long spellings that map onto a canonical field. */
const FIELD_ALIASES: Record<string, FilterField> = {
  type: "type",
  t: "type",
  assignee: "assignee",
  a: "assignee",
  status: "status",
  is: "status",
  priority: "priority",
  p: "priority",
  prio: "priority",
  label: "label",
  labels: "label",
  l: "label",
  epic: "epic",
  e: "epic",
}

const emptyFields = (): Record<FilterField, string[]> => ({
  type: [],
  assignee: [],
  status: [],
  priority: [],
  label: [],
  epic: [],
})

function unquote(value: string): string {
  return value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value
}

/** Split on whitespace, but keep a `field:"quoted value"` (or bare `"quoted"`) whole. */
function tokenize(input: string): string[] {
  return input.match(/(?:[^\s"]+:)?"[^"]*"|\S+/g) ?? []
}

export function parseQuery(input: string): ParsedQuery {
  const fields = emptyFields()
  const negFields = emptyFields()
  const text: string[] = []
  for (const token of tokenize(input)) {
    // A leading `-` (or `!`) negates a field token: `-type:bug`, `-#UX`, `-@ada`.
    // It only takes effect when the remainder is a real field token; otherwise the
    // original token stays free text (so a literal `-word` isn't silently dropped).
    const negated = /^[-!]/.test(token) && token.length > 1
    const body = negated ? token.slice(1) : token
    const target = negated ? negFields : fields

    if (body.startsWith("@") && body.length > 1) {
      target.assignee.push(unquote(body.slice(1)))
      continue
    }
    if (body.startsWith("#") && body.length > 1) {
      target.label.push(unquote(body.slice(1)))
      continue
    }
    const colon = body.indexOf(":")
    if (colon > 0) {
      const field = FIELD_ALIASES[body.slice(0, colon).toLowerCase()]
      const value = unquote(body.slice(colon + 1))
      if (field && value) {
        target[field].push(value)
        continue
      }
      // A known field with no value yet (`type:`) is an in-progress token, not
      // free text — drop it so it doesn't filter until a value is typed.
      if (field) {
        continue
      }
    }
    text.push(token)
  }
  return { text: text.join(" "), fields, negFields }
}

const FILTER_FIELDS: FilterField[] = ["type", "assignee", "status", "priority", "label", "epic"]

export function isEmptyQuery(query: ParsedQuery): boolean {
  if (query.text !== "") {
    return false
  }
  return FILTER_FIELDS.every((f) => query.fields[f].length === 0 && query.negFields[f].length === 0)
}

/**
 * Every searchable string on a task — free text (no `field:`) fuzzy-matches
 * across all of them, presto-style: key, summary, assignee, type, priority,
 * status, labels, and the epic (its key and summary). `epicSummary` is the
 * linked epic's summary, resolved by the caller since it lives on another task.
 */
function taskFields(task: Task, ctx: FilterContext, epicSummary?: string): string[] {
  const fields = [task.key, task.summary, task.type, task.priority, statusTitle(task, ctx.columns)]
  if (task.assignee) {
    fields.push(task.assignee)
  }
  if (task.labels) {
    fields.push(...task.labels)
  }
  if (task.epicKey) {
    fields.push(task.epicKey)
  }
  // The epic's summary — from the task itself (specs/029) or resolved by the caller
  // from a loaded epic issue — so free text finds a card by its epic's name.
  if (task.epicName) {
    fields.push(task.epicName)
  }
  if (epicSummary) {
    fields.push(epicSummary)
  }
  return fields
}

function matchesText(fields: string[], text: string): boolean {
  if (!text) {
    return true
  }
  // Each whitespace-separated word must fuzzy-match at least one field — "past
  // pack" reads as an AND of "past" and "pack", each free to land in a different
  // field. Matching per-field (not one joined string) keeps a subsequence from
  // straddling a boundary — "graceui" can't span assignee "Grace" + label "UI".
  return text.split(/\s+/).every((word) => fields.some((f) => fuzzyMatches(word, f)))
}

function matchesEnum(value: string, actual: string): boolean {
  return actual.toLowerCase().startsWith(value.toLowerCase())
}

function statusTitle(task: Task, columns: Column[]): string {
  return columns.find((c) => c.id === task.columnId)?.title ?? ""
}

function matchesAssignee(task: Task, value: string, currentUser?: string): boolean {
  const v = value.toLowerCase()
  if (v === "me") {
    return !!currentUser && task.assignee === currentUser
  }
  if (v === "none" || v === "unassigned") {
    return !task.assignee
  }
  return !!task.assignee && task.assignee.toLowerCase().includes(v)
}

/** Does `task` carry `value` for `field`? Shared by positive and negated matching. */
function fieldMatches(field: FilterField, task: Task, value: string, ctx: FilterContext): boolean {
  switch (field) {
    case "type":
      return matchesEnum(value, task.type)
    case "priority":
      return matchesEnum(value, task.priority)
    case "status":
      return statusTitle(task, ctx.columns).toLowerCase().includes(value.toLowerCase())
    case "assignee":
      return matchesAssignee(task, value, ctx.currentUser)
    case "label":
      return matchesLabel(task, value)
    case "epic":
      return matchesEpic(task, value)
  }
}

/** An `epic:` value matches the linked epic's key or name, case-insensitive substring. */
function matchesEpic(task: Task, value: string): boolean {
  const v = value.toLowerCase()
  if (v === "none" || v === "no") {
    return !task.epicKey
  }
  return !!task.epicKey?.toLowerCase().includes(v) || !!task.epicName?.toLowerCase().includes(v)
}

function matchesTask(
  task: Task,
  query: ParsedQuery,
  ctx: FilterContext,
  fields: string[],
): boolean {
  if (!matchesText(fields, query.text)) {
    return false
  }
  for (const field of FILTER_FIELDS) {
    const wanted = query.fields[field]
    // Positive: must match at least one requested value (OR within a field).
    if (wanted.length && !wanted.some((v) => fieldMatches(field, task, v, ctx))) {
      return false
    }
    // Negated: excluded if it matches any negated value.
    if (query.negFields[field].some((v) => fieldMatches(field, task, v, ctx))) {
      return false
    }
  }
  return true
}

/** Labels are atomic tags, so match a whole label case-insensitively, not a substring. */
function matchesLabel(task: Task, value: string): boolean {
  const v = value.toLowerCase()
  return !!task.labels?.some((l) => l.toLowerCase() === v)
}

/**
 * The visible task subset. A parent whose sub-task matches is kept even if it
 * doesn't match itself, so the matching card keeps its swimlane and doesn't
 * become an orphan lane (grouping.ts). Order is preserved.
 *
 * Under the `inherit` sub-task scope the reverse link is kept too: a matching issue
 * brings all its sub-tasks along (specs/043). Children come off the *matched* set, not
 * the kept one — a parent kept only for context must not drag in unmatched siblings.
 */
export function applyFilter(board: Board, query: ParsedQuery, ctx: FilterContext): Task[] {
  if (isEmptyQuery(query)) {
    return board.tasks
  }
  // Free text searches the linked epic's summary too, which lives on another
  // task — resolve it via a key→summary map (built only when there's text to match).
  const summaryByKey = query.text ? new Map(board.tasks.map((t) => [t.key, t.summary])) : null
  const matched = new Set<string>()
  const keep = new Set<string>()
  for (const task of board.tasks) {
    const epicSummary = task.epicKey ? summaryByKey?.get(task.epicKey) : undefined
    if (matchesTask(task, query, ctx, taskFields(task, ctx, epicSummary))) {
      matched.add(task.key)
      keep.add(task.key)
      if (task.parentKey) {
        keep.add(task.parentKey)
      }
    }
  }
  if (ctx.subtaskScope === "inherit") {
    for (const task of board.tasks) {
      if (task.parentKey && matched.has(task.parentKey)) {
        keep.add(task.key)
      }
    }
  }
  return board.tasks.filter((t) => keep.has(t.key))
}

// ---- suggestions -----------------------------------------------------------

export interface Suggestion {
  /** Replaces the in-progress token; the caller appends a trailing space. */
  insert: string
  label: string
  /** Small right-aligned annotation, e.g. a match count. */
  detail?: string
  color?: string
}

/** The in-progress token — everything after the last space (caret sits at end). */
export function lastToken(input: string): string {
  return input.slice(input.lastIndexOf(" ") + 1)
}

/** Replace the in-progress token with `insert`, leaving earlier tokens intact. */
export function replaceLastToken(input: string, insert: string): string {
  return input.slice(0, input.lastIndexOf(" ") + 1) + insert
}

/** Quote a value for insertion only when it carries a space. */
function tokenValue(field: string, value: string): string {
  return value.includes(" ") ? `${field}:"${value}"` : `${field}:${value}`
}

interface Candidate {
  value: string
  label: string
  count: number
  color?: string
}

function distinct<T>(items: T[]): T[] {
  return [...new Set(items)]
}

function fieldCandidates(field: FilterField, board: Board, ctx: FilterContext): Candidate[] {
  const tasks = board.tasks
  const tally = (pred: (t: Task) => boolean) => tasks.filter(pred).length

  if (field === "type") {
    return distinct(tasks.map((t) => t.type)).map((type) => ({
      value: type,
      label: `${typeGlyph(type).char} ${type}`,
      count: tally((t) => t.type === type),
      color: typeGlyph(type).color,
    }))
  }
  if (field === "priority") {
    return distinct(tasks.map((t) => t.priority)).map((p) => ({
      value: p,
      label: `${priorityGlyph(p).char} ${p}`,
      count: tally((t) => t.priority === p),
      color: priorityGlyph(p).color,
    }))
  }
  if (field === "status") {
    return ctx.columns
      .map((col) => ({
        value: col.title,
        label: col.title,
        count: tally((t) => t.columnId === col.id),
        color: columnColor(ctx.columns.indexOf(col), ctx.columns.length, col.title),
      }))
      .filter((c) => c.count > 0)
  }
  if (field === "label") {
    return distinct(tasks.flatMap((t) => t.labels ?? [])).map((label) => ({
      value: label,
      label,
      count: tally((t) => !!t.labels?.includes(label)),
      color: labelColor(label),
    }))
  }
  if (field === "epic") {
    // One candidate per referenced epic; the value is its key (so `epic:SHOP-1`),
    // the label its name when known. Ranked by how many loaded cards link to it.
    const keys = distinct(tasks.map((t) => t.epicKey).filter((k): k is string => !!k))
    return keys.map((key) => ({
      value: key,
      label: tasks.find((t) => t.epicKey === key)?.epicName ?? key,
      count: tally((t) => t.epicKey === key),
      color: epicColor(key),
    }))
  }
  // assignee — real names plus the me/none shorthands
  const names = distinct(tasks.map((t) => t.assignee).filter((n): n is string => !!n))
  const people: Candidate[] = names.map((name) => ({
    value: name,
    label: name,
    count: tally((t) => t.assignee === name),
    color: avatarColor(name),
  }))
  const unassigned = tally((t) => !t.assignee)
  if (unassigned > 0) {
    people.push({ value: "none", label: "unassigned", count: unassigned })
  }
  if (ctx.currentUser) {
    people.unshift({
      value: "me",
      label: `me (${ctx.currentUser})`,
      count: tally((t) => t.assignee === ctx.currentUser),
    })
  }
  return people
}

const FIELD_STARTERS: { field: FilterField; key: string }[] = [
  { field: "type", key: "type" },
  { field: "assignee", key: "assignee" },
  { field: "status", key: "status" },
  { field: "priority", key: "priority" },
  { field: "label", key: "label" },
  { field: "epic", key: "epic" },
]

/**
 * Completions for the in-progress token: values of a `field:` being typed, or —
 * when no field is open yet — the field names themselves. Ranked by fuzzy match
 * on the partial, most-used values first.
 */
interface OpenField {
  /** How the field was spelled — `@`, `#`, or an alias like `epic`. */
  fieldKey: string
  field: FilterField
  /** The value typed so far. */
  partial: string
  /** A leading `-`/`!`, carried back into every insertion so `-label:` → `-label:UX`. */
  neg: string
}

/** The field being completed in the in-progress token, if the token opened one. */
export function openField(input: string): OpenField | null {
  const raw = lastToken(input)
  const neg = /^[-!]/.test(raw) ? raw[0]! : ""
  const token = neg ? raw.slice(1) : raw

  if (token.startsWith("@")) {
    return { fieldKey: "@", field: "assignee", partial: token.slice(1), neg }
  }
  if (token.startsWith("#")) {
    return { fieldKey: "#", field: "label", partial: token.slice(1), neg }
  }
  const colon = token.indexOf(":")
  if (colon > 0) {
    const key = token.slice(0, colon).toLowerCase()
    const field = FIELD_ALIASES[key]
    if (field) {
      return { fieldKey: key, field, partial: unquote(token.slice(colon + 1)), neg }
    }
  }
  return null
}

export function suggestions(input: string, board: Board, ctx: FilterContext): Suggestion[] {
  const open = openField(input)
  const raw = lastToken(input)
  const neg = open?.neg ?? (/^[-!]/.test(raw) ? raw[0]! : "")
  const token = neg ? raw.slice(1) : raw
  const fieldKey = open?.fieldKey ?? null
  const field = open?.field ?? null
  const partial = open?.partial ?? token

  if (field) {
    const p = partial.toLowerCase()
    return fieldCandidates(field, board, ctx)
      .filter((c) => fuzzyMatches(p, c.value) || fuzzyMatches(p, c.label))
      .sort((a, b) => b.count - a.count)
      .map((c) => ({
        insert:
          neg +
          (fieldKey === "@" || fieldKey === "#"
            ? `${fieldKey}${c.value.includes(" ") ? `"${c.value}"` : c.value}`
            : tokenValue(fieldKey!, c.value)),
        label: c.label,
        detail: String(c.count),
        color: c.color,
      }))
  }

  // No field open: offer field starters that fuzzy-match the partial word.
  return FIELD_STARTERS.filter(({ key }) => fuzzyMatches(token, key)).map(({ key }) => ({
    insert: `${neg}${key}:`,
    label: `${neg}${key}:`,
  }))
}
