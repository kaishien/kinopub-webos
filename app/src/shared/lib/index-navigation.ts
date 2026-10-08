import type { NextFocusResolver } from '@noriginmedia/norigin-spatial-navigation'

export const itemFocusKey = (groupKey: string, index: number) => `${groupKey}-${index}`

function indexOf(groupKey: string, focusKey: string): number {
  return Number(focusKey.slice(groupKey.length + 1))
}

function pick(groupKey: string, index: number | null, siblings: Parameters<NextFocusResolver>[2]) {
  if (index === null) return null

  const key = itemFocusKey(groupKey, index)

  return siblings.find((sibling) => sibling.focusKey === key) ?? null
}

/** Up/down return `null` so norigin moves on to the neighboring rows. */
export function rowNavigation(groupKey: string): NextFocusResolver {
  return (direction, focusKey, siblings) => {
    const index = indexOf(groupKey, focusKey)

    if (direction === 'left') return pick(groupKey, index - 1, siblings)
    if (direction === 'right') return pick(groupKey, index + 1, siblings)

    return null
  }
}

/** Down into a short last row lands on its last item; past the edges returns `null` so the parent decides (filters above, rail on the left). */
export function gridNavigation(groupKey: string, columns: number, count: () => number): NextFocusResolver {
  return (direction, focusKey, siblings) => {
    const index = indexOf(groupKey, focusKey)
    const total = count()
    const column = index % columns
    let next: number | null = null

    if (direction === 'left') next = column > 0 ? index - 1 : null
    else if (direction === 'right') next = column < columns - 1 && index + 1 < total ? index + 1 : null
    else if (direction === 'up') next = index >= columns ? index - columns : null
    else if (direction === 'down') {
      const lastRow = Math.floor((total - 1) / columns)

      if (Math.floor(index / columns) < lastRow) next = Math.min(index + columns, total - 1)
    }

    return pick(groupKey, next, siblings)
  }
}
