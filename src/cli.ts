const ISSUE_KEY = /^[A-Z][A-Z0-9]*-\d+$/

export type OpenArgs = { key: string } | { error: string }

/** What `lane open <issue-key>` asks for (specs/063); null when it isn't that command. */
export function parseOpenArgs(args: string[]): OpenArgs | null {
  if (args[0] !== "open") {
    return null
  }
  const key = args.slice(1).find((arg) => !arg.startsWith("-"))
  return key && ISSUE_KEY.test(key) ? { key } : { error: "usage: lane open <issue-key>" }
}
