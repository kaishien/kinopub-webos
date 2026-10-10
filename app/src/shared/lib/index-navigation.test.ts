import type { FocusableComponent } from '@noriginmedia/norigin-spatial-navigation'
import { describe, expect, it } from 'vitest'
import { gridNavigation, itemFocusKey, rowNavigation } from './index-navigation'

function siblingsOf(groupKey: string, count: number): FocusableComponent[] {
  return Array.from({ length: count }, (_, index) => ({ focusKey: itemFocusKey(groupKey, index) }) as FocusableComponent)
}

const keyOf = (component: FocusableComponent | null) => component?.focusKey ?? null

describe('itemFocusKey', () => {
  it('joins the group key and the index', () => {
    expect(itemFocusKey('row-1', 4)).toBe('row-1-4')
  })
})

describe('rowNavigation', () => {
  const siblings = siblingsOf('row', 3)
  const resolve = rowNavigation('row')

  it('moves left and right between neighbours', () => {
    expect(keyOf(resolve('right', 'row-0', siblings))).toBe('row-1')
    expect(keyOf(resolve('left', 'row-2', siblings))).toBe('row-1')
  })

  it('returns null past the edges', () => {
    expect(resolve('left', 'row-0', siblings)).toBeNull()
    expect(resolve('right', 'row-2', siblings)).toBeNull()
  })

  it('returns null for up and down so norigin picks the neighbouring row', () => {
    expect(resolve('up', 'row-1', siblings)).toBeNull()
    expect(resolve('down', 'row-1', siblings)).toBeNull()
  })

  it('handles group keys containing dashes and multi-digit indexes', () => {
    const wide = siblingsOf('top-10', 12)

    expect(keyOf(rowNavigation('top-10')('right', 'top-10-10', wide))).toBe('top-10-11')
  })
})

describe('gridNavigation', () => {
  // 3 columns, 7 items: rows [0 1 2] [3 4 5] [6]
  const siblings = siblingsOf('grid', 7)
  const resolve = gridNavigation('grid', 3, () => 7)

  it('moves within a row and stops at the row edges', () => {
    expect(keyOf(resolve('right', 'grid-0', siblings))).toBe('grid-1')
    expect(keyOf(resolve('left', 'grid-1', siblings))).toBe('grid-0')
    expect(resolve('left', 'grid-3', siblings)).toBeNull()
    expect(resolve('right', 'grid-2', siblings)).toBeNull()
  })

  it('does not move right past the last item in a short last row', () => {
    expect(resolve('right', 'grid-6', siblings)).toBeNull()
  })

  it('moves up and down by a column', () => {
    expect(keyOf(resolve('down', 'grid-1', siblings))).toBe('grid-4')
    expect(keyOf(resolve('up', 'grid-4', siblings))).toBe('grid-1')
  })

  it('returns null above the first row and below the last row', () => {
    expect(resolve('up', 'grid-1', siblings)).toBeNull()
    expect(resolve('down', 'grid-6', siblings)).toBeNull()
  })

  it('lands on the last item when moving down into a short last row', () => {
    expect(keyOf(resolve('down', 'grid-5', siblings))).toBe('grid-6')
    expect(keyOf(resolve('down', 'grid-4', siblings))).toBe('grid-6')
  })

  it('reads the count lazily so it follows a growing list', () => {
    let count = 3
    const lazy = gridNavigation('grid', 3, () => count)

    expect(lazy('down', 'grid-0', siblings)).toBeNull()

    count = 7
    expect(keyOf(lazy('down', 'grid-0', siblings))).toBe('grid-3')
  })

  it('returns null when the target is not among the rendered siblings', () => {
    expect(resolve('down', 'grid-0', siblings.slice(0, 2))).toBeNull()
  })
})
