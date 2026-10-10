import { autorun, observable } from 'mobx'
import { describe, expect, it, vi } from 'vitest'
import { VirtualList } from './virtual-list'

function create(options: { count?: number; offset?: number; horizontal?: boolean; overscan?: number } = {}) {
  const count = observable.box(options.count ?? 100)
  const offset = observable.box(options.offset ?? 0)
  const list = new VirtualList({
    count: () => count.get(),
    step: 100,
    viewport: 500,
    offset: () => offset.get(),
    horizontal: options.horizontal,
    overscan: options.overscan ?? 1,
  })

  return { list, count, offset }
}

const indexes = (list: VirtualList) => list.items.map((item) => item.index)

describe('VirtualList', () => {
  it('renders the visible window plus overscan at the start', () => {
    const { list } = create()

    expect(indexes(list)).toEqual([0, 1, 2, 3, 4, 5])
    expect(list.lastIndex).toBe(5)
    expect(list.totalSize).toBe(100 * 100)
    expect(list.items[0]).toMatchObject({ index: 0, start: 0, end: 100, size: 100 })
  })

  it('honours the initial offset', () => {
    const { list } = create({ offset: 2000 })

    expect(indexes(list)).toEqual([19, 20, 21, 22, 23, 24, 25])
  })

  it('moves the window when the offset changes', () => {
    const { list, offset } = create()

    offset.set(1000)

    expect(indexes(list)).toEqual([9, 10, 11, 12, 13, 14, 15])
    expect(list.lastIndex).toBe(15)
  })

  it('clamps the window to the end of the list', () => {
    const { list, offset } = create()

    offset.set(9500)

    expect(indexes(list)).toEqual([94, 95, 96, 97, 98, 99])
    expect(list.lastIndex).toBe(99)
  })

  it('applies the overscan on both sides', () => {
    const { list } = create({ offset: 1000, overscan: 3 })

    expect(indexes(list)).toEqual([7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17])
  })

  it('follows count changes', () => {
    const { list, count } = create()

    count.set(3)

    expect(indexes(list)).toEqual([0, 1, 2])
    expect(list.lastIndex).toBe(2)
    expect(list.totalSize).toBe(300)

    count.set(0)
    expect(list.items).toEqual([])
    expect(list.lastIndex).toBe(-1)
    expect(list.totalSize).toBe(0)

    count.set(50)
    expect(indexes(list)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('works horizontally', () => {
    const { list, offset } = create({ horizontal: true })

    expect(indexes(list)).toEqual([0, 1, 2, 3, 4, 5])
    offset.set(700)
    expect(indexes(list)).toEqual([6, 7, 8, 9, 10, 11, 12])
    expect(list.totalSize).toBe(10_000)
  })

  it('is observable: reactions run when the window changes', () => {
    const { list, offset, count } = create()
    const seen = vi.fn()
    const dispose = autorun(() => seen(list.lastIndex))

    expect(seen).toHaveBeenLastCalledWith(5)

    offset.set(1000)
    expect(seen).toHaveBeenLastCalledWith(15)

    count.set(12)
    expect(seen).toHaveBeenLastCalledWith(11)
    dispose()
  })

  it('stops following inputs after dispose', () => {
    const { list, offset, count } = create()

    list.dispose()
    offset.set(3000)
    count.set(10)

    expect(indexes(list)).toEqual([0, 1, 2, 3, 4, 5])
    expect(list.totalSize).toBe(10_000)
  })
})
