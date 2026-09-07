/**
 * Where a ⇧J/⇧K lands (specs/056): which issues move, and the sibling they are ranked
 * against. Shared by the board, the list views and the viewer's children, because a
 * reorder that means one thing in a column and another in a list is a reorder nobody
 * can predict.
 *
 * Marked issues move as one block, in board order, gathered at the cursor: the block
 * lands one non-moving sibling further in `direction` than the cursor sat. A scattered
 * selection therefore ends up contiguous on the first press and steps as a unit after
 * that — the alternative, each mark stepping past its own neighbour, keeps the set
 * scattered forever and reads as several unrelated cards twitching at once.
 */
export interface RankPlan<T> {
  /** The issues to move, in the order they are drawn — one, or the marked block. */
  keys: string[]
  /** They land before this sibling when `direction` is -1, after it when 1. */
  neighbor: T
}

export function rankPlan<T>(
  items: T[],
  cursor: number,
  direction: -1 | 1,
  of: {
    key: (item: T) => string
    /** Same hierarchy level as the cursor's item — ranking crosses no level. */
    sibling: (item: T, cursorItem: T) => boolean
    marked: (item: T) => boolean
  },
): RankPlan<T> | null {
  const focused = items[cursor]
  if (!focused) {
    return null
  }
  const sibling = (item: T) => of.sibling(item, focused)
  const block = items.filter((item) => sibling(item) && of.marked(item))
  const moving = block.length > 0 ? block : [focused]
  const movingKeys = new Set(moving.map(of.key))
  // Start at the cursor's own card when it is not one of the movers — "bring the
  // marked ones here" — and one past it when it is, since it cannot anchor itself.
  let at = movingKeys.has(of.key(focused)) ? cursor + direction : cursor
  while (items[at] && (!sibling(items[at]!) || movingKeys.has(of.key(items[at]!)))) {
    at += direction
  }
  const neighbor = items[at]
  // Nothing that way: the block is already at that end of its siblings, so there is
  // nothing to rank against and the cursor stays put.
  return neighbor ? { keys: moving.map(of.key), neighbor } : null
}
