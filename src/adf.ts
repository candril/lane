/**
 * Atlassian Document Format → Markdown (specs/007).
 *
 * Jira's v3 API carries `description` as ADF — a JSON document tree. The v2 API's
 * wiki markup isn't Markdown either (`h1.` not `#`, `*bold*` not `**bold**`, `#`
 * meaning *ordered list*), so there is no shape Jira hands back that a Markdown
 * renderer can take as-is. Rather than pick the wrong one, lane converts.
 *
 * Alongside the Markdown, the conversion reports the node and mark types it could
 * *not* faithfully represent. Nothing here uses that — the viewer renders what it
 * can either way — but editing does (specs/049): a description carrying an
 * un-representable node can't survive the round trip, so it is refused rather than
 * silently flattened on save.
 */

import { marked, type Tokens } from "marked"

export interface AdfMark {
  type?: string
  attrs?: Record<string, unknown>
}

export interface AdfNode {
  type?: string
  text?: string
  content?: AdfNode[]
  marks?: AdfMark[]
  attrs?: Record<string, unknown>
  /** Only the root `doc` carries this; Jira rejects a document without it. */
  version?: number
}

export interface AdfConversion {
  markdown: string
  /** Node/mark types the converter could not represent, deduped, in encounter order. */
  unsupported: string[]
}

/** Marks that survive a Markdown round trip; anything else degrades to bare text. */
const INLINE_MARKS = new Set(["strong", "em", "code", "strike", "link"])

function attrString(node: AdfNode, name: string): string | undefined {
  const value = node.attrs?.[name]
  return typeof value === "string" ? value : undefined
}

function attrNumber(node: AdfNode, name: string): number | undefined {
  const value = node.attrs?.[name]
  return typeof value === "number" ? value : undefined
}

/**
 * Convert an ADF document to Markdown. Accepts a plain string too — a v2 payload,
 * or a description Jira has already flattened — and passes it through untouched.
 */
export function adfToMarkdown(doc: unknown): AdfConversion {
  if (typeof doc === "string") {
    return { markdown: doc, unsupported: [] }
  }
  if (!doc || typeof doc !== "object") {
    return { markdown: "", unsupported: [] }
  }

  const unsupported = new Set<string>()

  function inline(nodes: AdfNode[] | undefined): string {
    return (nodes ?? []).map(inlineNode).join("")
  }

  function inlineNode(node: AdfNode): string {
    switch (node.type) {
      case "text":
        return withMarks(node.text ?? "", node.marks)
      case "hardBreak":
        // Two trailing spaces is Markdown's line break within a paragraph.
        return "  \n"
      case "mention":
        return attrString(node, "text") ?? `@${attrString(node, "id") ?? "unknown"}`
      case "emoji":
        return attrString(node, "text") ?? attrString(node, "shortName") ?? ""
      case "date": {
        const timestamp = Number(attrString(node, "timestamp") ?? "")
        return Number.isFinite(timestamp) && timestamp > 0
          ? new Date(timestamp).toISOString().slice(0, 10)
          : ""
      }
      case "status":
        return `\`${attrString(node, "text") ?? ""}\``
      case "inlineCard":
      case "blockCard": {
        const url = attrString(node, "url")
        return url ? `<${url}>` : ""
      }
      default:
        if (node.type) {
          unsupported.add(node.type)
        }
        // Still show whatever text it carries — the viewer reads better with a
        // degraded node than with a hole where one was.
        return node.text ?? inline(node.content)
    }
  }

  /** Wrap `text` in the Markdown syntax for each mark it carries. */
  function withMarks(text: string, marks: AdfMark[] | undefined): string {
    if (!marks?.length) {
      return text
    }
    let out = text
    for (const mark of marks) {
      if (mark.type && !INLINE_MARKS.has(mark.type)) {
        unsupported.add(mark.type)
        continue
      }
      switch (mark.type) {
        case "strong":
          out = `**${out}**`
          break
        case "em":
          out = `*${out}*`
          break
        case "code":
          out = `\`${out}\``
          break
        case "strike":
          out = `~~${out}~~`
          break
        case "link": {
          const href = typeof mark.attrs?.href === "string" ? mark.attrs.href : ""
          out = href ? `[${out}](${href})` : out
          break
        }
      }
    }
    return out
  }

  /** Prefix every line of `text`, so nested and quoted blocks keep their shape. */
  function indent(text: string, prefix: string, firstPrefix = prefix): string {
    return text
      .split("\n")
      .map((line, i) => (line === "" ? line.trimEnd() : `${i === 0 ? firstPrefix : prefix}${line}`))
      .join("\n")
  }

  function list(node: AdfNode, ordered: boolean): string {
    const start = ordered ? (attrNumber(node, "order") ?? 1) : 0
    return (node.content ?? [])
      .map((item, i) => {
        const bullet = ordered ? `${start + i}. ` : "- "
        return indent(blocks(item.content, "\n"), " ".repeat(bullet.length), bullet)
      })
      .join("\n")
  }

  function taskList(node: AdfNode): string {
    return (node.content ?? [])
      .map((item) => {
        const box = attrString(item, "state") === "DONE" ? "[x]" : "[ ]"
        return indent(inline(item.content), "  ", `- ${box} `)
      })
      .join("\n")
  }

  function table(node: AdfNode): string {
    const rows = (node.content ?? []).map((row) =>
      (row.content ?? []).map((cell) =>
        // A cell holds blocks; flatten them onto one line — a pipe table has no
        // room for a paragraph break, and a literal pipe would split the row.
        blocks(cell.content, " ").replace(/\n+/g, " ").replace(/\|/g, "\\|").trim(),
      ),
    )
    if (rows.length === 0) {
      return ""
    }
    const width = Math.max(...rows.map((r) => r.length))
    const pad = (cells: string[]) =>
      `| ${[...cells, ...Array(width - cells.length).fill("")].join(" | ")} |`
    const isHeader = (node.content?.[0]?.content ?? []).every((c) => c.type === "tableHeader")
    // A Markdown table must have a header row; a body-only ADF table gets an empty one.
    const header = isHeader ? pad(rows[0]!) : pad(Array(width).fill(""))
    const body = (isHeader ? rows.slice(1) : rows).map(pad)
    return [header, `|${" --- |".repeat(width)}`, ...body].join("\n")
  }

  function blockNode(node: AdfNode): string {
    switch (node.type) {
      case "paragraph":
        return inline(node.content)
      case "heading": {
        const level = Math.min(6, Math.max(1, attrNumber(node, "level") ?? 1))
        return `${"#".repeat(level)} ${inline(node.content)}`
      }
      case "bulletList":
        return list(node, false)
      case "orderedList":
        return list(node, true)
      case "taskList":
        return taskList(node)
      case "codeBlock":
        return `\`\`\`${attrString(node, "language") ?? ""}\n${inline(node.content)}\n\`\`\``
      case "blockquote":
        return indent(blocks(node.content, "\n\n"), "> ")
      case "rule":
        return "---"
      case "table":
        return table(node)
      case "mediaSingle":
      case "mediaGroup":
      case "mediaInline":
      case "media": {
        unsupported.add(node.type)
        const name =
          attrString(node, "alt") ??
          (node.content ?? []).map((c) => attrString(c, "alt")).find(Boolean) ??
          "attachment"
        return `\`[media: ${name}]\``
      }
      case "panel":
        unsupported.add(node.type)
        return indent(blocks(node.content, "\n\n"), "> ", `> **${panelLabel(node)}** `)
      case "expand":
      case "nestedExpand":
        unsupported.add(node.type)
        return [`**${attrString(node, "title") ?? "Details"}**`, blocks(node.content, "\n\n")]
          .filter(Boolean)
          .join("\n\n")
      case "decisionList":
        return (node.content ?? []).map((item) => `- ${inline(item.content)}`).join("\n")
      default:
        if (node.type) {
          unsupported.add(node.type)
        }
        return node.content ? blocks(node.content, "\n\n") : (node.text ?? "")
    }
  }

  function blocks(nodes: AdfNode[] | undefined, separator: string): string {
    return (nodes ?? [])
      .map(blockNode)
      .filter((block) => block !== "")
      .join(separator)
  }

  const markdown = blocks((doc as AdfNode).content, "\n\n").replace(/[ \t]+$/gm, (match) =>
    // Keep Markdown's two-space hard break; strip every other trailing run.
    match === "  " ? match : "",
  )
  return { markdown: markdown.trim(), unsupported: [...unsupported] }
}

function panelLabel(node: AdfNode): string {
  const type = attrString(node, "panelType") ?? "info"
  return type.charAt(0).toUpperCase() + type.slice(1)
}

/**
 * Markdown → ADF (specs/049), the inverse of {@link adfToMarkdown} over the node set
 * that function emits.
 *
 * Parsed with `marked` — the same parser the viewer's Markdown renderer uses, so what
 * was on screen and what gets written to Jira agree by construction rather than by two
 * hand-rolled grammars happening to match.
 */
export function markdownToAdf(markdown: string): AdfNode {
  return { type: "doc", version: 1, content: blocksFromTokens(marked.lexer(markdown)) }
}

type MarkedToken = Tokens.Generic & { tokens?: Tokens.Generic[] }

function blocksFromTokens(tokens: MarkedToken[]): AdfNode[] {
  return tokens.flatMap(blockFromToken)
}

function blockFromToken(token: MarkedToken): AdfNode[] {
  switch (token.type) {
    case "space":
      return []
    case "heading":
      return [
        {
          type: "heading",
          attrs: { level: Math.min(6, Math.max(1, Number(token.depth) || 1)) },
          content: inlineFromTokens(token.tokens ?? [], []),
        },
      ]
    case "paragraph":
    case "text":
      return [{ type: "paragraph", content: inlineFromTokens(token.tokens ?? [], []) }]
    case "code": {
      const text = String(token.text ?? "")
      const lang = typeof token.lang === "string" && token.lang ? { language: token.lang } : {}
      return [
        {
          type: "codeBlock",
          attrs: lang,
          // ADF rejects an empty text node, so an empty fence carries no content at all.
          content: text ? [{ type: "text", text }] : [],
        },
      ]
    }
    case "hr":
      return [{ type: "rule" }]
    case "blockquote":
      return [{ type: "blockquote", content: blocksFromTokens(token.tokens ?? []) }]
    case "list":
      return [listFromToken(token)]
    case "table":
      return [tableFromToken(token)]
    case "html":
      // Raw HTML has no ADF equivalent; keep it as literal text rather than dropping
      // what the author wrote.
      return [{ type: "paragraph", content: textNodes(String(token.text ?? ""), []) }]
    default:
      return token.tokens ? blocksFromTokens(token.tokens) : []
  }
}

function listFromToken(token: MarkedToken): AdfNode {
  const items = (token.items ?? []) as MarkedToken[]
  if (items.length > 0 && items.every((item) => item.task)) {
    return {
      type: "taskList",
      attrs: { localId: "" },
      content: items.map((item) => ({
        type: "taskItem",
        attrs: { localId: "", state: item.checked ? "DONE" : "TODO" },
        // A task item holds inline content, not blocks — unwrap the paragraph marked
        // wraps it in.
        content: inlineOfItem(item),
      })),
    }
  }
  const ordered = !!token.ordered
  return {
    type: ordered ? "orderedList" : "bulletList",
    attrs: ordered ? { order: Number(token.start) || 1 } : undefined,
    content: items.map((item) => ({
      type: "listItem",
      content: blocksFromTokens(item.tokens ?? []),
    })),
  }
}

/** A list item's own text, without the block wrapper — what a task item wants. */
function inlineOfItem(item: MarkedToken): AdfNode[] {
  const blocks = blocksFromTokens(item.tokens ?? [])
  return blocks.flatMap((block) => block.content ?? [])
}

function tableFromToken(token: MarkedToken): AdfNode {
  const header = (token.header ?? []) as MarkedToken[]
  const rows = (token.rows ?? []) as MarkedToken[][]
  const cell = (type: string) => (c: MarkedToken) => ({
    type,
    content: [{ type: "paragraph", content: inlineFromTokens(c.tokens ?? [], []) }],
  })
  const headerRow = header.length
    ? [{ type: "tableRow", content: header.map(cell("tableHeader")) }]
    : []
  return {
    type: "table",
    content: [
      ...headerRow,
      ...rows.map((row) => ({ type: "tableRow", content: row.map(cell("tableCell")) })),
    ],
  }
}

function inlineFromTokens(tokens: MarkedToken[], marks: AdfMark[]): AdfNode[] {
  return tokens.flatMap((token) => inlineFromToken(token, marks))
}

function inlineFromToken(token: MarkedToken, marks: AdfMark[]): AdfNode[] {
  switch (token.type) {
    case "text":
    case "escape":
      return token.tokens
        ? inlineFromTokens(token.tokens, marks)
        : textNodes(String(token.text ?? ""), marks)
    case "strong":
      return inlineFromTokens(token.tokens ?? [], [...marks, { type: "strong" }])
    case "em":
      return inlineFromTokens(token.tokens ?? [], [...marks, { type: "em" }])
    case "del":
      return inlineFromTokens(token.tokens ?? [], [...marks, { type: "strike" }])
    case "codespan":
      return textNodes(String(token.text ?? ""), [...marks, { type: "code" }])
    case "link": {
      const href = String(token.href ?? "")
      const linked = href ? [...marks, { type: "link", attrs: { href } }] : marks
      return token.tokens?.length
        ? inlineFromTokens(token.tokens, linked)
        : textNodes(String(token.text ?? href), linked)
    }
    case "image":
      // ADF media needs an uploaded attachment id, which lane has no way to mint —
      // so an image survives as its link text rather than as a broken media node.
      return textNodes(String(token.text || token.href || ""), marks)
    case "br":
      return [{ type: "hardBreak" }]
    default:
      return token.tokens
        ? inlineFromTokens(token.tokens, marks)
        : textNodes(String(token.text ?? ""), marks)
  }
}

/** ADF rejects an empty text node, so an empty run produces nothing at all. */
function textNodes(text: string, marks: AdfMark[]): AdfNode[] {
  if (text === "") {
    return []
  }
  return [{ type: "text", text, ...(marks.length ? { marks } : {}) }]
}
