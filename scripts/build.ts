#!/usr/bin/env bun
/* eslint-disable no-console -- build script: progress output is the point */

/**
 * Build the standalone binary — for this machine by default, for every supported
 * platform with `--all`, or for one platform when CI sets BUILD_TARGET_OS/ARCH.
 *
 * A plain `bun build --compile` produces a binary whose Markdown descriptions
 * (specs/007) render as raw text: OpenTUI highlights them through a tree-sitter
 * worker, and `new Worker(…)` inside a dependency is not something the bundler can
 * follow, so the worker is missing from the binary and every highlight fails.
 *
 * The fix (riff's, by way of opencode): pass the worker as a second **entrypoint**, so
 * it is bundled with its own dependencies (`web-tree-sitter`), and hand OpenTUI the
 * path it will live at inside the binary through the compile-time constant it reads.
 * The grammar `.wasm` and query files come along on their own, because they are
 * ordinary file imports the bundler *can* follow.
 */

import { basename, relative, resolve } from "path"
import { realpathSync } from "fs"
import { $ } from "bun"

interface Target {
  os: "darwin" | "linux"
  arch: "arm64" | "x64"
}

const ALL_TARGETS: Target[] = [
  { os: "darwin", arch: "arm64" },
  { os: "darwin", arch: "x64" },
  { os: "linux", arch: "x64" },
  { os: "linux", arch: "arm64" },
]

const projectDir = resolve(import.meta.dir, "..")
process.chdir(projectDir)

const args = Bun.argv.slice(2)
const buildAll = args.includes("--all")
const envOs = process.env.BUILD_TARGET_OS as Target["os"] | undefined
const envArch = process.env.BUILD_TARGET_ARCH as Target["arch"] | undefined

const targets: Target[] =
  envOs && envArch
    ? [{ os: envOs, arch: envArch }]
    : buildAll
      ? ALL_TARGETS
      : ALL_TARGETS.filter((t) => t.os === process.platform && t.arch === process.arch)

if (targets.length === 0) {
  console.error(`no build target for ${process.platform}/${process.arch}`)
  process.exit(1)
}

const workerPath = realpathSync(resolve(projectDir, "node_modules/@opentui/core/parser.worker.js"))
// Bun lays an entrypoint down at its path relative to the project root; the bunfs root
// is the same on every platform lane builds for (no Windows target).
const workerInBinary = `/$bunfs/root/${relative(projectDir, workerPath).replaceAll("\\", "/")}`

/**
 * The version stamped into the binary: the package version, plus the short commit
 * when this is not a tagged release build — so a binary built from a working tree
 * says which one, while `v0.1.0` reports exactly `0.1.0`.
 */
async function laneVersion(): Promise<string> {
  const { version } = (await Bun.file(resolve(projectDir, "package.json")).json()) as {
    version: string
  }
  if (process.env.GITHUB_REF_TYPE === "tag") {
    return version
  }
  const git = Bun.spawnSync(["git", "rev-parse", "--short", "HEAD"])
  const commit = git.exitCode === 0 ? git.stdout.toString().trim() : ""
  return commit ? `${version}+${commit}` : version
}

const version = await laneVersion()
await $`mkdir -p dist`

// A local single-target build is what `just install-bin` copies, so it is plain
// `dist/lane`; CI and `--all` builds carry the platform in the name. (Copying the
// file afterwards is not an option: macOS refuses to run the copy of a compiled
// binary until it is re-signed.)
const localBuild = targets.length === 1 && !envOs

for (const target of targets) {
  const outfile = localBuild ? "dist/lane" : `dist/lane-${target.os}-${target.arch}`
  console.log(`lane ${version} → ${outfile}`)
  const result = await Bun.build({
    entrypoints: ["./src/index.tsx", workerPath],
    target: "bun",
    compile: { target: `bun-${target.os}-${target.arch}`, outfile },
    define: {
      OTUI_TREE_SITTER_WORKER_PATH: JSON.stringify(workerInBinary),
      LANE_VERSION: JSON.stringify(version),
    },
  })
  if (!result.success) {
    for (const log of result.logs) {
      console.error(log)
    }
    process.exit(1)
  }
}

console.log(`  worker: ${basename(workerPath)} at ${workerInBinary}`)
console.log("done")
