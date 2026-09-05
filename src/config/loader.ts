/**
 * Locate, read, and parse `config.toml` (specs/015). Resolved once at startup,
 * before the renderer mounts. Returns null when no file exists (the app falls
 * back to the mock board); throws a clear, named error when a file exists but is
 * invalid, rather than crashing or silently ignoring it.
 */

import { homedir } from "os"
import { join } from "path"
import type { Config } from "./types"
import { validateConfig } from "./validate"

export function configPath(): string {
  const xdgBase = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config")
  return join(xdgBase, "lane", "config.toml")
}

export async function loadConfig(path: string = configPath()): Promise<Config | null> {
  const file = Bun.file(path)
  if (!(await file.exists())) {
    return null
  }
  let raw: unknown
  try {
    raw = Bun.TOML.parse(await file.text())
  } catch (err) {
    throw new Error(
      `config: ${path} is not valid TOML — ${err instanceof Error ? err.message : String(err)}`,
    )
  }
  return validateConfig(raw, path)
}
