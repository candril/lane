/**
 * On-disk board cache (specs/033). Each board's last-loaded snapshot is persisted
 * so the next launch — or the next switch to that board — can render instantly and
 * revalidate in the background (stale-while-revalidate), instead of blocking on the
 * multi-second `jira` CLI fetch.
 *
 * One JSON file under `$XDG_CACHE_HOME/lane` holds a map of board key → snapshot.
 * A board's key is a hash of its identity (project + jql + columns), so a config
 * change misses the stale entry rather than showing the wrong board. Every read and
 * write is best-effort: a cache problem must never break the app, which always works
 * live off the provider.
 */

import { homedir } from "os"
import { join } from "path"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import type { Board } from "./types"

export interface CachedBoard {
  board: Board
  /** ISO timestamp of the fetch that produced this snapshot. */
  fetchedAt: string
}

function cacheDir(): string {
  const base = process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache")
  return join(base, "lane")
}

function cacheFile(): string {
  return join(cacheDir(), "cache.json")
}

type CacheFile = Record<string, CachedBoard>

function readAll(): CacheFile {
  try {
    if (!existsSync(cacheFile())) {
      return {}
    }
    return JSON.parse(readFileSync(cacheFile(), "utf8")) as CacheFile
  } catch {
    return {}
  }
}

/** djb2 — a small stable hash, enough to key a board by its identity. */
function hash(input: string): string {
  let h = 5381
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i)
  }
  return (h >>> 0).toString(16)
}

/** A cache key for a board, derived from whatever identity the caller passes. */
export function boardKeyFor(identity: unknown): string {
  return hash(JSON.stringify(identity))
}

/** The cached snapshot for a board key, or null if absent/unreadable. */
export function readBoardCache(key: string): CachedBoard | null {
  return readAll()[key] ?? null
}

/** Persist a freshly-loaded board under its key, stamping the fetch time. */
export function writeBoardCache(key: string, board: Board): void {
  try {
    mkdirSync(cacheDir(), { recursive: true })
    const all = readAll()
    all[key] = { board, fetchedAt: new Date().toISOString() }
    writeFileSync(cacheFile(), JSON.stringify(all))
  } catch {
    // A cache write failure is non-fatal: the live board still works.
  }
}
