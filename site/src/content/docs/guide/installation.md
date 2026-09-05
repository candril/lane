---
title: Installation
description: Install lane, point it at your Jira instance, and run it.
---

## Install

Prebuilt binaries for macOS (Apple Silicon and Intel) and Linux (x64 and arm64):

```sh
curl -fsSL https://raw.githubusercontent.com/candril/lane/main/scripts/install.sh | bash
```

The installer detects your platform, downloads the latest
[release](https://github.com/candril/lane/releases), verifies its checksum, and puts `lane` in
`/usr/local/bin`. Two variables change that:

```sh
LANE_INSTALL_DIR=~/.local/bin  …   # somewhere else on your PATH
LANE_VERSION=0.1.0 …               # a specific release
```

Or download the archive for your platform from the releases page by hand, `gunzip` it, and put
it on your `PATH`.

### From source

lane is a Bun application, so a clone runs as it is:

```sh
git clone https://github.com/candril/lane.git
cd lane
bun install
bun scripts/build.ts   # → dist/lane, a standalone binary
```

With [just](https://github.com/casey/just): `just build`, or `just install-bin` to build and copy
it to `~/.local/bin`. `just dev` runs from source with hot reload, `just mock` the same against
the demo board.

## Requirements

- A **Jira Cloud** account and an **API token**.
- A terminal with truecolor and a decent Unicode set. Anything modern (WezTerm, Ghostty, kitty,
  iTerm2, Alacritty) is fine.
- **[Bun](https://bun.sh)** 1.x only if you build from source.

## Try it first

```sh
lane --mock
```

opens an offline demo board — a fictional web shop's sprint, with sub-tasks, epics, sprints, a
backlog, and seeded descriptions and history — so you can learn the keymap before touching a real
board. Press `?` for the shortcut dialog, `q` to quit.

## Credentials

lane needs three things: the instance URL, your account email, and an API token.

The **token** comes from the environment, and only from there — it is never read from or
written to a config file:

```sh
export JIRA_API_TOKEN="…"    # https://id.atlassian.com/manage-profile/security/api-tokens
```

The **server URL** and **account email** are read from the
[`jira` CLI](https://github.com/ankitpokhrel/jira-cli) YAML, so if you already use that tool
there is nothing new to set up:

```yaml
# ~/.config/.jira/.config.yml
server: https://acme.atlassian.net
login: you@acme.com
```

Point elsewhere with `JIRA_CONFIG_FILE`, or per board with
[`jira_config`](/lane/reference/configuration/#per-board-jira-instance) — which is how a single
lane session can span two Jira instances.

:::caution
The token lives in memory for the process lifetime and is sent only to the configured `server:`
host, as the Basic-auth password. It is never logged, never included in an error message, and
never written to the cache.
:::

## First run

lane always starts, whatever the state of your credentials. If Jira is unreachable — no token,
no `server:`, no network — it says so on the normal screen and opens the demo board instead of
dying. With Jira reachable but no `config.toml`, it says that too: there is nothing to build
tabs from until you describe a board.

To see your own work, write a `config.toml` — start from
[Getting Started](/lane/guide/getting-started/).

## Files lane writes

| Path | What |
| --- | --- |
| `$XDG_CONFIG_HOME/lane/config.toml` | Your config. lane only reads this. |
| `$XDG_CACHE_HOME/lane/cache.json` | Last snapshot per board, for instant boot. |
| `$XDG_CACHE_HOME/lane/state.json` | Active tab and each tab's view/filter/grouping. |
| `$XDG_STATE_HOME/lane/tabs.json` | The tabs you made yourself. |

`XDG_CONFIG_HOME` defaults to `~/.config`, `XDG_CACHE_HOME` to `~/.cache`, `XDG_STATE_HOME` to
`~/.local/state`. The cache and state files are best-effort: deleting them costs you one refresh
and your restored session, nothing more.
