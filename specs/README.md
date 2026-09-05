# Specs

Feature specifications and non-functional requirements (NFRs) for **lane**.

Nothing here is invented ahead of need: every spec traces to something already built or
already discussed. Where a design decision is genuinely open (notably *how* we talk to Jira),
it is recorded as an **Open Question** inside the spec rather than guessed.

## Format

Each feature spec follows a consistent structure:

- **Status**: `Draft` | `Ready` | `In Progress` | `Done`
- **Description**: what this feature does
- **Capabilities**: prioritised (P1 = MVP, P2 = Should have, P3 = Nice to have)
- **Out of Scope**: what it explicitly does not do
- **Technical Notes** / **File Structure**: implementation detail

NFR specs (in `nfr/`) use **Requirement** + **Criteria** + **Notes** instead.

See [spec-authoring.md](./spec-authoring.md) for the full conventions — structure,
status lifecycle, prioritisation, Open Questions, and cross-linking.

## Naming

- Feature specs: `NNN-feature-name.md`, numbered sequentially.
- NFR specs: `nfr/NNN-name.md`.

## Workflow

1. Create as `Draft`
2. Refine → `Ready`
3. Implement → `In Progress`
4. Complete and verified → `Done`

## Feature Specs

| # | Name | Status | Description |
|---|------|--------|-------------|
| 000 | [Vision](./000-vision.md) | Draft | Product vision: keyboard-first Jira Kanban in the terminal |
| 001 | [App Shell](./001-app-shell.md) | Done | Renderer, arg parsing, layout, clean startup/shutdown |
| 002 | [Board View](./002-board-view.md) | Done | Columns, cards, header, help bar |
| 003 | [Keyboard Navigation](./003-keyboard-navigation.md) | Done | `h/j/k/l` cursor, `H/L` move card, quit |
| 004 | [Data Model & Provider](./004-data-model-and-provider.md) | Done | `Board`/`Column`/`Task` types + provider seam + mock |
| 005 | [Jira Provider](./005-jira-provider.md) | Draft | Populate the board from real Jira via the Cloud REST API (token from `JIRA_API_TOKEN`) |
| 006 | [Card Movement](./006-card-movement.md) | Draft | Moving a card persists as a Jira status transition |
| 007 | [Issue Detail View](./007-card-detail-view.md) | Implemented | `⇧V` full-screen viewer: fields + description rendered as Markdown; hosts the existing field editors |
| 008 | [Sub-Tasks](./008-sub-tasks.md) | Draft | Sub-tasks under a parent; nested (flat view) or own-status column (parent mode); stable parent order |
| 009 | [Swimlanes](./009-swimlanes.md) | Draft | Grouping key none/parent/type/query; parent mode = backlog-ordered story lanes |
| 010 | [Command Palette](./010-command-palette.md) | Draft | `Ctrl+P` fuzzy, state-aware command palette |
| 011 | [Shortcut Dialog](./011-shortcut-dialog.md) | Draft | On-demand shortcut dialog; no persistent status bar |
| 012 | [Create & Edit Items](./012-create-and-edit-items.md) | Draft | Create issues; edit summary/description/fields |
| 013 | [Quick Field Edit](./013-quick-field-edit.md) | Draft | Fast status / assignee / priority pickers |
| 014 | [Issue Actions](./014-issue-actions.md) | Draft | Open in browser; copy key; copy URL |
| 015 | [Configuration](./015-configuration.md) | Draft | `config.toml`: defines boards + per-instance provider settings |
| 016 | [Multiple Boards & Tabs](./016-multiple-boards.md) | Draft | Config-defined boards as header tabs; per-board JQL + swimlanes |
| 017 | [View Modes](./017-view-modes.md) | Draft | Board / list / backlog views |
| 018 | [Import Jira Board Config](./018-import-jira-board-config.md) | Done | `lane import <boardId>` scaffolds a board config (columns + JQL) from a real Jira board |
| 019 | [Quick Create](./019-quick-create.md) | Draft | Contextual sub-task create from a cell; typed shortcuts for story/task/bug |
| 020 | [Filter & Search](./020-filter-and-search.md) | Draft | presto/monq-style bar: keyword + type/assignee/status filters |
| 021 | [Fold & Collapse Controls](./021-fold-and-collapse-controls.md) | Draft | `z`-prefix fold keys (`za`/`zo`/`zc`/`zR`/`zM`) for lanes + sub-task trees |
| 022 | [Grid Cursor Navigation](./022-grid-cursor-navigation.md) | Draft | Select empty cells so `h/j/k/l` always moves one step |
| 023 | [Status Toggle](./023-status-toggle.md) | Draft | Cycle a card's status; toggle a swimlane parent's status |
| 024 | [Backlog as a Configured Tab](./024-backlog-tab.md) | Draft | A backlog is just a JQL-defined tab defaulting to the backlog view |
| 025 | [JQL Search](./025-jql-search.md) | Draft | Server-side JQL search with grammar-aware autocomplete |
| 026 | [Per-Board Views](./026-default-view-per-board.md) | Draft | Per board: default opening view + grouping, and an allowlist of which views/groupings are available |
| 027 | [Assign Issue to a User](./027-assign-issue-to-user.md) | In Progress | `a` picker: assign to me / unassign / board people (fuzzy) / typed name; optimistic + revert |
| 028 | [Change Labels](./028-change-labels.md) | Implemented | Add/remove labels on the focused issue (`#`); can re-slot swimlanes live |
| 029 | [Epic on Card & Filter](./029-epic-on-card.md) | Implemented | Show an issue's epic (up-link, ≠ sub-tasks) on the card and filter by `epic:` |
| 030 | [Per-Board Columns](./030-per-board-columns.md) | Done | Columns defined per board (instance set is the fallback); enables mixed-project boards |
| 031 | [Per-Board Jira Config](./031-per-board-jira-cli-config.md) | Done | A board can source its `server`/`login` from its own `jira` YAML (`JIRA_CONFIG_FILE`); fixes cross-instance boards |
| 032 | [Alternative Backend — Markdown in Git](./032-alternative-backend-markdown.md) | Draft | A non-Jira `BoardProvider`: issues as Markdown files versioned/pushed via git |
| 033 | [Cached Boot & Background Refresh](./033-cached-boot-and-refresh.md) | Draft | Instant boot from a local cache; refresh on interval + on terminal focus |
| 034 | [Epic View](./034-epic-grouped-backlog.md) | In Progress | Epics as root items: the same views one hierarchy level up, on a configured epic tab |
| 035 | [Labels on Card & Filter](./035-labels-on-card-and-filter.md) | Implemented | Show labels on cards and filter by `label:` / `#tag` |
| 036 | [Quick Filters](./036-quick-filters.md) | Implemented | Config-defined filters applied with an `f`+letter chord |
| 037 | [Jump to Item](./037-jump-to-item.md) | Implemented | flash-style `s` jump: label visible cards/lanes, type to move the cursor |
| 038 | [Change Epic](./038-change-epic.md) | Implemented | Re-link (or detach) an issue's epic via a picker (`⇧E`); `setEpic`, optimistic + revert |
| 039 | [Card Decoration Visibility](./039-card-decoration-visibility.md) | Implemented | `t…` chord to show/hide epic tags (`te`) and labels (`tl`) on cards |
| 040 | [Collapse Columns](./040-collapse-columns.md) | Implemented | `c` folds the column under the cursor to a narrow title+count strip; `⇧C` expands all |
| 041 | [Set Status](./041-set-status.md) | Implemented | `⇧S` opens a picker of the board's statuses; choosing one transitions the issue there |
| 042 | [Fold Sub-Tasks](./042-fold-subtasks.md) | Implemented | `z a/o/c` folds the sub-tasks of the card under the cursor (`▸ N` marker); `z ⇧M`/`z ⇧R` fold/unfold everything |
| 043 | [Sub-Task Filter Scope](./043-subtask-filter-scope.md) | Implemented | `⇧F` toggles strict vs inherit: a matching issue keeps all of its sub-tasks |
| 044 | [Board Backlog](./044-board-backlog.md) | In Progress | Backlog statuses split off the board; a `v k` mode showing To Do + Backlog with expandable sub-tasks |
| 045 | [Ad-Hoc Tabs](./045-ad-hoc-tabs.md) | In Progress | Clone the active tab into a named, filtered view of the same query; persisted across restarts |
| 046 | [Global Search](./046-global-search.md) | In Progress | `:` searches any work item in Jira (text / key / JQL), not just what a board loaded |
| 047 | [Query-Backed Tabs](./047-query-backed-tabs.md) | In Progress | A source can be a JQL query, not only a config board — so a search result set *is* a board |
| 048 | [One Filter Language](./048-one-filter-language.md) | In Progress | `:` parses the same grammar as `/` (`epic:`, `#`, `@`, `-`) and completes the same way, translated to JQL |
| 049 | [Edit in `$EDITOR`](./049-edit-in-editor.md) | Implemented | `i` hands summary + description to `$EDITOR` in one buffer; Markdown ↔ ADF |
| 050 | [Sprint Swimlanes](./050-sprint-swimlanes.md) | Implemented | A scrum board reads by sprint — lanes (`g r`) and a sprint-sectioned backlog (`v k`) |
| 051 | [Parent Baskets](./051-parent-baskets.md) | Implemented | Sub-tasks in their own status column, trayed per parent; `v o/u/c/g` switches layout per tab |
| 052 | [Child Visibility](./052-child-visibility.md) | Implemented | `v a/d/n` — draw all children, all but the done ones, or none; parents mark what they hide |
| 053 | [Close Reason](./053-close-reason.md) | Implemented | `⇧R` closes an issue *as* a reason, or amends a closed one's resolution in hindsight |
| 054 | [Copy Description & Title](./054-copy-fields.md) | Implemented | `⇧D` copies the description as Markdown, `⇧U` the title — from a card, a row, or the viewer |
| 055 | [Multi-Select Copy](./055-multi-select-copy.md) | Implemented | `space` marks, `⇧V` ranges over rows; `y`/`⇧Y`/`⇧U` copy the lot; `↵` takes over the viewer |
| 056 | [Bulk Edit](./056-bulk-edit.md) | Implemented | `⇧S`/`a`/`⇧E`/`#`/`⇧R` act on the whole selection — fan-out writes, per-issue revert |
| 057 | [Detail Navigation](./057-detail-navigation.md) | Implemented | `j`/`k` walk the viewer's linked issues, actions target the selection, `↵` drills in and `⌫` backs out |
| 058 | [Issue History](./058-issue-history.md) | Implemented | A folded `history` section in the viewer — who changed what, when — and `↵` on a text edit shows it as a Markdown diff |

## NFR Specs

| # | Name | Status | Requirement |
|---|------|--------|-------------|
| 001 | [Performance](./nfr/001-performance.md) | Draft | Instant local interaction; no blocking I/O on input path |
| 002 | [Terminal Compatibility](./nfr/002-terminal-compatibility.md) | Draft | Correct rendering & input across common terminals |
| 003 | [Security & Credentials](./nfr/003-security-and-credentials.md) | Draft | Only the API token, from `JIRA_API_TOKEN`, held in memory; never logged or committed |
| 004 | [Reliability & Errors](./nfr/004-reliability-and-errors.md) | Draft | Failures are visible, recoverable, non-crashing |
| 005 | [Code Quality & Architecture](./nfr/005-code-quality-and-architecture.md) | Draft | Strict TS, UI/provider separation, `just`, jj repo |

## Status Summary

- **Done**: 001–004, 018 (board-config import), 030 (per-board columns), 031 (per-board Jira config).
- **Implemented**: 020 (filter & search), 028 (labels edit), 029 (epic on card & filter), 035 (labels on card & filter), 036 (quick filters), 007 (issue detail view), 037 (jump to item), 038 (change epic), 039 (card decoration visibility), 040 (collapse columns), 041 (set status), 042 (fold sub-tasks), 043 (sub-task filter scope), 049 (edit in `$EDITOR`), 050 (sprint swimlanes — P1 + P2), 051 (parent baskets), 052 (child visibility), 053 (close reason), 054 (copy description & title), 055 (multi-select copy), 056 (bulk edit), 057 (detail navigation), 058 (issue history).
- **In Progress**: 027 (assign — `a` picker done; palette/pending pending), 044 (backlog tab — P1 built), 045 (ad-hoc tabs — P1 built), 034 (epics as roots — P1 built), 046 (global search — P1 built), 047 (query-backed tabs — P1 built), 048 (one filter language — P1 built), 026 (per-board view + grouping).
- **Partial**: 008 (sub-tasks — layouts + hide done), 012 (create + rename), 019 (quick-create incl. epics).
- **Draft** (discussed, not built): 000, 005–006, 009–011, 013–017, 021–025, 032–033, all NFRs.

> Note: 011 (shortcut dialog) supersedes the persistent help bar from the 001–002 scaffold.
> `HelpBar.tsx` is still in the code and will be removed when 011 is implemented.
