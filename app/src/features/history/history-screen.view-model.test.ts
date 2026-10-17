import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HistoryEntry, HistoryPage, ItemShort } from '@/services/api/api.types'
import { fakeServices, flush, type FakeServices } from '@/test/fake-services'
import { HistoryScreenViewModel } from './history-screen.view-model'

const item = (id: number): ItemShort => ({
  id,
  type: 'movie',
  subtype: '',
  title: `Item ${id}`,
  year: 2024,
  posters: { small: '', medium: '', big: '' },
})

function entry(id: number, time: number, media?: { number: number; snumber: number }): HistoryEntry {
  return {
    time,
    counter: 1,
    first_seen: 0,
    last_seen: 0,
    item: item(id),
    media: { id, number: media?.number ?? 1, snumber: media?.snumber ?? 0, title: '', duration: 0 },
  }
}

const page = (entries: HistoryEntry[], current: number, total: number): HistoryPage => ({
  history: entries,
  pagination: { current, total, perpage: entries.length, total_items: 0 },
})

function watchedHere(
  services: FakeServices,
  id: number,
  extra: { season?: number; episode?: number; time?: number; finished?: boolean } = {},
) {
  services.localHistory.remember({
    item: item(id),
    videoId: id * 100,
    season: extra.season ?? 0,
    episode: extra.episode ?? 1,
    episodeTitle: '',
    time: extra.time ?? 0,
    duration: 5400,
    finished: extra.finished,
  })
}

describe('HistoryScreenViewModel', () => {
  let services: FakeServices

  beforeEach(() => {
    services = fakeServices()
  })

  describe("with this TV's own history", () => {
    it('lists the device titles first, newest first, then the account history without those titles', async () => {
      watchedHere(services, 3, { season: 1, episode: 4, time: 754 })
      watchedHere(services, 9, { finished: true })
      services.api.history.mockResolvedValue(page([entry(1, 95), entry(3, 10), entry(2, 30), entry(9, 60)], 1, 1))
      const vm = new HistoryScreenViewModel(services)

      await flush()
      expect(vm.items.map((i) => i.id)).toEqual([9, 3, 1, 2])
      expect(vm.subtitle(item(3))).toBe('S1 E4 · 12:34')
      expect(vm.subtitle(item(9))).toBe('просмотрено')
      expect(vm.subtitle(item(1))).toBe('01:35')
      vm.dispose()
    })

    it('still shows the device titles when the account history fails to load', async () => {
      watchedHere(services, 3, { time: 60 })
      services.api.history.mockRejectedValue(new Error('offline'))
      const vm = new HistoryScreenViewModel(services)

      await flush()
      expect(vm.items.map((i) => i.id)).toEqual([3])
      vm.dispose()
    })
  })

  it('flattens entries into items and formats a subtitle per item', async () => {
    services.api.history.mockResolvedValue(page([entry(1, 3725, { number: 3, snumber: 2 }), entry(2, 95)], 1, 1))
    const vm = new HistoryScreenViewModel(services)

    await vi.waitFor(() => expect(vm.entries).toHaveLength(2))
    expect(services.api.history).toHaveBeenCalledWith(1, expect.any(AbortSignal))
    expect(vm.items.map((i) => i.id)).toEqual([1, 2])
    expect(vm.subtitle(vm.items[0])).toBe('S2 E3 · 1:02:05')
    expect(vm.subtitle(vm.items[1])).toBe('01:35')
    expect(vm.subtitle(item(99))).toBeUndefined()
    vm.dispose()
  })

  it('loads more pages while the pagination says there are some', async () => {
    services.api.history.mockImplementation((pageNo: number) =>
      Promise.resolve(pageNo === 2 ? page([entry(3, 10)], 2, 2) : page([entry(1, 10), entry(2, 10)], 1, 2)),
    )
    const vm = new HistoryScreenViewModel(services)

    await vi.waitFor(() => expect(vm.items).toHaveLength(2))
    vm.loadMore()
    await vi.waitFor(() => expect(vm.items.map((i) => i.id)).toEqual([1, 2, 3]))
    vm.loadMore()
    await flush()
    expect(services.api.history).toHaveBeenCalledTimes(2)
    vm.dispose()
  })
})
