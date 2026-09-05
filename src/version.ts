/**
 * App version — injected at build time via `define: { LANE_VERSION: "..." }`.
 * Falls back to a short git commit hash when running via `bun run` / `just dev`.
 */
declare const LANE_VERSION: string

function devVersion(): string {
  try {
    const result = Bun.spawnSync(["git", "rev-parse", "--short", "HEAD"])
    if (result.exitCode === 0) {
      return `dev-${result.stdout.toString().trim()}`
    }
  } catch {
    // ignore — git may be unavailable
  }
  return "dev"
}

export const version: string = typeof LANE_VERSION !== "undefined" ? LANE_VERSION : devVersion()
