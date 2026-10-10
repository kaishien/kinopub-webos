import { describe, expect, it } from 'vitest'
import { FocusMemoryService } from './focus-memory.service'

describe('FocusMemoryService', () => {
  it('remembers the focused key per screen', () => {
    const memory = new FocusMemoryService()

    memory.save('/home', 'row-1-3')
    memory.save('/catalog', 'grid-7')

    expect(memory.restore('/home')).toBe('row-1-3')
    expect(memory.restore('/catalog')).toBe('grid-7')
    expect(memory.restore('/unknown')).toBeUndefined()
  })

  it('overwrites the focused key on save', () => {
    const memory = new FocusMemoryService()

    memory.save('/home', 'a')
    memory.save('/home', 'b')

    expect(memory.restore('/home')).toBe('b')
  })

  it('stores scroll offsets per area and defaults to 0', () => {
    const memory = new FocusMemoryService()

    memory.saveOffset('/home', 'rows', 420)
    memory.saveOffset('/home', 'row-1', 120)

    expect(memory.offset('/home', 'rows')).toBe(420)
    expect(memory.offset('/home', 'row-1')).toBe(120)
    expect(memory.offset('/home', 'row-2')).toBe(0)
    expect(memory.offset('/other', 'rows')).toBe(0)
  })

  it('stores arbitrary screen state and returns undefined when absent', () => {
    const memory = new FocusMemoryService()
    const filters = { genre: 3, year: '2020' }

    memory.saveState('/catalog', 'filters', filters)

    expect(memory.state<typeof filters>('/catalog', 'filters')).toBe(filters)
    expect(memory.state('/catalog', 'missing')).toBeUndefined()
    expect(memory.state('/other', 'filters')).toBeUndefined()
  })

  it('keeps focus, offsets and state of one screen independent from another', () => {
    const memory = new FocusMemoryService()

    memory.save('/a', 'x')
    memory.saveOffset('/b', 'rows', 10)

    expect(memory.restore('/b')).toBeUndefined()
    expect(memory.offset('/a', 'rows')).toBe(0)
  })
})
