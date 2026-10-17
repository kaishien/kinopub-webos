import { describe, expect, it } from 'vitest'
import type { Item } from '@/services/api/api.types'
import { StorageService } from '@/services/storage/storage.service'
import { LocalHistoryService, type LocalHistoryRecord } from './local-history.service'

const item = (id: number) =>
  ({ id, title: `Item ${id}`, type: 'serial', seasons: [{ id: 1, number: 1, episodes: [] }], videos: [] }) as unknown as Item
const record = (id: number, extra: Partial<LocalHistoryRecord> = {}): LocalHistoryRecord => ({
  item: item(id),
  videoId: id * 100,
  season: 1,
  episode: 1,
  episodeTitle: '',
  time: 600,
  duration: 2700,
  ...extra,
})

describe('LocalHistoryService', () => {
  it('starts empty and keeps entries on the device, without the item videos and seasons', () => {
    const storage = new StorageService()
    const history = new LocalHistoryService(storage)

    expect(history.entries).toEqual([])
    expect(history.resumable).toBeNull()

    history.remember(record(7))

    expect(history.entries[0]).toMatchObject({ videoId: 700, time: 600, finished: false, item: { id: 7, title: 'Item 7' } })
    expect(history.entries[0].item).not.toHaveProperty('seasons')
    expect(new LocalHistoryService(storage).entries).toEqual(history.entries)
  })

  it('keeps one entry per title, newest first, and at most 20 titles', () => {
    const history = new LocalHistoryService(new StorageService())

    for (let id = 1; id <= 22; id++) history.remember(record(id))
    history.remember(record(5, { episode: 4, time: 30 }))

    expect(history.entries).toHaveLength(20)
    expect(history.entries.map((e) => e.item.id).slice(0, 3)).toEqual([5, 22, 21])
    expect(history.entries.filter((e) => e.item.id === 5)).toHaveLength(1)
    expect(history.entries[0]).toMatchObject({ episode: 4, time: 30 })
    expect(history.entries.map((e) => e.item.id)).not.toContain(1)
  })

  it('offers the newest unfinished title to continue', () => {
    const history = new LocalHistoryService(new StorageService())

    history.remember(record(1))
    history.remember(record(2, { finished: true, time: 2700 }))

    expect(history.entries.map((e) => e.item.id)).toEqual([2, 1])
    expect(history.resumable?.item.id).toBe(1)
  })
})
