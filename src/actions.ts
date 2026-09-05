/**
 * Environment side-effects for issue actions (specs/014): clipboard, browser,
 * and a tmux pane. All best-effort — the TUI keeps running if the tool is
 * missing (no clipboard, not inside tmux, …); output is detached so it never
 * corrupts the rendered board.
 */

function detached(cmd: string[], stdin?: Uint8Array): void {
  Bun.spawn(cmd, {
    stdin: stdin ?? "ignore",
    stdout: "ignore",
    stderr: "ignore",
  })
}

export function copyToClipboard(text: string): void {
  detached(["pbcopy"], new TextEncoder().encode(text))
}

export function openUrl(url: string): void {
  detached(["open", url])
}

/**
 * Show an issue in a new tmux window via `lane view <key>` (no-op when not inside
 * tmux). A new window starts a fresh shell that wouldn't inherit our `JIRA_*`
 * secrets (they live in this process's env, not the shell rc), so forward them
 * with `-e` — `lane view` needs `JIRA_API_TOKEN` to fetch the issue.
 */
export function openIssueInWindow(key: string): void {
  const jiraEnv = Object.entries(process.env)
    .filter(([name, value]) => name.startsWith("JIRA") && value !== undefined)
    .flatMap(([name, value]) => ["-e", `${name}=${value}`])
  detached(["tmux", "new-window", ...jiraEnv, `lane view ${key} | less -R`])
}
