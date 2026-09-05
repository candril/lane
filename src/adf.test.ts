import { describe, expect, test } from "bun:test"
import { adfToMarkdown, markdownToAdf, type AdfNode } from "./adf"

function doc(...content: AdfNode[]): AdfNode {
  return { type: "doc", version: 1, content }
}

function para(...content: AdfNode[]): AdfNode {
  return { type: "paragraph", content }
}

function text(value: string, marks?: AdfNode["marks"]): AdfNode {
  return { type: "text", text: value, marks }
}

function md(node: unknown): string {
  return adfToMarkdown(node).markdown
}

describe("adfToMarkdown", () => {
  test("passes a plain string through — a v2 payload needs no conversion", () => {
    expect(adfToMarkdown("already text")).toEqual({ markdown: "already text", unsupported: [] })
  })

  test("returns empty for a missing or malformed description", () => {
    expect(md(null)).toBe("")
    expect(md(undefined)).toBe("")
    expect(md({ type: "doc" })).toBe("")
  })

  test("separates blocks with a blank line", () => {
    expect(md(doc(para(text("one")), para(text("two"))))).toBe("one\n\ntwo")
  })

  test("renders headings at their level, clamped to six", () => {
    expect(md(doc({ type: "heading", attrs: { level: 2 }, content: [text("Title")] }))).toBe(
      "## Title",
    )
    expect(md(doc({ type: "heading", attrs: { level: 9 }, content: [text("Deep")] }))).toBe(
      "###### Deep",
    )
  })

  test("applies inline marks, nesting outward", () => {
    expect(md(doc(para(text("bold", [{ type: "strong" }]))))).toBe("**bold**")
    expect(md(doc(para(text("both", [{ type: "em" }, { type: "strong" }]))))).toBe("***both***")
    expect(md(doc(para(text("gone", [{ type: "strike" }]))))).toBe("~~gone~~")
    expect(md(doc(para(text("x()", [{ type: "code" }]))))).toBe("`x()`")
  })

  test("renders a link as [text](href), and drops it when the href is missing", () => {
    const href = [{ type: "link", attrs: { href: "https://example.com" } }]
    expect(md(doc(para(text("here", href))))).toBe("[here](https://example.com)")
    expect(md(doc(para(text("here", [{ type: "link" }]))))).toBe("here")
  })

  test("keeps a hard break as Markdown's two-space line break", () => {
    expect(md(doc(para(text("a"), { type: "hardBreak" }, text("b"))))).toBe("a  \nb")
  })

  test("renders bullet and ordered lists, honouring the start order", () => {
    const items = [
      { type: "listItem", content: [para(text("one"))] },
      { type: "listItem", content: [para(text("two"))] },
    ]
    expect(md(doc({ type: "bulletList", content: items }))).toBe("- one\n- two")
    expect(md(doc({ type: "orderedList", attrs: { order: 3 }, content: items }))).toBe(
      "3. one\n4. two",
    )
  })

  test("indents a nested list under its parent item", () => {
    const nested = doc({
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            para(text("outer")),
            { type: "bulletList", content: [{ type: "listItem", content: [para(text("inner"))] }] },
          ],
        },
      ],
    })
    expect(md(nested)).toBe("- outer\n  - inner")
  })

  test("renders a task list as checkboxes", () => {
    const tasks = doc({
      type: "taskList",
      content: [
        { type: "taskItem", attrs: { state: "DONE" }, content: [text("shipped")] },
        { type: "taskItem", attrs: { state: "TODO" }, content: [text("pending")] },
      ],
    })
    expect(md(tasks)).toBe("- [x] shipped\n- [ ] pending")
  })

  test("fences a code block with its language", () => {
    const code = doc({
      type: "codeBlock",
      attrs: { language: "typescript" },
      content: [text("const a = 1")],
    })
    expect(md(code)).toBe("```typescript\nconst a = 1\n```")
  })

  test("prefixes every line of a blockquote", () => {
    const quote = doc({ type: "blockquote", content: [para(text("first")), para(text("second"))] })
    expect(md(quote)).toBe("> first\n\n> second")
  })

  test("renders a rule", () => {
    expect(md(doc({ type: "rule" }))).toBe("---")
  })

  test("renders a table with a header row", () => {
    const table = doc({
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            { type: "tableHeader", content: [para(text("Key"))] },
            { type: "tableHeader", content: [para(text("Value"))] },
          ],
        },
        {
          type: "tableRow",
          content: [
            { type: "tableCell", content: [para(text("a"))] },
            { type: "tableCell", content: [para(text("1"))] },
          ],
        },
      ],
    })
    expect(md(table)).toBe("| Key | Value |\n| --- | --- |\n| a | 1 |")
  })

  test("gives a header-less table an empty header, since Markdown requires one", () => {
    const table = doc({
      type: "table",
      content: [
        { type: "tableRow", content: [{ type: "tableCell", content: [para(text("only"))] }] },
      ],
    })
    expect(md(table)).toBe("|  |\n| --- |\n| only |")
  })

  test("escapes a pipe inside a cell so it can't split the row", () => {
    const table = doc({
      type: "table",
      content: [
        { type: "tableRow", content: [{ type: "tableCell", content: [para(text("a|b"))] }] },
      ],
    })
    expect(md(table)).toContain("| a\\|b |")
  })

  test("renders a mention, an emoji and a status inline", () => {
    const inline = doc(
      para(
        { type: "mention", attrs: { text: "@Grace", id: "abc" } },
        text(" "),
        { type: "emoji", attrs: { shortName: ":tada:", text: "🎉" } },
        text(" "),
        { type: "status", attrs: { text: "DONE" } },
      ),
    )
    expect(md(inline)).toBe("@Grace 🎉 `DONE`")
  })

  test("falls back to the mention id when it carries no display text", () => {
    expect(md(doc(para({ type: "mention", attrs: { id: "abc" } })))).toBe("@abc")
  })

  test("renders a date as an ISO day", () => {
    const when = Date.UTC(2026, 7, 12)
    expect(md(doc(para({ type: "date", attrs: { timestamp: String(when) } })))).toBe("2026-08-12")
  })

  test("renders an inline card as an autolink", () => {
    expect(md(doc(para({ type: "inlineCard", attrs: { url: "https://x.test" } })))).toBe(
      "<https://x.test>",
    )
  })

  test("reports media as unsupported but still shows a placeholder", () => {
    const media = doc({
      type: "mediaSingle",
      content: [{ type: "media", attrs: { alt: "screenshot.png" } }],
    })
    const { markdown, unsupported } = adfToMarkdown(media)
    expect(markdown).toBe("`[media: screenshot.png]`")
    expect(unsupported).toContain("mediaSingle")
  })

  test("reports a panel as unsupported but renders it as a labelled quote", () => {
    const panel = doc({
      type: "panel",
      attrs: { panelType: "warning" },
      content: [para(text("careful"))],
    })
    const { markdown, unsupported } = adfToMarkdown(panel)
    expect(markdown).toBe("> **Warning** careful")
    expect(unsupported).toEqual(["panel"])
  })

  test("reports an expand as unsupported but keeps its title and body", () => {
    const expand = doc({
      type: "expand",
      attrs: { title: "Notes" },
      content: [para(text("hidden"))],
    })
    const { markdown, unsupported } = adfToMarkdown(expand)
    expect(markdown).toBe("**Notes**\n\nhidden")
    expect(unsupported).toEqual(["expand"])
  })

  test("reports an unrepresentable mark but keeps the text", () => {
    const colored = doc(para(text("loud", [{ type: "textColor", attrs: { color: "#ff0000" } }])))
    const { markdown, unsupported } = adfToMarkdown(colored)
    expect(markdown).toBe("loud")
    expect(unsupported).toEqual(["textColor"])
  })

  test("reports an unknown node once, however often it appears", () => {
    const weird = doc({ type: "somethingNew" }, { type: "somethingNew" })
    expect(adfToMarkdown(weird).unsupported).toEqual(["somethingNew"])
  })

  test("leaves nothing unsupported for a document of ordinary blocks", () => {
    const ordinary = doc(
      { type: "heading", attrs: { level: 1 }, content: [text("Title")] },
      para(text("Body with "), text("bold", [{ type: "strong" }])),
      { type: "bulletList", content: [{ type: "listItem", content: [para(text("point"))] }] },
      { type: "codeBlock", content: [text("code")] },
      { type: "rule" },
    )
    expect(adfToMarkdown(ordinary).unsupported).toEqual([])
  })

  test("drops empty blocks rather than leaving blank gaps", () => {
    expect(md(doc(para(), para(text("real")), para()))).toBe("real")
  })
})

describe("markdownToAdf", () => {
  function content(markdown: string): AdfNode[] {
    return markdownToAdf(markdown).content ?? []
  }

  test("wraps the blocks in a versioned doc — Jira rejects one without", () => {
    const converted = markdownToAdf("hello")
    expect(converted.type).toBe("doc")
    expect(converted.version).toBe(1)
  })

  test("converts a paragraph", () => {
    expect(content("hello there")).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "hello there" }] },
    ])
  })

  test("converts a heading at its level", () => {
    expect(content("### Deep")).toEqual([
      { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Deep" }] },
    ])
  })

  test("puts inline marks on the text node", () => {
    expect(content("**bold**")).toEqual([
      {
        type: "paragraph",
        content: [{ type: "text", text: "bold", marks: [{ type: "strong" }] }],
      },
    ])
    expect(content("`code()`")[0]!.content).toEqual([
      { type: "text", text: "code()", marks: [{ type: "code" }] },
    ])
    expect(content("~~gone~~")[0]!.content).toEqual([
      { type: "text", text: "gone", marks: [{ type: "strike" }] },
    ])
  })

  test("nests marks rather than nesting nodes", () => {
    expect(content("***both***")[0]!.content).toEqual([
      { type: "text", text: "both", marks: [{ type: "em" }, { type: "strong" }] },
    ])
  })

  test("converts a link to a link mark", () => {
    expect(content("[here](https://x.test)")[0]!.content).toEqual([
      {
        type: "text",
        text: "here",
        marks: [{ type: "link", attrs: { href: "https://x.test" } }],
      },
    ])
  })

  test("converts a fenced code block with its language", () => {
    expect(content("```ts\nconst a = 1\n```")).toEqual([
      {
        type: "codeBlock",
        attrs: { language: "ts" },
        content: [{ type: "text", text: "const a = 1" }],
      },
    ])
  })

  test("gives an empty fence no content — ADF rejects an empty text node", () => {
    expect(content("```\n```")).toEqual([{ type: "codeBlock", attrs: {}, content: [] }])
  })

  test("converts bullet and ordered lists, keeping the start number", () => {
    expect(content("- one\n- two")[0]).toMatchObject({ type: "bulletList" })
    expect(content("3. one\n4. two")[0]).toMatchObject({
      type: "orderedList",
      attrs: { order: 3 },
    })
  })

  test("converts a checkbox list to a task list", () => {
    const [list] = content("- [x] shipped\n- [ ] pending")
    expect(list).toMatchObject({ type: "taskList" })
    expect(list!.content?.map((item) => item.attrs?.state)).toEqual(["DONE", "TODO"])
    expect(list!.content?.[0]!.content).toEqual([{ type: "text", text: "shipped" }])
  })

  test("converts a rule and a blockquote", () => {
    expect(content("---")).toEqual([{ type: "rule" }])
    expect(content("> quoted")).toEqual([
      {
        type: "blockquote",
        content: [{ type: "paragraph", content: [{ type: "text", text: "quoted" }] }],
      },
    ])
  })

  test("converts a table into rows of header and body cells", () => {
    const [table] = content("| Key | Value |\n| --- | --- |\n| a | 1 |")
    expect(table!.type).toBe("table")
    expect(table!.content?.[0]!.content?.map((c) => c.type)).toEqual(["tableHeader", "tableHeader"])
    expect(table!.content?.[1]!.content?.map((c) => c.type)).toEqual(["tableCell", "tableCell"])
  })

  test("keeps an image as its text — lane cannot mint an ADF media id", () => {
    expect(content("![shot](https://x.test/a.png)")[0]!.content).toEqual([
      { type: "text", text: "shot" },
    ])
  })

  test("produces an empty doc for empty input", () => {
    expect(markdownToAdf("")).toEqual({ type: "doc", version: 1, content: [] })
  })
})

describe("adf round trip", () => {
  /** Strip the keys the converters legitimately add or omit before comparing. */
  function normalize(node: AdfNode): AdfNode {
    const { type, text: value, marks, content, attrs } = node
    return {
      ...(type ? { type } : {}),
      ...(value ? { text: value } : {}),
      ...(marks?.length ? { marks } : {}),
      ...(attrs && Object.keys(attrs).length ? { attrs } : {}),
      ...(content ? { content: content.map(normalize) } : {}),
    }
  }

  function roundTrips(name: string, node: AdfNode) {
    test(name, () => {
      const { markdown, unsupported } = adfToMarkdown(node)
      expect(unsupported).toEqual([])
      expect(normalize(markdownToAdf(markdown))).toEqual(normalize(node))
    })
  }

  roundTrips("paragraphs", doc(para(text("one")), para(text("two"))))
  roundTrips("a heading", doc({ type: "heading", attrs: { level: 2 }, content: [text("Title")] }))
  roundTrips("marked text", doc(para(text("plain "), text("bold", [{ type: "strong" }]))))
  roundTrips(
    "a link",
    doc(para(text("here", [{ type: "link", attrs: { href: "https://x.test" } }]))),
  )
  roundTrips(
    "a bullet list",
    doc({
      type: "bulletList",
      content: [
        { type: "listItem", content: [para(text("one"))] },
        { type: "listItem", content: [para(text("two"))] },
      ],
    }),
  )
  roundTrips(
    "a code block",
    doc({ type: "codeBlock", attrs: { language: "ts" }, content: [text("const a = 1")] }),
  )
  roundTrips("a rule", doc({ type: "rule" }))
  roundTrips("a blockquote", doc({ type: "blockquote", content: [para(text("quoted"))] }))

  test("a media node cannot round trip, which is exactly what `unsupported` reports", () => {
    const media = doc({
      type: "mediaSingle",
      content: [{ type: "media", attrs: { alt: "shot.png" } }],
    })
    expect(adfToMarkdown(media).unsupported).not.toEqual([])
  })
})
