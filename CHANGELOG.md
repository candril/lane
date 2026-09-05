# Changelog

All notable changes to lane are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] — 2026-09-05

First public release.

### Board

- Columns from your config, cards with type glyph, key, summary, priority, assignee,
  points, epic and label tags. Done cards are struck through.
- `h j k l` grid cursor that also lands on empty cells; `s` flash-jump to any visible
  card or lane.
- `⇧H` / `⇧L` moves a card (a Jira transition), `⇧J` / `⇧K` re-ranks it, including
  across the backlog divider.
- Views: board, list, backlog (`v b/l/k`). Groupings: none, by parent, by type, JQL
  swimlanes, by sprint (`g n/p/t/s/r`).
- Sub-task layouts: own column, under the parent, checklist rows, parent baskets
  (`v o/u/c/g`); child visibility all / hide done / none (`v a/d/n`).
- Fold controls (`z a/o/c`, `z ⇧R`, `z ⇧M`), column collapse (`c` / `⇧C`), epic and
  label tag toggles (`t e/l/a`).

### Issues

- Viewer (`↵`) with the description rendered as Markdown, links, children, and a
  folded history section; `↵` on a text edit shows it as a diff.
- Create (`n` / `⇧N`), rename (`e`), edit title and body in `$EDITOR` (`i`), assign
  (`a`), labels (`#`), epic (`⇧E`), status (`⇧S`), close as a reason (`⇧R`).
- Copy key, URL, title or description (`y`, `⇧Y`, `⇧U`, `⇧D`); open in the browser or
  a tmux window (`o` / `⇧O`).
- Multi-select with `space`, `^A` scopes and `⇧V` ranges; every field editor and copy
  acts on the whole selection.

### Find

- `/` filters the loaded board live; `:` searches Jira with the same grammar
  (`type:bug @me #UX epic:KEY -is:done`, a key, or raw JQL).
- Search results become a tab with `^T`; `⇧T c/r/x` clones, renames and closes tabs.
- Quick filters bound to letters in config (`f` + letter).

### App

- Config-defined boards as tabs, per-board columns, JQL, swimlanes, default view and
  grouping, and a `jira` CLI config per board for cross-instance setups.
- `lane import <board-id>` scaffolds a board config from a real Jira board.
- Cached boot with background refresh on an interval and on terminal focus.
- Command palette (`^P`) with every action, and a shortcut dialog (`?`).
- `lane --mock` opens an offline demo board.

[Unreleased]: https://github.com/candril/lane/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/candril/lane/releases/tag/v0.1.0
