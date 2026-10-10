import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ItemShort, ItemsPage } from '@/services/api/api.types'
import type { Services } from '@/services/services'
import { fakeServices, flush, type FakeServices } from '@/test/fake-services'
import { SearchScreenViewModel } from './search-screen.view-model'

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
const page = (ids: number[], current: number, total: number): ItemsPage => ({
  items: ids.map(item),
  pagination: { current, total, perpage: ids.length, total_items: 0 },
})

describe('SearchScreenViewModel', () => {
  let services: FakeServices

  beforeEach(() => {
    services = fakeServices()
    services.api.search.mockResolvedValue(page([1, 2], 1, 1))
  })

  it('does not search until the trimmed query has two characters', async () => {
    const vm = new SearchScreenViewModel(svc(services))

    expect(vm.query).toBe('')
    vm.setQuery(' a ')
    expect(vm.normalized).toBe('a')
    await flush()
    expect(services.api.search).not.toHaveBeenCalled()
    expect(vm.list).toEqual([])
    expect(vm.isEmptyResult).toBe(false)
    vm.dispose()
  })

  it('searches with the normalized query, flattens pages and persists the query', async () => {
    const vm = new SearchScreenViewModel(svc(services))

    vm.setQuery('  матрица ')
    expect(services.storage.get('search-query', '')).toBe('  матрица ')
    await vi.waitFor(() => expect(vm.list.map((i) => i.id)).toEqual([1, 2]), { timeout: 2000 })
    expect(services.api.search).toHaveBeenCalledWith('матрица', 1, expect.any(AbortSignal))
    expect(vm.isEmptyResult).toBe(false)
    vm.dispose()
  })

  it('restores the saved query and runs it on construction', async () => {
    services.storage.set('search-query', 'дюна')
    const vm = new SearchScreenViewModel(svc(services))

    expect(vm.query).toBe('дюна')
    await vi.waitFor(() => expect(vm.list).toHaveLength(2))
    expect(services.api.search).toHaveBeenCalledWith('дюна', 1, expect.any(AbortSignal))
    vm.dispose()
  })

  it('reports an empty result once the search has finished with nothing', async () => {
    services.api.search.mockResolvedValue({ items: [] })
    services.storage.set('search-query', 'nothing')
    const vm = new SearchScreenViewModel(svc(services))

    await vi.waitFor(() => expect(vm.isEmptyResult).toBe(true))
    vm.dispose()
  })

  it('fetches the next page only while one remains', async () => {
    services.api.search.mockImplementation((_q: string, pageNo: number) =>
      Promise.resolve(pageNo === 2 ? page([3], 2, 2) : page([1, 2], 1, 2)),
    )
    services.storage.set('search-query', 'дюна')
    const vm = new SearchScreenViewModel(svc(services))

    await vi.waitFor(() => expect(vm.list).toHaveLength(2))
    vm.loadMore()
    await vi.waitFor(() => expect(vm.list.map((i) => i.id)).toEqual([1, 2, 3]))
    vm.loadMore()
    await flush()
    expect(services.api.search).toHaveBeenCalledTimes(2)
    vm.dispose()
  })
})
