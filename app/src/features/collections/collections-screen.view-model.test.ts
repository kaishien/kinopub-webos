import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Collection } from '@/services/api/api.types'
import type { RouterService } from '@/services/router/router.service'
import type { Services } from '@/services/services'
import { fakeServices, flush, type FakeServices } from '@/test/fake-services'
import { CollectionsScreenViewModel } from './collections-screen.view-model'

/** FakeServices is not assignable to Services (see src/test/fake-services.ts); view-models only use what the fake provides. */
const svc = (s: FakeServices) => s as unknown as Services

/** RouterService methods are MobX-bound (non-configurable) so they cannot be spied; a class instance (not a plain object) survives makeAutoObservable untouched. */
class StubRouter {
  constructor(readonly navigate: ReturnType<typeof vi.fn>) {}
}

const posters = { small: 's', medium: 'm', big: 'b' }
const collection = (id: number, views: number): Collection => ({
  id,
  title: `Подборка ${id}`,
  watchers: 0,
  views,
  created: 0,
  updated: 0,
  posters,
})
const page = (items: Collection[], current: number, total: number) => ({
  items,
  pagination: { current, total, perpage: items.length, total_items: 0 },
})

describe('CollectionsScreenViewModel', () => {
  let services: FakeServices

  beforeEach(() => {
    services = fakeServices()
  })

  it('maps collections to cards with a views subtitle', async () => {
    services.api.collections.mockResolvedValue(page([collection(1, 1), collection(2, 3), collection(3, 25)], 1, 1))
    const vm = new CollectionsScreenViewModel(svc(services))

    await vi.waitFor(() => expect(vm.cards).toHaveLength(3))
    expect(services.api.collections).toHaveBeenCalledWith(1, expect.any(AbortSignal))
    expect(vm.cards[0]).toMatchObject({ id: 1, type: 'collection', title: 'Подборка 1', posters, year: 0 })
    expect(vm.cards.map(vm.subtitle)).toEqual(['1 просмотр', '3 просмотра', '25 просмотров'])
    expect(vm.subtitle({ id: 9, type: 'collection', subtype: '', title: '', year: 0, posters })).toBe('0 просмотров')
    vm.dispose()
  })

  it('opens a collection with its title in the navigation state', async () => {
    // RouterService.navigate is a MobX-bound action (non-configurable), so a stub replaces spying.
    const navigate = vi.fn()

    services = fakeServices({ router: new StubRouter(navigate) as unknown as RouterService })
    services.api.collections.mockResolvedValue(page([collection(5, 0)], 1, 1))
    const vm = new CollectionsScreenViewModel(svc(services))

    await vi.waitFor(() => expect(vm.cards).toHaveLength(1))
    vm.open(vm.cards[0])
    expect(navigate).toHaveBeenCalledWith('/collections/5', { state: { title: 'Подборка 5' } })
    vm.dispose()
  })

  it('loads the next page once', async () => {
    services.api.collections.mockImplementation((pageNo: number) =>
      Promise.resolve(pageNo === 2 ? page([collection(2, 0)], 2, 2) : page([collection(1, 0)], 1, 2)),
    )
    const vm = new CollectionsScreenViewModel(svc(services))

    await vi.waitFor(() => expect(vm.cards).toHaveLength(1))
    vm.loadMore()
    await vi.waitFor(() => expect(vm.cards.map((c) => c.id)).toEqual([1, 2]))
    vm.loadMore()
    await flush()
    expect(services.api.collections).toHaveBeenCalledTimes(2)
    vm.dispose()
  })
})
