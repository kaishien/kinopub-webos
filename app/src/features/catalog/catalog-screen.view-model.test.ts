import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ItemShort, ItemsPage } from '@/services/api/api.types'
import { fakeServices, type FakeServices } from '@/test/fake-services'
import { CatalogScreenViewModel } from './catalog-screen.view-model'
import { DEFAULT_SORT, QUALITY_OPTIONS, SORT_OPTIONS } from './filters'

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

describe('CatalogScreenViewModel', () => {
  let services: FakeServices

  beforeEach(() => {
    services = fakeServices()
    services.api.genres.mockResolvedValue([
      { id: 1, title: 'Боевик' },
      { id: 2, title: 'Драма' },
    ])
    services.api.countries.mockResolvedValue([{ id: 7, title: 'США' }])
    services.api.items.mockResolvedValue(page([1, 2], 1, 1))
    services.api.fresh.mockResolvedValue(page([10], 1, 1))
  })

  it('starts from the route parameters and the default sort', async () => {
    const vm = new CatalogScreenViewModel(services, 'movie', { genre: 2 }, 'loc-1')

    expect(vm.title).toBe('Фильмы')
    expect(vm.filter).toEqual({ sort: DEFAULT_SORT, genre: 2 })
    await vi.waitFor(() => expect(vm.list.map((i) => i.id)).toEqual([1, 2]))
    expect(services.api.items).toHaveBeenCalledWith(
      { type: 'movie', sort: DEFAULT_SORT, genre: 2, quality: undefined, year: undefined, country: undefined, page: 1 },
      expect.any(AbortSignal),
    )
    expect(services.api.genres).toHaveBeenCalledWith('movie', expect.any(AbortSignal))
    vm.dispose()
  })

  it('offers the filters the section leaves open, with labels for narrowed and open values', async () => {
    const vm = new CatalogScreenViewModel(services, 'movie', {}, 'loc-2')

    await vi.waitFor(() => expect(vm.kinds).toEqual(['sort', 'genre', 'quality', 'year', 'country']))
    expect(vm.options('sort')).toBe(SORT_OPTIONS)
    expect(vm.options('quality')).toBe(QUALITY_OPTIONS)
    expect(vm.options('genre')).toEqual([
      { value: undefined, title: 'Все' },
      { value: 1, title: 'Боевик' },
      { value: 2, title: 'Драма' },
    ])
    expect(vm.options('country')).toEqual([
      { value: undefined, title: 'Все' },
      { value: 7, title: 'США' },
    ])
    expect(vm.options('year')[0]).toEqual({ value: undefined, title: 'Все' })

    expect(vm.titleOf('sort')).toBe('По обновлению')
    expect(vm.titleOf('genre')).toBe('Все жанры')
    expect(vm.titleOf('quality')).toBe('Любое качество')
    expect(vm.titleOf('year')).toBe('Любой год')
    expect(vm.titleOf('country')).toBe('Все страны')
    expect(vm.isNarrowed('sort')).toBe(false)
    expect(vm.activeIndex('genre')).toBe(0)

    vm.select('genre', 2)
    expect(vm.isNarrowed('genre')).toBe(true)
    expect(vm.titleOf('genre')).toBe('Драма')
    expect(vm.activeIndex('genre')).toBe(2)
    vm.select('sort', 'views-')
    expect(vm.titleOf('sort')).toBe('Популярные')
    expect(vm.activeIndex('sort')).toBe(2)
    vm.dispose()
  })

  it('skips the genre filter in a genre section and the quality filter in the 4K section', async () => {
    const anime = new CatalogScreenViewModel(services, 'anime', {}, 'loc-anime')

    await vi.waitFor(() => expect(anime.kinds).toContain('country'))
    expect(anime.kinds).toEqual(['sort', 'quality', 'year', 'country'])
    expect(services.api.genres).not.toHaveBeenCalled()
    expect(services.api.items).toHaveBeenCalledWith(expect.objectContaining({ type: undefined, genre: 25 }), expect.any(AbortSignal))
    anime.dispose()

    const uhd = new CatalogScreenViewModel(services, '4k', {}, 'loc-4k')

    await vi.waitFor(() => expect(uhd.kinds).toContain('genre'))
    expect(uhd.kinds).toEqual(['sort', 'genre', 'year', 'country'])
    expect(services.api.items).toHaveBeenCalledWith(expect.objectContaining({ quality: 4 }), expect.any(AbortSignal))
    uhd.dispose()
  })

  it('refetches with the new parameters when a filter changes and resets sort to the default on clear', async () => {
    const vm = new CatalogScreenViewModel(services, 'serial', {}, 'loc-3')

    await vi.waitFor(() => expect(vm.list).toHaveLength(2))
    vm.openSheet('quality')
    expect(vm.sheet).toBe('quality')
    vm.select('quality', 3)
    expect(vm.sheet).toBeNull()
    await vi.waitFor(() =>
      expect(services.api.items).toHaveBeenCalledWith(expect.objectContaining({ type: 'serial', quality: 3 }), expect.any(AbortSignal)),
    )

    vm.select('sort', undefined)
    expect(vm.filter.sort).toBe(DEFAULT_SORT)
    vm.select('quality', undefined)
    expect(vm.filter.quality).toBeUndefined()
    vm.closeSheet()
    vm.dispose()
  })

  it('remembers filters and the fresh tab per location in focus memory and restores them on remount', async () => {
    const first = new CatalogScreenViewModel(services, 'movie', {}, 'loc-4')

    first.select('year', '2020')
    first.select('country', 7)
    first.dispose()

    expect(services.focusMemory.state('loc-4', 'filter')).toEqual({ sort: DEFAULT_SORT, genre: undefined, year: '2020', country: 7 })

    const again = new CatalogScreenViewModel(services, 'movie', { sort: 'views-' }, 'loc-4')

    expect(again.filter).toEqual({ sort: DEFAULT_SORT, genre: undefined, year: '2020', country: 7 })
    again.dispose()

    const other = new CatalogScreenViewModel(services, 'movie', { sort: 'views-' }, 'loc-other')

    expect(other.filter).toEqual({ sort: 'views-', genre: undefined })
    other.dispose()

    const fresh = new CatalogScreenViewModel(services, 'fresh', {}, 'loc-fresh')

    fresh.setFreshType('serial')
    fresh.dispose()
    expect(new CatalogScreenViewModel(services, 'fresh', {}, 'loc-fresh').freshType).toBe('serial')
  })

  it('uses the fresh endpoint and type tabs for the «Новинки» section with no filters', async () => {
    const vm = new CatalogScreenViewModel(services, 'fresh', {}, 'loc-5')

    expect(vm.title).toBe('Новинки')
    expect(vm.freshType).toBe('movie')
    expect(vm.kinds).toEqual([])
    await vi.waitFor(() => expect(vm.list.map((i) => i.id)).toEqual([10]))
    expect(services.api.fresh).toHaveBeenCalledWith('movie', 1, expect.any(AbortSignal))
    expect(services.api.items).not.toHaveBeenCalled()
    expect(services.api.genres).not.toHaveBeenCalled()
    expect(services.api.countries).not.toHaveBeenCalled()

    services.api.fresh.mockResolvedValue(page([20], 1, 1))
    vm.setFreshType('tvshow')
    await vi.waitFor(() => expect(vm.list.map((i) => i.id)).toEqual([20]))
    expect(services.api.fresh).toHaveBeenLastCalledWith('tvshow', 1, expect.any(AbortSignal))
    vm.dispose()
  })

  it('loads the next page only while one remains and none is in flight', async () => {
    services.api.items.mockImplementation((params: { page?: number }) =>
      Promise.resolve(params.page === 2 ? page([3, 4], 2, 2) : page([1, 2], 1, 2)),
    )
    const vm = new CatalogScreenViewModel(services, 'movie', {}, 'loc-6')

    await vi.waitFor(() => expect(vm.list).toHaveLength(2))
    expect(vm.items.hasNextPage).toBe(true)
    vm.loadMore()
    vm.loadMore()
    await vi.waitFor(() => expect(vm.list.map((i) => i.id)).toEqual([1, 2, 3, 4]))
    expect(services.api.items).toHaveBeenCalledTimes(2)
    expect(vm.items.hasNextPage).toBe(false)
    vm.loadMore()
    expect(services.api.items).toHaveBeenCalledTimes(2)
    vm.dispose()
  })

  it('exposes the list error message', async () => {
    const { ApiError } = await import('@/services/api/api.service')

    services.api.items.mockRejectedValue(new ApiError(500, 'Ошибка каталога'))
    const vm = new CatalogScreenViewModel(services, 'movie', {}, 'loc-7')

    await vi.waitFor(() => expect(vm.error).toBe('Ошибка каталога'))
    expect(vm.list).toEqual([])
    vm.dispose()
  })

  it('falls back to a plain section for an unknown id', () => {
    const vm = new CatalogScreenViewModel(services, 'weird', {}, 'loc-8')

    expect(vm.section).toEqual({ id: 'weird', title: 'weird', type: 'weird' })
    vm.dispose()
  })
})
