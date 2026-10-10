import { describe, expect, it, vi } from 'vitest'
import type { ItemShort } from '@/services/api/api.types'
import type { Services } from '@/services/services'
import { fakeServices, flush, type FakeServices } from '@/test/fake-services'
import { PersonScreenViewModel } from './person-screen.view-model'

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
const page = (ids: number[], current: number, total: number) => ({
  items: ids.map(item),
  pagination: { current, total, perpage: ids.length, total_items: 0 },
})

describe('PersonScreenViewModel', () => {
  it('queries by role and name and pages through the results', async () => {
    const services = fakeServices()

    services.api.byPerson.mockImplementation((_role: string, _name: string, pageNo: number) =>
      Promise.resolve(pageNo === 2 ? page([3], 2, 2) : page([1, 2], 1, 2)),
    )
    const vm = new PersonScreenViewModel(svc(services), 'director', 'Нолан')

    expect(vm.role).toBe('director')
    expect(vm.name).toBe('Нолан')
    await vi.waitFor(() => expect(vm.list).toHaveLength(2))
    expect(services.api.byPerson).toHaveBeenCalledWith('director', 'Нолан', 1, expect.any(AbortSignal))

    vm.loadMore()
    await vi.waitFor(() => expect(vm.list.map((i) => i.id)).toEqual([1, 2, 3]))
    vm.loadMore()
    await flush()
    expect(services.api.byPerson).toHaveBeenCalledTimes(2)
    vm.dispose()
  })

  it('stops paging when the response has no pagination', async () => {
    const services = fakeServices()

    services.api.byPerson.mockResolvedValue({ items: [item(1)] })
    const vm = new PersonScreenViewModel(svc(services), 'cast', 'Актёр')

    await vi.waitFor(() => expect(vm.list).toHaveLength(1))
    expect(vm.pages.hasNextPage).toBe(false)
    vm.loadMore()
    await flush()
    expect(services.api.byPerson).toHaveBeenCalledTimes(1)
    vm.dispose()
  })
})
