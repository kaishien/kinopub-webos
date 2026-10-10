import { describe, expect, it, vi } from 'vitest'
import { StorageService } from './storage.service'

describe('StorageService', () => {
  it('stores values as JSON under the kp: prefix', () => {
    const storage = new StorageService()

    storage.set('answer', { n: 42 })

    expect(localStorage.getItem('kp:answer')).toBe('{"n":42}')
    expect(storage.get('answer', null)).toEqual({ n: 42 })
  })

  it('returns the fallback for a missing key', () => {
    expect(new StorageService().get('missing', 'default')).toBe('default')
  })

  it('returns the fallback when the stored value is not valid JSON', () => {
    localStorage.setItem('kp:broken', '{not json')

    expect(new StorageService().get('broken', [])).toEqual([])
  })

  it('removes only the prefixed key', () => {
    const storage = new StorageService()

    storage.set('a', 1)
    storage.set('b', 2)
    storage.remove('a')

    expect(storage.get('a', 'gone')).toBe('gone')
    expect(storage.get('b', 0)).toBe(2)
  })

  it('falls back and does not throw when localStorage throws', () => {
    const storage = new StorageService()

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(storage.get('x', 'fallback')).toBe('fallback')
    expect(() => storage.set('x', 1)).not.toThrow()
    expect(() => storage.remove('x')).not.toThrow()
  })
})
