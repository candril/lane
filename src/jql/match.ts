/**
 * A small JQL evaluator for query-based swimlanes (specs/016). It handles the
 * subset board swimlanes actually use — `labels`/`priority`/`assignee`/`type`/
 * `status`/`sprint` with `= != ~ IN "NOT IN" "IS [NOT] EMPTY"`, combined with AND/OR/NOT
 * and parentheses. Enough for predicates like `labels not in (UX, PO) OR labels
 * is EMPTY`; anything outside the subset evaluates to no-match rather than
 * throwing. This is deliberately not a full JQL engine (the server owns that).
 */

import type { Column, Task } from "../types"

export interface JqlContext {
  columns: Column[]
  /** Resolves `currentUser()` / `assignee = me`. */
  currentUser?: string
}

type Node =
  | { t: "true" }
  | { t: "or"; l: Node; r: Node }
  | { t: "and"; l: Node; r: Node }
  | { t: "not"; n: Node }
  | { t: "cmp"; field: string; op: string; values: string[] }
  | { t: "empty"; field: string; negated: boolean }

function tokenize(jql: string): string[] {
  // `name(...)` (a function call with no space before `(`) is one token, so
  // `currentUser()` / `openSprints()` survive; `in (a, b)` (with a space) does not.
  return jql.match(/"[^"]*"|[A-Za-z_]+\([^)]*\)|!=|[()=,~]|[^\s()=,~]+/g) ?? []
}

function unquote(token: string): string {
  return token.startsWith('"') && token.endsWith('"') ? token.slice(1, -1) : token
}

class Parser {
  private i = 0
  constructor(private readonly toks: string[]) {}

  private peek(): string | undefined {
    return this.toks[this.i]
  }
  private next(): string | undefined {
    return this.toks[this.i++]
  }
  private is(word: string): boolean {
    return this.peek()?.toLowerCase() === word
  }

  parse(): Node {
    if (this.i >= this.toks.length) {
      return { t: "true" }
    }
    return this.parseOr()
  }

  private parseOr(): Node {
    let left = this.parseAnd()
    while (this.is("or")) {
      this.next()
      left = { t: "or", l: left, r: this.parseAnd() }
    }
    return left
  }

  private parseAnd(): Node {
    let left = this.parseNot()
    while (this.is("and")) {
      this.next()
      left = { t: "and", l: left, r: this.parseNot() }
    }
    return left
  }

  private parseNot(): Node {
    if (this.is("not")) {
      this.next()
      return { t: "not", n: this.parseNot() }
    }
    return this.parsePrimary()
  }

  private parsePrimary(): Node {
    if (this.peek() === "(") {
      this.next()
      const inner = this.parseOr()
      if (this.peek() === ")") {
        this.next()
      }
      return inner
    }
    return this.parseComparison()
  }

  private parseComparison(): Node {
    const field = (this.next() ?? "").toLowerCase()
    if (this.is("is")) {
      this.next()
      let negated = false
      if (this.is("not")) {
        this.next()
        negated = true
      }
      this.next() // consume EMPTY / NULL
      return { t: "empty", field, negated }
    }
    let op = (this.next() ?? "").toLowerCase()
    if (op === "not" && this.is("in")) {
      this.next()
      op = "not in"
    }
    return { t: "cmp", field, op, values: this.parseValues() }
  }

  private parseValues(): string[] {
    if (this.peek() !== "(") {
      return [unquote(this.next() ?? "")]
    }
    this.next()
    const values: string[] = []
    while (this.peek() !== undefined && this.peek() !== ")") {
      const token = this.next()!
      if (token !== ",") {
        values.push(unquote(token))
      }
    }
    if (this.peek() === ")") {
      this.next()
    }
    return values
  }
}

function scalarField(task: Task, field: string, ctx: JqlContext): string | undefined {
  switch (field) {
    case "priority":
      return task.priority
    case "assignee":
      return task.assignee
    case "type":
    case "issuetype":
      return task.type
    case "status":
      return ctx.columns.find((c) => c.id === task.columnId)?.title
    case "summary":
      return task.summary
    case "sprint":
      return task.sprint?.name
    default:
      return undefined
  }
}

function resolve(value: string, ctx: JqlContext): string {
  const v = value.toLowerCase()
  return v === "currentuser()" || v === "me" ? (ctx.currentUser ?? "") : value
}

const isEmptyKeyword = (value: string) => {
  const v = value.toLowerCase()
  return v === "empty" || v === "null"
}

function evaluate(node: Node, task: Task, ctx: JqlContext): boolean {
  switch (node.t) {
    case "true":
      return true
    case "or":
      return evaluate(node.l, task, ctx) || evaluate(node.r, task, ctx)
    case "and":
      return evaluate(node.l, task, ctx) && evaluate(node.r, task, ctx)
    case "not":
      return !evaluate(node.n, task, ctx)
    case "empty": {
      if (node.field === "labels") {
        const empty = (task.labels ?? []).length === 0
        return node.negated ? !empty : empty
      }
      const empty = !scalarField(task, node.field, ctx)
      return node.negated ? !empty : empty
    }
    case "cmp": {
      const values = node.values.map((v) => resolve(v, ctx).toLowerCase())
      if (node.field === "labels") {
        const labels = (task.labels ?? []).map((l) => l.toLowerCase())
        switch (node.op) {
          case "in":
            return labels.some((l) => values.includes(l))
          case "not in":
            return !labels.some((l) => values.includes(l))
          case "=":
            return labels.includes(values[0] ?? "")
          case "!=":
            return !labels.includes(values[0] ?? "")
          case "~":
            return labels.some((l) => l.includes(values[0] ?? ""))
          default:
            return false
        }
      }
      // `sprint` compares against the sprint's name, but also answers the two functions
      // a real query uses to name a sprint it can't spell — `openSprints()` matches the
      // active sprint, `futureSprints()` an upcoming one (specs/050).
      if (node.field === "sprint") {
        const sprint = task.sprint
        const hit = values.some((v) =>
          v === "opensprints()"
            ? sprint?.state === "active"
            : v === "futuresprints()"
              ? sprint?.state === "future"
              : v === sprint?.name.toLowerCase(),
        )
        return node.op === "!=" || node.op === "not in" ? !hit : hit
      }
      const scalar = scalarField(task, node.field, ctx)?.toLowerCase()
      // `= EMPTY` / `!= EMPTY` read as emptiness checks.
      if (node.values.length === 1 && isEmptyKeyword(node.values[0]!)) {
        return node.op === "!=" ? !!scalar : !scalar
      }
      if (scalar === undefined) {
        return false
      }
      switch (node.op) {
        case "=":
          return scalar === values[0]
        case "!=":
          return scalar !== values[0]
        case "~":
          return scalar.includes(values[0] ?? "")
        case "in":
          return values.includes(scalar)
        case "not in":
          return !values.includes(scalar)
        default:
          return false
      }
    }
  }
}

/** Does `task` satisfy `jql`? An empty query matches everything (catch-all lane). */
export function matchesJql(task: Task, jql: string, ctx: JqlContext): boolean {
  if (jql.trim() === "") {
    return true
  }
  return evaluate(new Parser(tokenize(jql)).parse(), task, ctx)
}
