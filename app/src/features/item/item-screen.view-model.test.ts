import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/services/api/api.service'
import type { Item, ItemShort, Season, Video } from '@/services/api/api.types'
import type { RouterService } from '@/services/router/router.service'
import type { Services } from '@/services/services'
import { fakeServices, flush, type FakeServices } from '@/test/fake-services'
import { ItemScreenViewModel, resumePoint } from './item-screen.view-model'

/** FakeServices is not assignable to Services (see src/test/fake-services.ts); view-models only use what the fake provides. */
const svc = (s: FakeServices) => s as unknown as Services

/** RouterService methods are MobX-bound (non-configurable) so they cannot be spied; a class instance (not a plain object) survives makeAutoObservable untouched. */
class StubRouter {
  constructor(readonly navigate: ReturnType<typeof vi.fn>) {}
}

const posters = { small: '', medium: 'https://cdn.test/poster/item/medium/1.jpg', big: '' }

// Twenty distinct names: findPhoto matches loosely, so numbered placeholders would collide.
const CAST = [
  'Киану Ривз',
  'Лоренс Фишбёрн',
  'Кэрри-Энн Мосс',
  'Хьюго Уивинг',
  'Глория Фостер',
  'Джо Пантолиано',
  'Маркус Чонг',
  'Джулиан Араханга',
  'Мэтт Доран',
  'Белинда Макклори',
  'Энтони Рэй Паркер',
  'Пол Годдард',
  'Роберт Тейлор',
  'Дэвид Астон',
  'Марк Грэй',
  'Ада Николодемо',
  'Дениз Руд',
  'Билл Янг',
  'Эрик Ковальски',
  'Робин Гарт',
]

function video(id: number, number: number, snumber = 0, extra: Partial<Video> = {}): Video {
  return {
    id,
    number,
    snumber,
    thumbnail: '',
    title: `Episode ${number}`,
    tracks: 1,
    duration: 2400,
    ac3: 0,
    audios: [],
    subtitles: [],
    files: [],
    watched: 0,
    watching: { status: 0, time: 0 },
    ...extra,
  }
}

function season(number: number, episodes: Video[]): Season {
  return { id: number, number, title: `Season ${number}`, watching: { status: 0 }, episodes }
}

function movie(extra: Partial<Item> = {}): Item {
  return {
    id: 1,
    type: 'movie',
    subtype: '',
    title: 'Матрица / The Matrix',
    year: 1999,
    posters,
    countries: [{ id: 1, title: 'США' }],
    genres: [
      { id: 1, title: 'Фантастика' },
      { id: 2, title: 'Боевик' },
    ],
    duration: { average: 8160, total: 8160 },
    director: 'Лана Вачовски, Лилли Вачовски',
    cast: CAST.join(', '),
    videos: [video(100, 1)],
    ...extra,
  }
}

function serial(): Item {
  return movie({
    type: 'serial',
    title: 'Сериал',
    duration: { average: 2700, total: 0 },
    videos: undefined,
    seasons: [
      season(1, [video(11, 1, 1, { watched: 1 }), video(12, 2, 1, { watched: 1 })]),
      season(2, [video(21, 1, 2, { watched: 1 }), video(22, 2, 2, { watched: 0, watching: { status: 1, time: 600 } })]),
    ],
  })
}

describe('ItemScreenViewModel', () => {
  let services: FakeServices
  let navigate: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // RouterService.navigate is a MobX-bound action (non-configurable), so a stub replaces spying.
    navigate = vi.fn()
    services = fakeServices({ router: new StubRouter(navigate) as unknown as RouterService })
    services.api.similar.mockResolvedValue([])
  })

  async function load(item: Item, preview?: ItemShort) {
    services.api.item.mockResolvedValue(item)
    const vm = new ItemScreenViewModel(svc(services), item.id, preview)

    await vi.waitFor(() => expect(vm.data).toBeDefined())

    return vm
  }

  /**
   * BUG (item-screen.view-model.ts:63): the trailer reaction runs with fireImmediately before `this.item` is assigned,
   * so the `data` computed throws, caches the TypeError (it tracked no observables) and every later read rethrows it.
   */
  it('exposes data without throwing right after construction', async () => {
    services.api.item.mockResolvedValue(movie())
    const vm = new ItemScreenViewModel(svc(services), 1)

    expect(() => vm.data).not.toThrow()
    await vi.waitFor(() => expect(vm.data?.id).toBe(1))
    vm.dispose()
  })

  it('sets the wide poster backdrop from the preview on construction', () => {
    services.api.item.mockReturnValue(new Promise(() => {}))
    const preview: ItemShort = { id: 7, type: 'movie', subtype: '', title: 'Превью / Preview', year: 2020, posters }
    const vm = new ItemScreenViewModel(svc(services), 7, preview)

    expect(services.ui.backdrop).toBe('https://cdn.test/poster/item/wide/7.jpg')
    expect(vm.title).toEqual({ ru: 'Превью', original: 'Preview' })
    expect(vm.metaLine).toEqual([])
    expect(vm.next).toBeNull()
    expect(vm.playLabel).toBe('Смотреть')
    vm.dispose()

    const bare = new ItemScreenViewModel(svc(services), 8)

    expect(services.ui.backdrop).toBe('https://m.boramoraboom.ru/poster/item/wide/8.jpg')
    bare.dispose()
  })

  it('builds the title and meta line for a movie', async () => {
    const vm = await load(movie())

    expect(vm.title).toEqual({ ru: 'Матрица', original: 'The Matrix' })
    expect(vm.isSerial).toBe(false)
    expect(vm.metaLine).toEqual(['США', 'Фантастика, Боевик', '2 ч 16 мин'])
    expect(vm.episodes).toBeNull()
    expect(vm.movieWatched).toBe(false)
    vm.dispose()
  })

  it('prefixes the per-episode duration for a serial', async () => {
    const vm = await load(serial())

    expect(vm.isSerial).toBe(true)
    expect(vm.metaLine).toEqual(['США', 'Фантастика, Боевик', 'серия 45 мин'])
    vm.dispose()
  })

  it('resumes an unwatched movie past the one-minute threshold', async () => {
    const vm = await load(movie({ videos: [video(100, 1, 0, { watching: { status: 1, time: 1800 } })] }))

    expect(vm.next).toEqual({ video: vm.data!.videos![0], season: 0, resumeFrom: 1800 })
    expect(vm.playLabel).toBe('Продолжить с 30 мин')

    vm.play(vm.next!)
    expect(navigate).toHaveBeenLastCalledWith('/item/1/play/100?t=1800')
    vm.play(vm.next!, true)
    expect(navigate).toHaveBeenLastCalledWith('/item/1/play/100')
    vm.dispose()
  })

  it('starts a watched movie from the beginning and reports it watched', async () => {
    const vm = await load(movie({ videos: [video(100, 1, 0, { watched: 1, watching: { status: 1, time: 5000 } })] }))

    expect(vm.next?.resumeFrom).toBe(0)
    expect(vm.playLabel).toBe('Смотреть')
    expect(vm.movieWatched).toBe(true)
    vm.dispose()
  })

  it('picks the first unwatched episode as next and selects its season', async () => {
    const vm = await load(serial())

    expect(vm.next).toMatchObject({ video: { id: 22 }, season: 2, resumeFrom: 600 })
    expect(vm.playLabel).toBe('Продолжить S2 E2')
    expect(vm.seasonIndex).toBe(1)
    expect(vm.currentSeason?.number).toBe(2)
    expect(vm.episodes).toEqual({ videos: vm.data!.seasons![1].episodes, season: 2 })

    vm.selectSeason(0)
    expect(vm.episodes?.season).toBe(1)
    vm.dispose()
  })

  it('falls back to the last episode when everything is watched', async () => {
    const all = serial()

    all.seasons![1].episodes[1].watched = 1
    const vm = await load(all)

    expect(vm.next).toMatchObject({ video: { id: 22 }, season: 2, resumeFrom: 0 })
    expect(vm.playLabel).toBe('Смотреть S2 E2')
    vm.dispose()
  })

  it('navigates to the player for episodes and trailers', async () => {
    const vm = await load(serial())
    const episode = vm.data!.seasons![1].episodes[1]

    vm.playEpisode(episode, 2)
    expect(navigate).toHaveBeenLastCalledWith('/item/1/play/22?t=600')

    vm.playEpisode(vm.data!.seasons![0].episodes[0], 1)
    expect(navigate).toHaveBeenLastCalledWith('/item/1/play/11')

    vm.playTrailer()
    expect(navigate).toHaveBeenCalledTimes(2)

    vm.dispose()
    const withTrailer = await load(movie({ trailer: { id: 5, file: '', url: 'https://cdn.test/trailer.mp4' } }))

    withTrailer.playTrailer()
    expect(navigate).toHaveBeenLastCalledWith('/item/1/play/0', { state: { trailer: 'https://cdn.test/trailer.mp4' } })
    withTrailer.dispose()
  })

  it('mirrors the trailer into the ui while mounted and clears it on dispose', async () => {
    const vm = await load(movie({ trailer: { id: 5, file: '', url: 'https://cdn.test/trailer.mp4' } }))

    expect(services.ui.trailer).toBe('https://cdn.test/trailer.mp4')
    vm.dispose()
    expect(services.ui.trailer).toBe('')
  })

  it('lists directors first and caps the cast at fifteen, matching Wikidata photos', async () => {
    ;(services.peoplePhotos.byImdb as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: 'Лана Вачовски', url: 'https://img/lana.jpg' },
      { name: 'Кэрри Энн Мосс', url: 'https://img/moss.jpg' },
    ])
    const vm = await load(movie({ imdb: 133093 }))

    await vi.waitFor(() => expect(vm.photos.data).toBeDefined())
    expect(services.peoplePhotos.byImdb).toHaveBeenCalledWith(133093, expect.any(AbortSignal))
    expect(vm.people).toHaveLength(17)
    expect(vm.people.slice(0, 2)).toEqual([
      { role: 'director', name: 'Лана Вачовски', photo: 'https://img/lana.jpg' },
      { role: 'director', name: 'Лилли Вачовски', photo: undefined },
    ])
    expect(vm.people[2]).toEqual({ role: 'cast', name: 'Киану Ривз', photo: undefined })
    expect(vm.people[4]).toEqual({ role: 'cast', name: 'Кэрри-Энн Мосс', photo: 'https://img/moss.jpg' })
    expect(vm.people[vm.people.length - 1].name).toBe('Марк Грэй')
    vm.dispose()
  })

  it('does not look up photos without an imdb id', async () => {
    const vm = await load(movie())

    await flush()
    expect(services.peoplePhotos.byImdb).not.toHaveBeenCalled()
    expect(vm.people.map((p) => p.photo)).toEqual(Array(17).fill(undefined))
    vm.dispose()
  })

  it('toggles a bookmark folder with a toast reflecting membership and refreshes the folder lists', async () => {
    services.api.itemBookmarkFolders.mockResolvedValue([{ id: 1, title: 'Избранное', views: 0, count: 1, created: 0, updated: 0 }])
    services.api.toggleBookmark.mockResolvedValue({ status: 1 })
    const vm = await load(movie())

    vm.openBookmarks()
    expect(vm.bookmarksOpen).toBe(true)
    await vi.waitFor(() => expect(vm.inFolders).toEqual([1]))
    expect(vm.isInFolder(1)).toBe(true)

    await vm.toggleBookmark.mutate({ id: 1, title: 'Избранное', views: 0, count: 1, created: 0, updated: 0 })
    expect(services.api.toggleBookmark).toHaveBeenCalledWith(1, 1)
    expect(services.ui.toast).toBe('Убрано из «Избранное»')

    await vm.toggleBookmark.mutate({ id: 2, title: 'Позже', views: 0, count: 0, created: 0, updated: 0 })
    expect(services.ui.toast).toBe('Добавлено в «Позже»')
    vm.closeBookmarks()
    expect(vm.bookmarksOpen).toBe(false)
    vm.dispose()
  })

  it('updates the watchlist flag and invalidates home and watching queries', async () => {
    services.api.toggleWatchlist.mockResolvedValue({ watching: true })
    const invalidate = vi.spyOn(services.queryClient, 'invalidateQueries')
    const vm = await load(serial())

    await vm.toggleWatchlist.mutate()
    expect(services.api.toggleWatchlist).toHaveBeenCalledWith(1)
    expect(services.ui.toast).toBe('Сериал в списке «Я смотрю»')
    expect(vm.data?.in_watchlist).toBe(true)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['home', 'continue'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['watching'] })

    services.api.toggleWatchlist.mockResolvedValue({ watching: false })
    await vm.toggleWatchlist.mutate()
    expect(services.ui.toast).toBe('Сериал убран из «Я смотрю»')
    expect(vm.data?.in_watchlist).toBe(false)
    vm.dispose()
  })

  it('marks the movie watched and refetches the item', async () => {
    services.api.toggleWatched.mockResolvedValue({})
    const vm = await load(movie())

    expect(services.api.item).toHaveBeenCalledTimes(1)
    vm.markMovieWatched()
    await vi.waitFor(() => expect(services.ui.toast).toBe('Отметка просмотра изменена'))
    expect(services.api.toggleWatched).toHaveBeenCalledWith(1, 1, undefined)
    await vi.waitFor(() => expect(services.api.item).toHaveBeenCalledTimes(2))
    vm.dispose()
  })

  it('shows the error message as a toast when a mutation fails', async () => {
    services.api.toggleWatchlist.mockRejectedValue(new ApiError(500, 'Не удалось'))
    services.api.toggleBookmark.mockRejectedValue(new ApiError(500, 'Нет связи'))
    const vm = await load(serial())

    await vm.toggleWatchlist.mutate().catch(() => {})
    expect(services.ui.toast).toBe('Не удалось')
    await vm.toggleBookmark.mutate({ id: 1, title: 'X', views: 0, count: 0, created: 0, updated: 0 }).catch(() => {})
    expect(services.ui.toast).toBe('Нет связи')
    vm.dispose()
  })

  it('exposes the similar query', async () => {
    services.api.similar.mockResolvedValue([{ id: 2, type: 'movie', subtype: '', title: 'Similar', year: 2000, posters }])
    const vm = await load(movie())

    await vi.waitFor(() => expect(vm.similar.data).toHaveLength(1))
    expect(services.api.similar).toHaveBeenCalledWith(1, expect.any(AbortSignal))
    vm.dispose()
  })
})

describe('resumePoint', () => {
  it('ignores short views and watched videos', () => {
    expect(resumePoint(video(1, 1, 0, { watching: { status: 1, time: 60 } }))).toBe(0)
    expect(resumePoint(video(1, 1, 0, { watching: { status: 1, time: 61 } }))).toBe(61)
    expect(resumePoint(video(1, 1, 0, { watched: 1, watching: { status: 1, time: 500 } }))).toBe(0)
    expect(resumePoint({ ...video(1, 1), watching: undefined as never })).toBe(0)
  })
})
