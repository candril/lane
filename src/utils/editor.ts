import { randomUUID } from "crypto"
import { tmpdir } from "os"
import { join } from "path"
import { unlink } from "fs/promises"
import type { CliRenderer } from "@opentui/core"

/**
 * Hand an issue's summary and description to `$EDITOR` and take them back (specs/049).
 *
 * A description is prose — paragraphs, lists, code blocks — and editing that in a TUI
 * field would mean building a text editor when the user already has one they know. So
 * lane suspends the renderer, spawns theirs, and parses what comes back.
 *
 * The buffer is shaped like a `git commit --verbose` message: first line the summary,
 * then the description, then a scissors line below which context is shown and nothing
 * is read. Building and parsing it are pure, so both are tested without a spawn.
 */

export const SCISSORS = "# ------------------------ >8 ------------------------"

export interface IssueEdit {
  summary: string
  description: string
}

export interface IssueEditOptions {
  summary: string
  description: string
  /** Lines shown below the scissors — issue facts, and the read-only description. */
  context?: string[]
  /**
   * The description could not survive the ADF round trip (specs/049), so it is shown
   * as context instead of being editable, and whatever comes back is ignored.
   */
  descriptionReadOnly?: boolean
}

/** Compose the editor buffer. `context` is decoration: it is discarded on read. */
export function buildIssueEditBuffer(options: IssueEditOptions): string {
  const lines = [options.summary, ""]
  if (!options.descriptionReadOnly && options.description.trim()) {
    lines.push(options.description, "")
  }
  lines.push(
    SCISSORS,
    "# Do not modify or remove the line above.",
    "# Everything below it will be ignored.",
    "#",
  )
  for (const line of options.context ?? []) {
    lines.push(line === "" ? "#" : `# ${line}`)
  }
  return lines.join("\n")
}

/**
 * Read an edited buffer back. Returns null for a cancel — an empty buffer or an empty
 * first line, the same convention `git commit` uses.
 *
 * Only the scissors cut removes text. Nothing strips `#` lines from the editable part,
 * because in Markdown that character starts a heading, not a comment.
 */
export function parseIssueEditBuffer(content: string): IssueEdit | null {
  const cut = content.indexOf(SCISSORS)
  const lines = (cut === -1 ? content : content.slice(0, cut)).split("\n")
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === "") {
    lines.pop()
  }
  const summary = lines[0]?.trim() ?? ""
  if (!summary) {
    return null
  }
  let start = 1
  while (start < lines.length && lines[start]!.trim() === "") {
    start++
  }
  return { summary, description: lines.slice(start).join("\n").trimEnd() }
}

function editorCommand(): string {
  return process.env.EDITOR || process.env.VISUAL || "vi"
}

/**
 * Suspend the TUI, run `$EDITOR` on a temp file, and return what was written — or null
 * if the user cancelled or the editor failed.
 *
 * The resume sits in a `finally` on purpose: an editor that crashes must not leave the
 * renderer suspended, which would strand the user in a dead terminal.
 */
export async function openIssueEditor(
  renderer: CliRenderer,
  options: IssueEditOptions,
): Promise<IssueEdit | null> {
  // `.md` so the user's editor highlights it as what it is.
  const file = join(tmpdir(), `lane-issue-${randomUUID()}.md`)
  await Bun.write(file, buildIssueEditBuffer(options))
  try {
    renderer.suspend()
    try {
      const proc = Bun.spawn([editorCommand(), file], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      })
      if ((await proc.exited) !== 0) {
        return null
      }
    } finally {
      renderer.resume()
    }
    const edited = parseIssueEditBuffer(await Bun.file(file).text())
    // A read-only description is not in the buffer at all, so the parse would report
    // it as deleted; keep the original instead.
    return edited && options.descriptionReadOnly
      ? { ...edited, description: options.description }
      : edited
  } finally {
    await unlink(file).catch(() => {})
  }
}
