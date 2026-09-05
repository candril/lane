/**
 * One-shot scaffolder (specs/018): read a Jira board's configuration over REST and
 * emit a `[[boards]]` config block for the user to paste into config.toml. Not a
 * runtime dependency of the board views — `lane import <boardId>` prints and exits.
 *
 * The public Agile API exposes a board's columns + filter JQL but not its swimlane
 * definitions, so those still have to be added by hand.
 */

import { createJiraClient, resolveCredentials } from "../providers/jira/http"

interface BoardConfiguration {
  name?: string
  filter?: { id?: string }
  columnConfig?: { columns?: { name?: string; statuses?: { id?: string }[] }[] }
}

interface ImportedColumn {
  title: string
  statuses: string[]
}

interface ImportedBoard {
  name: string
  jql: string
  columns: ImportedColumn[]
}

/** Fetch a board's config + filter and resolve its columns' status names. */
export async function importBoard(boardId: string): Promise<ImportedBoard> {
  const client = createJiraClient(resolveCredentials())
  const config = await client.request<BoardConfiguration>(
    "GET",
    `/rest/agile/1.0/board/${boardId}/configuration`,
  )
  const filterId = config.filter?.id
  if (!filterId) {
    throw new Error(`board ${boardId} has no filter — can't derive its JQL`)
  }
  const filter = await client.request<{ jql?: string }>("GET", `/rest/api/3/filter/${filterId}`)

  // Column config carries status *ids*; map them to names for a readable config.
  const statuses = await client.request<{ id: string; name: string }[]>("GET", "/rest/api/2/status")
  const nameById = new Map(statuses.map((s) => [s.id, s.name]))

  const columns: ImportedColumn[] = (config.columnConfig?.columns ?? []).map((c) => ({
    title: c.name ?? "",
    statuses: (c.statuses ?? []).map((s) => (s.id ? (nameById.get(s.id) ?? s.id) : "")),
  }))

  return {
    name: config.name ?? `Board ${boardId}`,
    jql: filter.jql ?? "",
    columns,
  }
}

/** A TOML string: a literal (single-quoted) unless it contains a single quote. */
function tomlString(value: string): string {
  if (!value.includes("'")) {
    return `'${value}'`
  }
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

/** Render an imported board as a pasteable `[[boards]]` TOML block. */
export function toToml(board: ImportedBoard): string {
  const lines = ["[[boards]]", `name = ${tomlString(board.name)}`, `jql = ${tomlString(board.jql)}`]
  for (const col of board.columns) {
    lines.push(
      "",
      "  [[boards.columns]]",
      `  title = ${tomlString(col.title)}`,
      `  statuses = [${col.statuses.map(tomlString).join(", ")}]`,
    )
  }
  return lines.join("\n")
}
