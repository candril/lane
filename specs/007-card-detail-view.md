# Issue Detail View

**Status**: Implemented (P1 + most of P2)

## Description

A full-screen viewer for one work item — its fields, and its description rendered as
Markdown — opened with `↵` from wherever the cursor is (originally `⇧V`; rebound by
[055](./055-multi-select-copy.md), which took `⇧V` for the visual range). Today lane
shows an issue only
as a card: a summary line plus decorations. Everything else the issue actually says
lives in the browser, so reading a ticket means leaving the terminal. The `lane view`
CLI subcommand ([`src/index.tsx`](../src/index.tsx)) already dumps an issue as plain
text for a pager; this makes that a first-class view.

The viewer is a *host*, not a new editor. The field editors already exist as pickers —
`⇧S` status ([041](./041-set-status.md)), `a` assign ([027](./027-assign-issue-to-user.md)),
`#` labels ([028](./028-change-labels.md)), `⇧E` epic ([038](./038-change-epic.md)),
`e` rename ([012](./012-create-and-edit-items.md)) — and they keep working unchanged
while the viewer is open, mutating through the same optimistic path. Editing the
description as prose is [049](./049-edit-in-editor.md), built on this.

The motivating use: triage. Read the ticket and set its fields without a browser and
without leaving the board.

> This spec was originally a thin "Card Detail View" draft from the 000–007 scaffold. It
> was rewritten once the field editors and the Jira provider existed, so the viewer could
> be designed to reuse them rather than duplicate them.

## Capabilities

### P1 — Must Have

- **`↵` opens the viewer** for the issue under the cursor — a focused card or a
  list/backlog row — from every view. (Originally `⇧V`, split on shift from the `v`
  view chord ([017](./017-view-modes.md)); [055](./055-multi-select-copy.md) rebound it.)
- **Takes over the content region**, with the app header (tabs, toasts) still above it
  and the bottom prompts still below — see Decisions. The view underneath keeps its
  state: `esc` / `q` / `⌫` / `↵` closes and returns the cursor exactly where it was. Lean
  chrome: a background and padding, no borders, like the other overlays.
- **Header block**: key, summary, issue type, status, priority, assignee, labels, epic,
  points — the same facts the card carries, laid out to be read rather than scanned.
- **Description rendered as Markdown** in a `<scrollbox>`, using OpenTUI's `<markdown>`
  renderable. `^d`/`^u`/`gg`/`⇧G` scroll it — originally `j`/`k` too, until
  [057](./057-detail-navigation.md) took those for the viewer's own cursor.
- **Lazy per-issue fetch.** The board query deliberately omits `description`
  (`LIST_FIELDS`, [`providers/jira.ts`](../src/providers/jira.ts)) because it is heavy;
  the viewer fetches the single issue on open via a new `loadIssue` provider method, and
  caches it per key for the session. A visible loading state while it is in flight — the
  header renders immediately from board state, the body fills in.
- **ADF → Markdown on read.** Jira v3 returns `description` as Atlassian Document
  Format; the viewer converts it to Markdown for display (see Technical Notes).
- **The field editors work inside the viewer**: `⇧S`, `a`, `#`, `⇧E`, `e` open their
  existing prompts below it. The viewer re-reads its task from board state afterwards,
  so a status set is visible immediately in the header.

### P2 — Should Have

- **`o` / `y` / `⇧Y`** — open in the browser, copy key, copy URL — matching the board
  ([014](./014-issue-actions.md)).
- **Sub-task list** in the header block for a parent issue, and the parent link for a
  sub-task. Both are already known to the board, so this is presentation only.
- **`[` / `]` step to the previous / next issue** in the current view without closing —
  the viewer becomes a reading mode over a filtered list, not a single-shot lookup.
  Not built: those keys still switch tabs, and doing so closes the viewer rather than
  stranding it on an issue the new tab may not hold.

### P3 — Nice to Have

- ~~Syntax-highlighted fenced code blocks via OpenTUI's tree-sitter client.~~ Built,
  because it had to be — see Markdown rendering.
- A `r` that refetches the open issue, bypassing the session cache.

## Out of Scope

- **Editing the summary and description as prose** — [049](./049-edit-in-editor.md).
  The viewer renders them; that spec hands them to `$EDITOR`.
- **Comments.** Reading, adding, and replying to a comment thread is its own feature: a
  second fetch, its own scroll and selection model, and a write path that depends on
  [049](./049-edit-in-editor.md)'s Markdown → ADF converter. Its own spec once both are
  built.
- **Attachments and media.** Rendered as a placeholder line, never fetched.
- **Editing fields the board cannot already set** (components, fix version, sprint,
  custom fields). The viewer hosts the editors that exist; it does not add new ones.
- **A side-by-side detail pane** that tracks the board cursor. Considered and rejected
  for now: it costs real layout work and squeezes narrow terminals, and the overlay
  answers the motivating use.

## Technical Notes

### The ADF problem

`description` is not text on either Jira API, and neither shape is Markdown:

- **v3** returns **ADF** — a JSON document tree.
- **v2** returns **Jira wiki markup** — `h1.` not `#`, `*bold*` not `**bold**`, `{code}`
  not fences, and `#` means *ordered list*. Feeding it to `<markdown>` renders wrong.

A converter is needed either way, so the provider stays on v3 throughout (every other
call already is) and lane owns the conversion. `adfToMarkdown(doc)` covers paragraph,
heading, list, code block, blockquote, rule, table, link, mention, emoji, status
lozenge, hard break, and the inline marks. It also returns the set of node types it
could **not** represent — unused here, but it is what gates the read-only guard in
[049](./049-edit-in-editor.md), so it is part of the P1 signature from the start.

Pure and I/O-free, unit-tested like [`filter.ts`](../src/filter.ts) and
[`grouping.ts`](../src/grouping.ts). The `lane view` CLI subcommand then drops its v2
special case and shares the converter.

### Markdown rendering

`@opentui/core` ships `MarkdownRenderable` (marked-based, incremental parse, tables,
`conceal`) and `@opentui/react` registers it as the `<markdown>` intrinsic.
`syntaxStyle` is a **required** prop, so a module-level `SyntaxStyle.fromStyles(…)` is
derived from [`theme.ts`](../src/theme.ts) — keeping the "no hardcoded colours in
components" rule.

A **`treeSitterClient` is required too**, though the type says otherwise: the renderable
paints its prose blocks from tree-sitter highlights and, having none, draws nothing at
all — a description renders as the right number of blank lines. It is not an enhancement
for fenced code; it is what makes text appear. Highlighting is asynchronous and the
renderable calls `requestRender` when it lands, so the first paint of a description is a
frame or two behind the viewer opening.

That dependency reaches into the build. Highlighting runs in a worker, and `new Worker(…)`
inside a dependency is not something the bundler can follow, so a plain
`bun build --compile` ships a binary with no worker in it. Every highlight then fails,
the renderable falls back to plain text, and descriptions render as **raw Markdown** —
`**bold**` and all — while the same code from source renders correctly. The build passes
the worker as a second entrypoint so it is bundled with its own dependencies, and hands
OpenTUI the in-binary path through the `OTUI_TREE_SITTER_WORKER_PATH` constant it reads;
see [`scripts/build.ts`](../scripts/build.ts). The grammar `.wasm` and query files need no
special handling — they are ordinary file imports the bundler does follow.

### Hosting the field editors

The viewer is **not** fully modal like
[`ShortcutHelp`](../src/components/ShortcutHelp.tsx), because `⇧S`/`a`/`#`/`⇧E` must
still open their pickers over it. Those handlers key off `ctx.currentKey`, which today
comes from the board cursor. The seam: while the viewer is open, `currentKey` resolves
to the viewer's issue. Every existing action then works unchanged, no mutation logic is
duplicated, and the viewer re-reads its task from board state after the optimistic
update.

Overlay precedence in [`useBoardKeymap.ts`](../src/useBoardKeymap.ts) puts the viewer
*below* the pickers and prompts (they own the keyboard while open) and *above* the
per-view keys.

### Provider seam

One new optional method on `BoardProvider`, optional so the mock and query-backed tabs
([047](./047-query-backed-tabs.md)) degrade rather than break:

- `loadIssue?(key): Promise<IssueDetail>` — the board fields plus `description`.
  Absent → `⇧V` shows only what the board already knows, with no description.

The mock grows a `description` on a few tasks so the viewer is developable offline.
`Task` itself gains **no** `description` field: it is per-issue, lazily fetched, and
would otherwise imply the board query carries it.

## Keyboard

| Key | Action |
|-----|--------|
| `↵` | open the viewer on the focused issue (also closes it) — was `⇧V`, see [055](./055-multi-select-copy.md) |
| `esc` `q` `⌫` | close (`⌫` reads as "back"; it beats the filter clear while the viewer is up) |
| `^d` `^u` `gg` `⇧G` | scroll the description (`j`/`k` select instead — [057](./057-detail-navigation.md)) |
| `e` `⇧S` `a` `#` `⇧E` | rename / status / assign / labels / epic — the existing editors |
| `o` `y` `⇧Y` | browser / copy key / copy URL (P2) |
| `[` `]` | previous / next issue in the current view (P2) |

## File Structure

| File | Change |
|------|--------|
| `src/adf.ts` | **new** — `adfToMarkdown`, plus the unsupported-node set; pure |
| `src/adf.test.ts` | **new** — node coverage against real ADF payloads |
| `src/components/IssueDetail.tsx` | **new** — the overlay: header, fields, `<scrollbox><markdown/>` (its hint line was dropped with [057](./057-detail-navigation.md): help lives in `?` and the palette, [011](./011-shortcut-dialog.md)) |
| `src/useIssueDetail.ts` | **new** — open/close state, lazy fetch, per-key cache |
| `src/markdown-style.ts` | **new** — `SyntaxStyle` derived from `theme.ts`, plus the shared tree-sitter client |
| `src/useDialogs.ts` | `viewing` handle alongside the other overlays |
| `src/useBoardKeymap.ts` | `⇧V` open/close, scroll keys, overlay precedence |
| `src/App.tsx` | render the overlay; resolve `currentKey` to the viewer's issue |
| `src/providers/provider.ts` | `loadIssue?`, `IssueDetail` type |
| `src/providers/jira.ts` | single-issue fetch including `description` |
| `src/providers/mock.ts` | descriptions on sample tasks; implement `loadIssue` |
| `src/index.tsx` | `lane view` shares the ADF converter; drop the v2 special case |
| `src/components/ShortcutHelp.tsx` | `⇧V` in the Issue group |
| `scripts/build.ts` | **new** — bundle the tree-sitter worker into the binary; stamp the version |
| `package.json` / `justfile` / `tsconfig.json` | build through the script; lint, format and typecheck `scripts/` |

## Decisions (as built)

- **The viewer takes the content region; it is not an absolute overlay.** As one, it
  painted over the bottom prompts — so `⇧S` opened the status picker *behind* the very
  view that exists to host it. Rendering it where the board renders keeps the app header
  (tabs, toasts) in place and lets every prompt open below it, as it does everywhere
  else.
- **The tree-sitter client is mandatory**, not the optional nicety its type suggests
  (see Markdown rendering above) — and making it work in the shipped binary meant
  replacing `bun build --compile` with [`scripts/build.ts`](../scripts/build.ts). Found
  the hard way: the viewer rendered correctly from source and as raw Markdown from the
  installed binary.
- **`LANE_VERSION` is now actually injected.** `version.ts` had always documented it as
  a build-time define, but nothing defined it, so a released binary shelled out to git at
  startup and reported whichever repo it was run from as `dev-<hash>`. The new build
  script stamps `<package version>+<commit>`.

## Open Questions

- ~~**Does `@opentui/core` 0.1.87 actually ship the Markdown renderable?**~~
  **Resolved:** yes — `MarkdownRenderable` and `SyntaxStyle` are exported, and
  `@opentui/react` registers `markdown` as an intrinsic (next to `code` and `diff`) at
  the pinned version.
- ~~**Does `<markdown>` behave inside a `<scrollbox>`?**~~ **Resolved:** yes —
  paragraphs, headings, lists, fenced code and tables all lay out and scroll correctly
  at the pinned version, once a `treeSitterClient` is supplied.
- ~~**Does the tree-sitter grammar need a network fetch?**~~ **Resolved:** no. The
  markdown and markdown-inline grammars ship inside `@opentui/core`
  (`assets/markdown/*.wasm`) and load from disk in well under 100ms, so `--mock` stays
  genuinely offline.
- **Is a session-lifetime cache right, or should the fetch be re-run on reopen?** A
  description edited elsewhere would go stale. Leaning: cache, with P3's `r` as the
  escape hatch. Resolve once the viewer has been used against a live board.
