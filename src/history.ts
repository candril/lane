import type { ChangeEntry, ChangeItem } from "./providers/provider"
import { shortDate } from "./grouping"

/**
 * One changelog entry as the viewer draws it (specs/058): a cursor item like a link,
 * carrying the edit it can open as a diff, if it holds one.
 */
export interface DetailHistoryRow {
  index: number
  /** The entry's timestamp — what an expanded comment is remembered by, since cursor
   * indices shift as sections above fold. */
  at: string
  when: string
  author: string
  /** `status → In Review · assignee → S. Lüthi`, or `description edited`. */
  summary: string
  /** A text field's before and after, for the diff view; only the first per entry. */
  diff?: { field: string; from: string; to: string }
  /** A comment's Markdown, opened in full in place of the description (specs/061). */
  comment?: string
}

/**
 * How many entries the unfolded section draws. The section sits above the scroll
 * region, so a long changelog would otherwise push the description off the screen;
 * the rest is counted, not lost.
 */
export const HISTORY_CAP = 10

/** The text fields, whose changes are worth a diff rather than an inline value. */
const DIFFABLE = new Set(["description", "summary"])

/** `status → In Review`; a text field just says it was edited — the diff has the rest. */
export function describeChange(item: ChangeItem): string {
  if (DIFFABLE.has(item.field)) {
    return `${item.field} edited`
  }
  return item.to ? `${item.field} → ${item.to}` : `${item.field} cleared`
}

/**
 * ` 4 Sep 14:12`, local time — the day alone can't order two changes in one afternoon.
 * The day is padded to two cells so the times stack in one column down the list.
 */
function shortDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  const hh = String(date.getHours()).padStart(2, "0")
  const mm = String(date.getMinutes()).padStart(2, "0")
  return `${shortDate(iso).padStart(6)} ${hh}:${mm}`
}

/**
 * The newest `limit` entries as rows, indexed from `firstIndex` on — the cap by
 * default, everything once the reader asks for the rest.
 */
export function historyRows(
  history: ChangeEntry[],
  firstIndex: number,
  limit = HISTORY_CAP,
): DetailHistoryRow[] {
  return history.slice(0, limit).map((entry, i) => {
    if (entry.comment !== undefined) {
      return {
        index: firstIndex + i,
        at: entry.at,
        when: shortDateTime(entry.at),
        author: entry.author,
        summary: firstLine(entry.comment),
        comment: entry.comment,
      }
    }
    const edit = entry.items.find((item) => DIFFABLE.has(item.field))
    return {
      index: firstIndex + i,
      at: entry.at,
      when: shortDateTime(entry.at),
      author: entry.author,
      summary: entry.items.map(describeChange).join(" · "),
      diff: edit ? { field: edit.field, from: edit.from ?? "", to: edit.to ?? "" } : undefined,
    }
  })
}

/** A comment's opening text on one line — the row is a pointer, `↵` reads the rest. */
function firstLine(markdown: string): string {
  const line = markdown.split("\n").find((l) => l.trim() !== "") ?? ""
  return (
    line
      .replace(/^\s*(?:[#>*-]+|\d+\.)\s+/, "")
      // Links read as their text — a URL would fill the row with nothing worth seeing.
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\*\*|__|[*`]/g, "")
      .trim() || "(empty comment)"
  )
}
