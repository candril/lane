/**
 * Turning what you typed into a Jira query (specs/046, specs/048).
 *
 * One prompt takes three kinds of input, because asking which kind you meant would be
 * a worse prompt: an issue key goes straight to that issue, something shaped like JQL
 * runs verbatim, and anything else goes through the filter grammar `/` already uses —
 * `type:bug @me #UX epic:SHOP-1 some words` — translated to JQL rather than matched
 * locally. One language for both prompts: `/` narrows what is loaded, `:` finds what
 * isn't (specs/048).
 */

import { parseQuery, type FilterField, type ParsedQuery } from "./filter"
import type { Board } from "./types"

/** `SHOP-123`, or a bare number resolved against the active board's project. */
const KEY = /^([a-z][a-z0-9_]+)-(\d+)$/i
const NUMBER = /^\d+$/

/**
 * JQL-ish: a field followed by an operator, or a joining keyword. Deliberately
 * conservative — a false positive sends prose to Jira as a query, which errors, while
 * a false negative just searches the text of something that was meant as JQL.
 */
const JQL = /(^|\s)(=|!=|~|>=|<=|>|<|\bin\b|\bis\b)(\s|$)|\b(AND|OR|NOT|ORDER BY)\b/i

export interface SearchScope {
  /** A JQL fragment the search starts inside, e.g. a team filter. */
  jql: string
  /** What to call it in the prompt. */
  label: string
}

export interface SearchQuery {
  jql: string
  /** How the input was read, for the prompt's hint line. */
  kind: "key" | "jql" | "text"
  /** Field values that resolved to nothing, so the prompt can say so (specs/048). */
  unresolved?: string[]
}

export interface TranslateContext {
  /** The loaded board: statuses resolve through its columns, people through its issues. */
  board?: Board
  /** Display name behind `@me`. */
  currentUser?: string
  /** The instance's epic-link field — `parent`, or a custom field id (specs/034). */
  epicField?: string
}

/**
 * Build the query to run. A leading `?` forces the words reading, for the rare search
 * whose text looks like a query ("status = broken").
 */
export function buildSearchQuery(
  input: string,
  options: { scope?: SearchScope | null; project?: string } & TranslateContext = {},
): SearchQuery | null {
  const forcedText = input.startsWith("?")
  // Keep the untrimmed form: a trailing space is what says "this word is finished".
  const typed = forcedText ? input.slice(1) : input
  const raw = typed.trim()
  if (raw === "") {
    return null
  }

  const key = keyFor(raw, options.project)
  if (!forcedText && key) {
    // A key is an exact address, so the scope must not narrow it away: looking up an
    // issue from another team is exactly when you know its key.
    return { jql: `key = ${key}`, kind: "key" }
  }

  const isJql = !forcedText && JQL.test(raw)
  const grammar = isJql ? null : translate(parseQuery(typed), typed, options)
  // An input that is nothing but an in-progress field token (`epic:`) parses to no
  // clauses at all — there is no query yet, so don't send an empty one. A query whose
  // every term was *dropped* is different: it still has to report why.
  if (grammar && grammar.jql === "") {
    return grammar.unresolved.length > 0
      ? { jql: "", kind: "text", unresolved: grammar.unresolved }
      : null
  }
  const body = isJql ? raw : grammar!.jql
  const kind = isJql ? "jql" : "text"
  const scoped = options.scope?.jql ? `(${options.scope.jql}) AND (${body})` : body
  return {
    jql: `${scoped} ORDER BY updated DESC`,
    kind,
    ...(grammar?.unresolved.length ? { unresolved: grammar.unresolved } : {}),
  }
}

// ---- the filter grammar as JQL (specs/048) ---------------------------------

const FIELDS: FilterField[] = ["type", "assignee", "status", "priority", "label", "epic"]

/**
 * The parsed filter as a JQL `AND` of per-field clauses — repeated values `OR` within a
 * field and fields `AND` across, which is exactly how `/` reads the same query, so one
 * input means one thing in both prompts.
 */
function translate(
  parsed: ParsedQuery,
  typed: string,
  ctx: TranslateContext,
): { jql: string; unresolved: string[] } {
  const unresolved: string[] = []
  const clauses: string[] = []

  for (const field of FIELDS) {
    const positive = clauseFor(field, parsed.fields[field], ctx, unresolved)
    if (positive) {
      clauses.push(positive)
    }
    const negative = clauseFor(field, parsed.negFields[field], ctx, unresolved)
    if (negative) {
      // `NOT (labels = UX)`, not `labels != UX`: the latter is false for an issue that
      // carries UX *and* something else, which is not what `-#UX` means.
      clauses.push(`NOT (${negative})`)
    }
  }

  // Free text keeps specs/046's prefix wildcard, but only the word still being typed —
  // and only when the caret is actually in it, which `parseQuery` has already stripped
  // the field tokens out of.
  if (parsed.text !== "") {
    clauses.push(`text ~ ${quote(prefixLastWord(textAsTyped(parsed.text, typed)))}`)
  }
  return { jql: clauses.length > 0 ? clauses.join(" AND ") : "", unresolved }
}

/**
 * `parseQuery` trims the input, which would swallow the trailing space that says "this
 * word is finished" (specs/046). Put it back when the text ran to the end of the input.
 */
function textAsTyped(text: string, typed: string): string {
  return /\s$/.test(typed) && typed.trimEnd().endsWith(text) ? `${text} ` : text
}

function clauseFor(
  field: FilterField,
  values: string[],
  ctx: TranslateContext,
  unresolved: string[],
): string | null {
  const terms = values
    .map((value) => term(field, value, ctx, unresolved))
    .filter((t): t is string => t !== null)
  if (terms.length === 0) {
    return null
  }
  return terms.length === 1 ? terms[0]! : `(${terms.join(" OR ")})`
}

function term(
  field: FilterField,
  value: string,
  ctx: TranslateContext,
  unresolved: string[],
): string | null {
  switch (field) {
    case "type":
      return typeTerm(value)
    case "priority":
      return `priority = ${quote(capitalize(value))}`
    case "status":
      return `status = ${quote(resolveStatus(value, ctx))}`
    case "label":
      return value.toLowerCase() === "none" ? "labels is EMPTY" : `labels = ${quote(value)}`
    case "epic":
      return epicTerm(value, ctx)
    case "assignee":
      return assigneeTerm(value, ctx, unresolved)
  }
}

/**
 * Sub-tasks go through `subTaskIssueTypes()` rather than a literal name: the name is
 * localised and differs per instance ("Sub-task", "Subtask", …), the function does not.
 */
function typeTerm(value: string): string {
  const name = value.toLowerCase()
  return name.startsWith("sub")
    ? "issuetype in subTaskIssueTypes()"
    : `issuetype = ${quote(capitalize(value))}`
}

function epicTerm(value: string, ctx: TranslateContext): string {
  const field = ctx.epicField ?? "parent"
  const clause = field === "parent" ? "parent" : `"${field}"`
  if (["none", "no"].includes(value.toLowerCase())) {
    return `${clause} is EMPTY`
  }
  // An `epic:` value can be the epic's *name* in `/`, which matches locally; JQL needs
  // the key, so look the name up among the loaded epics before giving up on it.
  return `${clause} = ${quote(epicKeyFor(value, ctx) ?? value)}`
}

function epicKeyFor(value: string, ctx: TranslateContext): string | null {
  if (/^[a-z][a-z0-9_]+-\d+$/i.test(value)) {
    return value.toUpperCase()
  }
  // `/` matches an `epic:` value as a substring of either the key or the name, so a bare
  // number or a word both work there. JQL needs the whole key, so look it up the same way.
  const v = value.toLowerCase()
  const hit = ctx.board?.tasks.find(
    (t) =>
      !!t.epicKey &&
      (t.epicKey.toLowerCase().includes(v) || !!t.epicName?.toLowerCase().includes(v)),
  )
  return hit?.epicKey ?? null
}

/**
 * Jira's JQL takes an account id, never a display name, so a named person is resolved
 * through the ids the loaded board already carries (specs/027). One that resolves to
 * nobody is reported rather than guessed at — a wrong assignee silently returns the
 * wrong issues.
 */
function assigneeTerm(value: string, ctx: TranslateContext, unresolved: string[]): string | null {
  const v = value.toLowerCase()
  if (v === "me") {
    return "assignee = currentUser()"
  }
  if (v === "none" || v === "unassigned") {
    return "assignee is EMPTY"
  }
  const match = ctx.board?.tasks.find((t) => t.assigneeId && t.assignee?.toLowerCase().includes(v))
  if (!match?.assigneeId) {
    unresolved.push(`@${value}`)
    return null
  }
  return `assignee = ${quote(match.assigneeId)}`
}

/** Resolve a status shorthand through the board's columns, as `/` prefix-matches them. */
function resolveStatus(value: string, ctx: TranslateContext): string {
  const v = value.toLowerCase()
  const column = ctx.board?.columns.find((c) => c.title.toLowerCase().includes(v))
  return column?.title ?? value
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

/**
 * Wildcard the word being typed, so searching as you type actually finds anything.
 *
 * Jira's `text ~` matches whole words: measured against SHOP, `"trav"` returns nothing
 * while `"trav*"` returns twelve. Without this a search reads "0 found" for every
 * keystroke until a word happens to end — which says "not in Jira" when it means
 * "still typing". A trailing space, or a wildcard you typed yourself, means the word
 * is finished and is left alone.
 */
function prefixLastWord(input: string): string {
  if (/[\s*"]$/.test(input)) {
    return input.trim()
  }
  const words = input.split(/\s+/)
  const last = words[words.length - 1]!
  return last.includes("*") ? input : `${input}*`
}

function keyFor(input: string, project?: string): string | null {
  if (KEY.test(input)) {
    return input.toUpperCase()
  }
  return NUMBER.test(input) && project ? `${project}-${input}` : null
}

/** A JQL string literal: quote it, escaping what would end the literal. */
function quote(text: string): string {
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}
