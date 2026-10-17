import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/services/api/api.service'
import type { ItemShort } from '@/services/api/api.types'
import { fakeServices, flush, type FakeServices } from '@/test/fake-services'
import { CONTINUE_LOCAL_FOCUS_KEY, CONTINUE_SHELF_KEY, HomeScreenViewModel } from './home-screen.view-model'

const item = (id: number): ItemShort => ({
  id,
  type: 'movie',
  subtype: '',
  title: `Item ${id}`,
  year: 2024,
  posters: { small: '', medium: '', big: '' },
})
const items = (count: number, from = 1) => Array.from({ length: count }, (_, i) => item(from + i))

const watchedHere = (id: number, extra: { season?: number; episode?: number; time?: number; finished?: boolean } = {}) => ({
  item: item(id),
  videoId: id * 100,
  season: extra.season ?? 0,
  episode: extra.episode ?? 1,
  episodeTitle: '',
  time: extra.time ?? 0,
  duration: 1000,
  finished: extra.finished,
})

describe('HomeScreenViewModel', () => {
  let services: FakeServices

  beforeEach(() => {
    services = fakeServices()
  })

  describe('«Продолжить» row', () => {
    it("lists this TV's unfinished titles first, then the account list without them", async () => {
      services.localHistory.remember(watchedHere(5, { finished: true }))
      services.localHistory.remember(watchedHere(3, { season: 2, episode: 4, time: 250 }))
      services.localHistory.remember(watchedHere(8, { time: 0 }))
      services.api.watchingSerials.mockResolvedValue([{ ...item(1), total: 10, watched: 4, new: 2 }, item(3), item(5)])
      const vm = new HomeScreenViewModel(services)

      await flush()
      const row = vm.visibleShelves.find((s) => s.key === CONTINUE_SHELF_KEY)!

      expect(vm.itemsOf(row).map((i) => i.id)).toEqual([8, 3, 1, 5])
      expect(vm.continueSubtitle(item(3))).toBe('S2 E4 · 04:10')
      expect(vm.continueSubtitle(item(8))).toBe('с начала')
      expect(vm.continueProgress(item(3))).toBe(0.25)
      expect(vm.continueSubtitle({ ...item(1), new: 2 })).toBe('2 новых')
      expect(vm.continueProgress({ ...item(1), total: 10, watched: 4 })).toBe(0.4)
      vm.dispose()
    })

    it("shows this TV's titles even when the account list fails, and stays hidden when the setting says so", async () => {
      services.localHistory.remember(watchedHere(3, { time: 60 }))
      services.api.watchingSerials.mockRejectedValue(new Error('offline'))
      const vm = new HomeScreenViewModel(services)

      await flush()
      expect(vm.visibleShelves.map((s) => s.key)).toContain(CONTINUE_SHELF_KEY)
      expect(vm.itemsOf(vm.visibleShelves[0]).map((i) => i.id)).toEqual([3])

      services.settings.set('hideContinueRow', true)
      expect(vm.visibleShelves.map((s) => s.key)).not.toContain(CONTINUE_SHELF_KEY)
      vm.dispose()
    })
  })

  describe('continue from this TV', () => {
    it('offers nothing and focuses the first shelf until something was played here', async () => {
      services.api.watchingSerials.mockResolvedValue(items(2))
      const vm = new HomeScreenViewModel(services)

      await flush()
      expect(vm.lastPlayed).toBeNull()
      expect(vm.initialFocusKey).toBe(`ROW-${CONTINUE_SHELF_KEY}`)
      vm.dispose()
    })

    it('focuses the button and resumes the device-local episode and position', () => {
      const navigate = vi.spyOn(services.router, 'navigate').mockResolvedValue(undefined)

      services.localHistory.remember({ item: item(7), videoId: 103, season: 1, episode: 3, episodeTitle: '', time: 3413.4, duration: 4120 })
      const vm = new HomeScreenViewModel(services)

      expect(vm.initialFocusKey).toBe(CONTINUE_LOCAL_FOCUS_KEY)

      vm.continueLastPlayed()
      expect(navigate).toHaveBeenCalledWith('/item/7/play/103?t=3413')
      vm.dispose()
    })
  })

  it('lays the shelves out in the fixed order with their titles and links', () => {
    const vm = new HomeScreenViewModel(services)

    expect(vm.shelves.map((s) => [s.key, s.title])).toEqual([
      [CONTINUE_SHELF_KEY, 'Продолжить'],
      ['fresh-movie', 'Новые фильмы'],
      ['top-movie', 'Топ-10 фильмов'],
      ['fresh-serial', 'Новые сериалы'],
      ['top-serial', 'Топ-10 сериалов'],
      ['fresh-4k', 'Новое в 4K'],
      ['popular-tvshow', 'ТВ-шоу'],
      ['fresh-docu', 'Документальное'],
    ])
    expect(vm.shelves.filter((s) => s.ranked).map((s) => s.key)).toEqual(['top-movie', 'top-serial'])
    expect(vm.shelves.find((s) => s.key === 'fresh-movie')?.moreLink).toBe('/catalog/movie?sort=created-')
    expect(vm.shelves.find((s) => s.key === 'fresh-4k')?.moreLink).toBe('/catalog/4k?sort=created-')
    expect(vm.shelves.find((s) => s.key === 'popular-tvshow')?.moreLink).toBe('/catalog/tvshow?sort=views-')
    expect(vm.shelves.find((s) => s.key === CONTINUE_SHELF_KEY)?.moreLink).toBeUndefined()
    vm.dispose()
  })

  it('requests each shelf from the matching endpoint and trims Top-10 rows to ten', async () => {
    services.api.watchingSerials.mockResolvedValue(items(2))
    services.api.shelf.mockImplementation((shelf: string) => Promise.resolve(shelf === 'hot' ? items(25) : items(3)))
    services.api.items.mockResolvedValue({ items: items(4, 100) })
    const vm = new HomeScreenViewModel(services)

    await vi.waitFor(() => expect(vm.shelves.every((s) => s.query.isSuccess)).toBe(true))

    expect(services.api.watchingSerials).toHaveBeenCalledWith(1, expect.any(AbortSignal))
    expect(services.api.shelf.mock.calls.map(([shelf, type]) => `${shelf}/${type}`)).toEqual([
      'fresh/movie',
      'hot/movie',
      'fresh/serial',
      'hot/serial',
      'popular/tvshow',
      'fresh/documovie',
    ])
    expect(services.api.items).toHaveBeenCalledWith({ quality: 4, sort: 'created-' }, expect.any(AbortSignal))

    const byKey = Object.fromEntries(vm.shelves.map((s) => [s.key, s.query.data]))

    expect(byKey['top-movie']).toHaveLength(10)
    expect(byKey['top-serial']).toHaveLength(10)
    expect(byKey['fresh-movie']).toHaveLength(3)
    expect(byKey['fresh-4k']?.map((i) => i.id)).toEqual([100, 101, 102, 103])
    vm.dispose()
  })

  it('hides empty shelves and the continue row when the setting asks for it', async () => {
    services.api.watchingSerials.mockResolvedValue(items(1))
    services.api.shelf.mockImplementation((_shelf: string, type: string) => Promise.resolve(type === 'movie' ? items(2) : []))
    services.api.items.mockResolvedValue({ items: [] })
    const vm = new HomeScreenViewModel(services)

    await vi.waitFor(() => expect(vm.shelves.every((s) => s.query.isSuccess)).toBe(true))
    expect(vm.visibleShelves.map((s) => s.key)).toEqual([CONTINUE_SHELF_KEY, 'fresh-movie', 'top-movie'])
    expect(vm.firstShelfFocusKey).toBe(`ROW-${CONTINUE_SHELF_KEY}`)

    services.settings.set('hideContinueRow', true)
    expect(vm.visibleShelves.map((s) => s.key)).toEqual(['fresh-movie', 'top-movie'])
    expect(vm.firstShelfFocusKey).toBe('ROW-fresh-movie')
    vm.dispose()
  })

  it('is loading until the first shelf arrives and has no focus key while empty', async () => {
    let resolveContinue!: (value: ItemShort[]) => void

    services.api.watchingSerials.mockReturnValue(new Promise((resolve) => (resolveContinue = resolve)))
    services.api.shelf.mockReturnValue(new Promise(() => {}))
    services.api.items.mockReturnValue(new Promise(() => {}))
    const vm = new HomeScreenViewModel(services)

    await flush()
    expect(vm.isLoading).toBe(true)
    expect(vm.error).toBeNull()
    expect(vm.firstShelfFocusKey).toBeUndefined()

    resolveContinue(items(1))
    await vi.waitFor(() => expect(vm.isLoading).toBe(false))
    expect(vm.visibleShelves.map((s) => s.key)).toEqual([CONTINUE_SHELF_KEY])
    vm.dispose()
  })

  it('surfaces the first failed shelf error only when nothing is visible, and retry refetches every shelf', async () => {
    services.api.watchingSerials.mockRejectedValue(new ApiError(500, 'Сервер недоступен'))
    services.api.shelf.mockResolvedValue([])
    services.api.items.mockResolvedValue({ items: [] })
    const vm = new HomeScreenViewModel(services)

    await vi.waitFor(() => expect(vm.error).toBe('Сервер недоступен'))
    expect(vm.isLoading).toBe(false)

    services.api.watchingSerials.mockResolvedValue(items(1))
    const callsBefore = services.api.shelf.mock.calls.length

    vm.retry()
    await vi.waitFor(() => expect(vm.visibleShelves.map((s) => s.key)).toEqual([CONTINUE_SHELF_KEY]))
    expect(vm.error).toBeNull()
    expect(services.api.shelf.mock.calls.length).toBe(callsBefore + 6)
    vm.dispose()
  })

  it('keeps the error hidden while any shelf has content', async () => {
    services.api.watchingSerials.mockRejectedValue(new ApiError(500, 'boom'))
    services.api.shelf.mockResolvedValue(items(1))
    services.api.items.mockResolvedValue({ items: [] })
    const vm = new HomeScreenViewModel(services)

    await vi.waitFor(() => expect(vm.shelves[0].query.error).toBeTruthy())
    await vi.waitFor(() => expect(vm.visibleShelves.length).toBeGreaterThan(0))
    expect(vm.error).toBeNull()
    vm.dispose()
  })
})
