---
title: Getting Started
description: From an empty config to a board you can actually work on.
---

lane doesn't discover your boards — you declare them. That sounds like more work than it is, and
it buys you the thing Jira's own board can't give you: exactly the columns you want, on exactly
the issues you care about, across as many projects as you like.

## 1. Steal the config from a real board

If the board already exists in Jira, don't retype it. Find its id (it's in the board URL:
`…/jira/software/projects/SHOP/boards/**1234**`) and ask lane to read it:

```sh
lane import 1234
```

It prints a pasteable block — the board's name, its filter JQL, and its columns with the
statuses that fold into each:

```toml
[[boards]]
name = 'SHOP Team Board'
jql = 'project = SHOP AND type != Epic ORDER BY Rank ASC'

  [[boards.columns]]
  title = 'To Do'
  statuses = ['To Do', 'Selected for Development']

  [[boards.columns]]
  title = 'In Progress'
  statuses = ['In Progress']

  [[boards.columns]]
  title = 'Review'
  statuses = ['In Review', 'Ready to Merge']

  [[boards.columns]]
  title = 'Done'
  statuses = ['Done', 'Closed']
```

Swimlanes aren't exposed by Jira's public Agile API, so those you add by hand.

## 2. Write the config

Put it in `~/.config/lane/config.toml`. The `[jira]` table holds the instance-wide settings every
board shares; each `[[boards]]` entry becomes a tab.

```toml
[jira]
project = "SHOP"
story_points_field = "customfield_10004"

  # Fallback columns, used by any board that doesn't define its own.
  [[jira.columns]]
  title = "To Do"
  statuses = ["To Do", "Selected for Development"]

  [[jira.columns]]
  title = "In Progress"
  statuses = ["In Progress"]

  [[jira.columns]]
  title = "Review"
  statuses = ["In Review", "Ready to Merge"]

  [[jira.columns]]
  title = "Done"
  statuses = ["Done", "Closed"]

[[boards]]
name = "Team Board"
jql = "project = SHOP AND type != Epic AND sprint in openSprints() ORDER BY Rank ASC"
grouping = "parent"
search_scope = "project = SHOP"
```

At least one `[[boards]]` entry is required. If the file is malformed, lane tells you which key
is wrong and carries on with the demo board rather than dying — it never silently ignores a
config it couldn't read.

Now run `lane`.

## 3. Read the board

```text
lane  1 Team Board                                  updated just now · board · by parent · v0.1.0
────────────────────────────────────────────────────────────────────────────────────────────────
TO DO                  IN PROGRESS            REVIEW                 DONE

◆ SHOP-412 Rework       ● SHOP-388 Totals       ▣ SHOP-402 Drop the     ◆ SHOP-371 Ship the
  the checkout           drift on refund  ↑     legacy price API       coupon banner
  summary        ↑ AL                    RH                    ↓ AL                     ○
```

Every card is `type-glyph key summary`, with the priority arrow and an assignee chip on the
right. `◆` story, `●` bug, `▣` task, `❖` epic, `▪` sub-task. A done card has its key struck
through. `○` means unassigned.

The header tells you the tab, when the data was last refreshed, and the current view and
grouping.

## 4. Move around, then move things

| | |
| --- | --- |
| `h` `j` `k` `l` | move the cursor — empty cells included, so one press is always one step |
| `⇧H` `⇧L` | move the card to the previous / next column — a real Jira transition |
| `⇧J` `⇧K` | re-rank it within the column |
| `s` | label every visible card, type the label to jump there |
| `?` | the full shortcut dialog |

Edits are optimistic: the card moves immediately and snaps back if Jira rejects it.

## 5. Narrow it down

`/` filters what's loaded, live, as you type:

```text
/ @me                 what am I on?
/ type:bug -is:done   open bugs
/ #UX epic:SHOP-1      the UX work under one epic
```

`esc` clears it. `⇧F` decides whether sub-tasks are matched on their own merits or inherited
from a matching parent — `@me` usually wants the whole work item, not the two rows with your
name on them.

Bind the ones you type twice a day to a letter:

```toml
[filters]
b = "type:bug -is:done"
m = "@me"
```

Then `f b`, `f m`. See [Filtering & Search](/lane/reference/filtering/) for the full grammar.

## 6. Find what isn't on the board

`:` searches Jira itself, using the same grammar:

```text
: SHOP-412                           jump to a key
: @ada payment                      words and fields
: project = OPS AND labels = infra  or plain JQL
```

`↵` opens the result. `^T` keeps the whole result set as a tab — and once it's a tab, it's a
board: filter it, group it, move cards in it.

## 7. Add more tabs

More `[[boards]]` entries means more tabs; `1`–`9` and `[` / `]` switch between them. A board
that declares `backlog_statuses` also gets a backlog tab for free.

And `⇧T c` clones whatever tab you're on, keeping its filter, into a tab of your own —
`⇧T r` renames it, `⇧T x` closes it. Those survive a restart, as does each tab's view, grouping
and filter.

## Where next

- [Key Bindings](/lane/reference/key-bindings/) — the whole keymap.
- [Configuration](/lane/reference/configuration/) — every TOML key.
- [Views & Tabs](/lane/reference/views/) — board / list / backlog, groupings, sub-task layouts.
