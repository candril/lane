# Per-Board Jira CLI Config

**Status**: Done

## Description

Let a board point its `jira` CLI calls at a **specific CLI config file**, instead of
always using the one global `~/.config/.jira/.config.yml`. The `jira` CLI's config is
scoped to a single project/board (its cached issue types, epic-link field, board id),
so a board on a *different* project or instance needs a config `jira init`'d for it —
otherwise the CLI mis-routes fields.

Surfaced trying to create a sub-task in a team-managed `SANDBOX` board while the CLI was
configured for the company-managed SHOP board: `jira` didn't recognise SANDBOX's `Subtask`
type (not in its SHOP cache), so it routed `--parent` to SHOP's epic-link custom field
instead of the standard `parent` field → *"sub-task but parent not specified"*. No lane
flag change can fix that; the CLI needs SANDBOX-aware config.

This completes the per-board provider story alongside [030](./030-per-board-columns.md)
(columns/project) and [012](./012-create-and-edit-items.md) (type names).

## Capabilities

### P1 — Must Have

- `BoardConfig` gains `jira_config` — a path to a `jira` CLI config file (a leading
  `~/` expands). When set, lane exports `JIRA_CONFIG_FILE=<path>` on **every** CLI call
  it makes for that board (list / move / edit / create), and reads that file for the
  browse-URL base too.
- Omitted → the CLI's default config (unchanged behaviour).
- The user creates the file once: `JIRA_CONFIG_FILE=<path> jira init` and selects the
  board's project/board.

### P2 — Should Have

- Preflight ([005](./005-jira-provider.md)) validates the board's config file resolves
  (exists / parses) and surfaces a clear message if not, rather than a raw CLI error.
- Documented recipe in `config.example.toml` for the `jira init` step.

### P3 — Nice to Have

- Per-**instance** config (different Jira sites), not just per-project — falls out of
  this since a CLI config already carries the site URL/credentials pointer.

## Out of Scope

- Managing / generating the `jira` CLI config for the user — they run `jira init`
  ([nfr/003-security-and-credentials](./nfr/003-security-and-credentials.md): lane never
  handles credentials; the CLI owns the token).
- A direct Jira REST client to bypass the CLI's routing — disallowed
  ([nfr/003](./nfr/003-security-and-credentials.md)).

## Technical Notes

- `JiraConfig` gains `jiraConfigPath`; `boardToJiraConfig` maps `board.jiraConfig`.
  `createJiraProvider` builds an `env` (`{ ...process.env, JIRA_CONFIG_FILE }`) once and
  applies `.env(env)` to each `$\`jira …\`` call; `jiraServer(path)` reads the same file.
- `~/` is expanded to `$HOME` (`expandHome`), since TOML strings are literal.
- One active board per process today, so setting it per provider is sufficient; when
  board tabs land ([016](./016-multiple-boards.md)) each board already carries its own
  path, so switching boards switches configs for free.

## File Structure

| File | Change |
|------|--------|
| `src/config/types.ts` | `jiraConfig?` on `BoardConfig` |
| `src/config/validate.ts` | Parse `jira_config` |
| `src/providers/jira.ts` | `jiraConfigPath` on `JiraConfig`; `.env()` on every CLI call; `jiraServer(path)` |
| `config.example.toml` | Document `jira_config` + the `jira init` recipe |
