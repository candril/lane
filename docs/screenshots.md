# Screenshots and the demo gif

Every image in the README and on the docs site comes from the offline demo board
(`lane --mock`), so it can be regenerated on any machine without a Jira, and the
same picture comes out twice.

## The automated way

```sh
just shots              # every recipe in docs/shots.txt → site/src/assets/screenshots/
just shots board help   # only those two
```

Needs `tmux` and `python3` with Pillow (`pip install pillow`). Each shot launches a
fresh `lane --mock` in a detached 140×42 tmux pane with throwaway XDG dirs, sends the
recipe's keys, captures the pane with its colours, and renders it in Menlo on the
board's background. The rendered PNGs are what the docs use; the raw captures land in
`$TMPDIR/lane-shots/` if you want to inspect one.

`SHOT_COLS` / `SHOT_ROWS` change the pane size, `SHOT_DIR` the output directory.

## The recipes

`docs/shots.txt` is the playbook: one line per image, `name | keys`. The keys are what
you would press by hand after launching, as tmux `send-keys` tokens — a letter, a
string, `Enter`, `Escape`, `Space`, `C-p`, plus `wait` for a background load. The demo
opens on the Team Board tab, board view, grouped by parent, cursor on the first lane
header; `g n` switches to the flat board and puts the cursor on a card.

| Image | Keys | Shows |
| --- | --- | --- |
| `board` | `g n` | the flat board |
| `board-parent` | — | lanes by parent |
| `board-sprint` | `g r` | lanes by sprint, with dates |
| `board-type` | `g t` | lanes by issue type |
| `swimlanes` | `g s` | JQL swimlanes |
| `list` | `v l g n` | list view |
| `backlog` | `v k` | backlog view |
| `baskets` | `g n v g` | parent baskets |
| `checklist` | `g n v c` | checklist rows inside the parent |
| `under-parent` | `g n v u` | sub-tasks nested under the parent |
| `collapse` | `g n l l c h` | a collapsed column |
| `jump` | `g n s` | flash-jump labels |
| `epics` | `2 wait` | the epic tab |
| `detail` | `g n l ↵` | the issue viewer |
| `history` | `g n l ↵ z h` | …with its history unfolded |
| `diff` | `g n l ↵ z h ⇧G k ↵` | a description edit as a diff |
| `status` / `assign` / `labels` / `close-reason` | `g n l` then `⇧S` / `a` / `#` / `⇧R` | the pickers |
| `create` | `g n l n` | the create prompt |
| `multiselect` | `v l g n space j space j j ⇧V j` | marked rows and a visual range |
| `filter` | `g n / @me -is:done` | the filter bar and a narrowed board |
| `search` | `g n : order` | the search prompt with results |
| `palette` | `g n l ^P` | the command palette |
| `help` | `?` | the shortcut dialog |
| `tabs` | `⇧T c` | a cloned tab in the tab bar |

## By hand

If you'd rather screenshot a real terminal (nicer font, your own theme), `just shot`
opens the same demo with isolated state and the version pinned to `0.1.0`, at whatever
size the window is. Set it to 140×42 cells so the framing matches, follow a recipe from
the table, and save the image under the same name in `site/src/assets/screenshots/`.

## The demo gif

```sh
just demo-gif         # → site/src/assets/lane-demo.gif
```

Same machinery: `docs/demo.txt` is a list of `hold | keys | keycap | caption` steps,
`scripts/demo.sh` plays them into one `lane --mock` session, captures a frame after
each, and the renderer assembles the frames into a GIF at half size.

The keycap and caption are drawn on a translucent panel low over the frame — without
them the tour is a board flickering through states nobody can name — so every step says
which keys were pressed and what they did. Give every step a caption: a step without one
drops the panel, and it reads as a glitch.

`hold` is seconds, or `auto` to derive the dwell from the caption's word count. Prefer
`auto`: a caption nobody can finish reading is the same as no caption, and a hand-picked
number goes stale the moment the wording changes. Keep captions short — every word is
dwell time, and a minute is already a long loop for a README.

A step whose keys are only cursor or move keys (`h j k l ⇧H ⇧J ⇧K ⇧L`) gets the card
under the cursor ringed in amber, with an arrow from where it was in the previous frame.
A card changing column is otherwise a jump cut between two dense stills, and no amount of
extra dwell tells you which of a hundred cards moved. Fold `Escape` into the next step's
keys rather than spending a frame on it.

Edit the steps to change the tour; it comes out identical every time.
