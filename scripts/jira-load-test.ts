/* eslint-disable no-console -- diagnostic script */
// Smoke-test the real Jira provider without the TUI, so load errors are visible.
//   bun scripts/jira-load-test.ts [board-name]
import { boardToJiraConfig, createJiraProvider, preflightJira } from "../src/providers/jira"
import { configPath, loadConfig } from "../src/config/loader"

const { problem } = await preflightJira()
console.log("preflight:", problem ?? "OK (authenticated)")
if (problem) {
  process.exit(1)
}

const config = await loadConfig()
if (!config || config.boards.length === 0) {
  console.error(`no [[boards]] in ${configPath()}`)
  process.exit(1)
}
const wanted = Bun.argv[2]
const boardConfig = wanted ? config.boards.find((b) => b.name === wanted) : config.boards[0]
if (!boardConfig) {
  console.error(`no board named ${wanted}; have: ${config.boards.map((b) => b.name).join(", ")}`)
  process.exit(1)
}
console.log(`board: ${boardConfig.name}`)

const board = await createJiraProvider(boardToJiraConfig(config.jira, boardConfig)).loadBoard()
const parents = board.tasks.filter((t) => !t.parentKey)
const subs = board.tasks.filter((t) => t.parentKey)
console.log("\ncolumns:", board.columns.map((c) => c.title).join(", "))
console.log(`tasks: ${board.tasks.length}  (top-level ${parents.length}, sub-tasks ${subs.length})`)
console.log("lanes (rank order):")
for (const t of parents) {
  const kids = subs.filter((s) => s.parentKey === t.key).length
  console.log(`  ${t.key}  ${t.type.padEnd(6)} col=${t.columnId.padEnd(12)} subtasks=${kids}`)
}
