import { theme } from "../theme"

/**
 * Keyboard shortcut dialog (specs/011): a centered modal listing the bindings,
 * opened with `?` and dismissed with `esc` / `?` / `q`. There is no permanent help
 * bar — discovery lives here (and in the command palette). Purely presentational;
 * App owns the open state and the dismiss keys.
 */

type Shortcut = [keys: string, description: string]

interface Group {
  title: string
  items: Shortcut[]
}

const LEFT: Group[] = [
  {
    title: "Navigation",
    items: [
      ["h j k l", "move cursor"],
      ["gg / ⇧G", "jump to top / bottom"],
      ["^D / ^U", "half a screen of stops down / up"],
      ["s", "jump to card / lane · in the viewer: to a link"],
      ["⇧H ⇧L", "move card (change status)"],
      ["⇧J ⇧K", "reorder (rank) · cross the backlog divider"],
      ["h l / ↵", "fold / unfold a lane header or viewer section"],
      ["z a/o/c", "toggle / open / close the fold under the cursor"],
      ["z h", "in the viewer: fold its history"],
      ["z ⇧R ⇧M", "unfold / fold everything"],
      ["c / ⇧C", "collapse column / expand all"],
    ],
  },
  {
    title: "View",
    items: [
      ["v b/l/k", "view: board / list / backlog"],
      ["v o/u/c/g", "sub-tasks: own column / nested / checklist / basket"],
      ["v a/d/n", "children: all / hide done / none"],
      ["g n/p/t/s/r", "group: none/parent/type/swimlanes/sprint"],
      ["t e/l/a", "toggle epic / label / all tags"],
      ["/", "filter this board · in the viewer: its children"],
      ["f a-z", "quick filter (config)"],
      ["⇧F", "filter sub-tasks / follow parent"],
      ["esc", "clear filter"],
    ],
  },
  {
    title: "Tabs",
    items: [
      ["1–9", "jump to tab"],
      ["[ / ]", "previous / next tab"],
      ["⇧T c", "clone tab (keeps the filter)"],
      ["⇧T r/x", "rename / close own tab"],
      ["r", "refresh"],
    ],
  },
  {
    title: "General",
    items: [
      ["^P / ⇧P", "command palette (every action, submenus)"],
      ["?", "this help"],
      ["q / ^C", "quit"],
    ],
  },
]

const RIGHT: Group[] = [
  {
    title: "Issue",
    items: [
      ["n / N", "new (in context / top-level)"],
      ["^T", "cycle type (while creating)"],
      ["↵", "view · in the viewer: open link / show edit as diff"],
      ["j k ^n ^p", "…walk its links, sections and history"],
      ["⌫", "…back out of the viewer"],
      ["e / i", "rename / edit title + body in $EDITOR"],
      ["a", "assign"],
      ["#", "edit labels"],
      ["⇧E", "set / detach epic"],
      ["⇧S", "set status"],
      ["⇧R", "close as… / change why it closed"],
      ["o / O", "open browser / tmux window"],
      ["y / Y", "copy key(s) / URL(s)"],
      ["⇧D / ⇧U", "copy description (markdown) / title(s)"],
      ["space", "mark: bulk copy / edit"],
      ["^A", "mark siblings · again: cell, lane, board"],
      ["⇧V", "visual range (list / viewer) · ⇧V keeps it, esc drops it"],
    ],
  },
  {
    title: "Find",
    items: [
      [":", "search Jira: words, a key, or JQL"],
      ["^A", "…scope: this board ↔ all of Jira"],
      ["↵", "…open the result (description, fields)"],
      ["↑↓ ^y/tab", "…complete an open field (`epic:`, `#`, `@`)"],
      ["^T", "…keep the results as a tab"],
      ["^O", "…open the result in the browser"],
      ["^Y / ^U", "…copy the result's key / URL"],
      ["s", "jump to a visible card / lane"],
    ],
  },
]

const KEY_WIDTH = 10

function Row({ keys, desc }: { keys: string; desc: string }) {
  return (
    <box flexDirection="row">
      <box width={KEY_WIDTH} flexShrink={0}>
        <text fg={theme.secondary}>{keys}</text>
      </box>
      <text fg={theme.text}>{desc}</text>
    </box>
  )
}

function Column({ groups }: { groups: Group[] }) {
  return (
    <box flexDirection="column">
      {groups.map((group) => (
        <box key={group.title} flexDirection="column" marginBottom={1}>
          <text fg={theme.primary}>
            <strong>{group.title}</strong>
          </text>
          {group.items.map(([keys, desc]) => (
            <Row key={keys + desc} keys={keys} desc={desc} />
          ))}
        </box>
      ))}
    </box>
  )
}

export function ShortcutHelp() {
  return (
    <box
      position="absolute"
      width="100%"
      height="100%"
      justifyContent="center"
      alignItems="center"
      zIndex={100}
    >
      <box flexDirection="column" backgroundColor={theme.modalBg} paddingX={3} paddingY={1}>
        <box marginBottom={1}>
          <text fg={theme.text}>
            <strong>Keyboard Shortcuts</strong>
          </text>
        </box>
        <box flexDirection="row">
          <box flexDirection="column" marginRight={4}>
            <Column groups={LEFT} />
          </box>
          <Column groups={RIGHT} />
        </box>
        <text fg={theme.textMuted}>esc · ? · q to close</text>
      </box>
    </box>
  )
}
