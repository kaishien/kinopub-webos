import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/services/api/api.service'
import type { Services } from '@/services/services'
import { fakeServices, type FakeServices } from '@/test/fake-services'
import { CollectionScreenViewModel } from './collection-screen.view-model'

/** FakeServices is not assignable to Services (see src/test/fake-services.ts); view-models only use what the fake provides. */
const svc = (s: FakeServices) => s as unknown as Services

const posters = { small: '', medium: '', big: '' }

describe('CollectionScreenViewModel', () => {
  it('loads the collection with its items by id', async () => {
    const services = fakeServices()
    const payload = {
      collection: { id: 3, title: 'Подборка', watchers: 0, views: 0, created: 0, updated: 0, posters },
      items: [{ id: 1, type: 'movie', subtype: '', title: 'Item', year: 2020, posters }],
    }

    services.api.collectionItems.mockResolvedValue(payload)
    const vm = new CollectionScreenViewModel(svc(services), 3)

    await vi.waitFor(() => expect(vm.data.data).toEqual(payload))
    expect(services.api.collectionItems).toHaveBeenCalledWith(3, expect.any(AbortSignal))
    expect(vm.id).toBe(3)
    vm.dispose()
  })

  it('exposes the request error', async () => {
    const services = fakeServices()

    services.api.collectionItems.mockRejectedValue(new ApiError(404, 'Нет подборки'))
    const vm = new CollectionScreenViewModel(svc(services), 4)

    await vi.waitFor(() => expect(vm.data.error?.message).toBe('Нет подборки'))
    vm.dispose()
  })
})
