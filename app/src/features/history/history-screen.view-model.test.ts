import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HistoryEntry, HistoryPage, ItemShort } from '@/services/api/api.types'
import type { Services } from '@/services/services'
import { fakeServices, flush, type FakeServices } from '@/test/fake-services'
import { HistoryScreenViewModel } from './history-screen.view-model'

/** FakeServices is not assignable to Services (see src/test/fake-services.ts); view-models only use what the fake provides. */
const svc = (s: FakeServices) => s as unknown as Services

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

describe('HistoryScreenViewModel', () => {
  let services: FakeServices

  beforeEach(() => {
    services = fakeServices()
  })

  it('flattens entries into items and formats a subtitle per item', async () => {
    services.api.history.mockResolvedValue(page([entry(1, 3725, { number: 3, snumber: 2 }), entry(2, 95)], 1, 1))
    const vm = new HistoryScreenViewModel(svc(services))

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
    const vm = new HistoryScreenViewModel(svc(services))

    await vi.waitFor(() => expect(vm.items).toHaveLength(2))
    vm.loadMore()
    await vi.waitFor(() => expect(vm.items.map((i) => i.id)).toEqual([1, 2, 3]))
    vm.loadMore()
    await flush()
    expect(services.api.history).toHaveBeenCalledTimes(2)
    vm.dispose()
  })
})
