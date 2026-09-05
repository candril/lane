import { describe, expect, test } from "bun:test"
import { buildIssueEditBuffer, parseIssueEditBuffer, SCISSORS } from "./editor"

describe("buildIssueEditBuffer", () => {
  test("puts the summary first, then the description, then the scissors", () => {
    const buffer = buildIssueEditBuffer({ summary: "Fix it", description: "Because." })
    const lines = buffer.split("\n")
    expect(lines[0]).toBe("Fix it")
    expect(lines[1]).toBe("")
    expect(lines[2]).toBe("Because.")
    expect(lines).toContain(SCISSORS)
  })

  test("omits the description block when there is none", () => {
    const buffer = buildIssueEditBuffer({ summary: "Fix it", description: "   " })
    expect(buffer.split("\n").slice(0, 3)).toEqual(["Fix it", "", SCISSORS])
  })

  test("comments the context out below the scissors", () => {
    const buffer = buildIssueEditBuffer({
      summary: "Fix it",
      description: "",
      context: ["SHOP-1 · bug", "", "labels: infra"],
    })
    const below = buffer.slice(buffer.indexOf(SCISSORS)).split("\n")
    expect(below).toContain("# SHOP-1 · bug")
    expect(below).toContain("# labels: infra")
    expect(below).toContain("#")
  })

  test("leaves a read-only description out of the editable part", () => {
    const buffer = buildIssueEditBuffer({
      summary: "Fix it",
      description: "has a panel in it",
      descriptionReadOnly: true,
    })
    expect(buffer.slice(0, buffer.indexOf(SCISSORS))).not.toContain("has a panel")
  })
})

describe("parseIssueEditBuffer", () => {
  test("splits the first line from the rest", () => {
    expect(parseIssueEditBuffer("Title\n\nBody line one\nBody line two")).toEqual({
      summary: "Title",
      description: "Body line one\nBody line two",
    })
  })

  test("discards everything at and after the scissors", () => {
    const buffer = `Title\n\nBody\n\n${SCISSORS}\n# ignored\nalso ignored`
    expect(parseIssueEditBuffer(buffer)?.description).toBe("Body")
  })

  test("keeps Markdown headings — `#` is not a comment above the cut", () => {
    const buffer = `Title\n\n# A heading\n\ntext\n${SCISSORS}\n# context`
    expect(parseIssueEditBuffer(buffer)?.description).toBe("# A heading\n\ntext")
  })

  test("treats an empty buffer as a cancel", () => {
    expect(parseIssueEditBuffer("")).toBeNull()
    expect(parseIssueEditBuffer("\n\n  \n")).toBeNull()
    expect(parseIssueEditBuffer(`\n${SCISSORS}\n# context`)).toBeNull()
  })

  test("treats a blank first line as a cancel, however much body follows", () => {
    expect(parseIssueEditBuffer("\n\nstill has a body")).toBeNull()
  })

  test("returns an empty description when the body was deleted", () => {
    expect(parseIssueEditBuffer("Only a title")).toEqual({
      summary: "Only a title",
      description: "",
    })
  })

  test("trims the summary but not the shape of the body", () => {
    const parsed = parseIssueEditBuffer("  Title  \n\n\n  indented body\n\n")
    expect(parsed).toEqual({ summary: "Title", description: "  indented body" })
  })

  test("round-trips what build produced", () => {
    const original = { summary: "Fix it", description: "## Why\n\nBecause." }
    expect(
      parseIssueEditBuffer(buildIssueEditBuffer({ ...original, context: ["SHOP-1"] })),
    ).toEqual(original)
  })
})
