import { makeAutoObservable } from 'mobx'
import { Query } from 'mobx-tanstack-query'
import { UHD_QUALITY, type ItemShort } from '@/services/api/api.types'
import type { Services } from '@/services/services'
import { Scope } from '@/shared/view-model/use-view-model'
import { link } from '@/app/routes'

export interface HomeShelf {
  key: string
  title: string
  query: Query<ItemShort[]>
  moreLink?: string
}

export const CONTINUE_SHELF_KEY = 'continue'

export class HomeScreenViewModel {
  private readonly scope = new Scope()
  readonly shelves: HomeShelf[]

  constructor(private readonly services: Services) {
    const { api, queryClient } = services
    const shelf = (
      key: string,
      title: string,
      fn: (signal: AbortSignal) => Promise<ItemShort[]>,
      extra: Partial<HomeShelf> = {},
    ): HomeShelf => ({
      key,
      title,
      query: new Query<ItemShort[]>({
        queryClient,
        abortSignal: this.scope.signal,
        queryKey: ['home', key],
        queryFn: ({ signal }) => fn(signal),
      }),
      ...extra,
    })
    this.shelves = [
      shelf(CONTINUE_SHELF_KEY, 'Продолжить', (s) => api.watchingSerials(1, s)),
      shelf('fresh-movie', 'Новые фильмы', (s) => api.shelf('fresh', 'movie', s), {
        moreLink: link.catalog('movie', { sort: 'created-' }),
      }),
      shelf('fresh-serial', 'Новые сериалы', (s) => api.shelf('fresh', 'serial', s), {
        moreLink: link.catalog('serial', { sort: 'created-' }),
      }),
      shelf('hot-movie', 'Горячие фильмы', (s) => api.shelf('hot', 'movie', s), { moreLink: link.catalog('movie', { sort: 'views-' }) }),
      shelf('popular-serial', 'Популярные сериалы', (s) => api.shelf('popular', 'serial', s), {
        moreLink: link.catalog('serial', { sort: 'views-' }),
      }),
      shelf('fresh-4k', 'Новое в 4K', (s) => api.items({ quality: UHD_QUALITY, sort: 'created-' }, s).then((page) => page.items), {
        moreLink: link.catalog('4k', { sort: 'created-' }),
      }),
      shelf('popular-tvshow', 'ТВ-шоу', (s) => api.shelf('popular', 'tvshow', s), { moreLink: link.catalog('tvshow', { sort: 'views-' }) }),
      shelf('fresh-docu', 'Документальное', (s) => api.shelf('fresh', 'documovie', s), {
        moreLink: link.catalog('documovie', { sort: 'created-' }),
      }),
    ]
    makeAutoObservable<this, 'scope'>(this, { scope: false, shelves: false }, { autoBind: true })
  }

  get visibleShelves(): HomeShelf[] {
    const hideContinue = this.services.settings.values.hideContinueRow
    return this.shelves.filter((s) => (s.query.data?.length ?? 0) > 0 && !(hideContinue && s.key === CONTINUE_SHELF_KEY))
  }

  get isLoading() {
    return this.visibleShelves.length === 0 && this.shelves.some((s) => s.query.isLoading)
  }

  get error(): string | null {
    if (this.visibleShelves.length > 0 || this.isLoading) return null
    const failed = this.shelves.find((s) => s.query.error)
    return failed ? (failed.query.error as Error).message : null
  }

  get firstShelfFocusKey() {
    const first = this.visibleShelves[0]
    return first ? `ROW-${first.key}` : undefined
  }

  retry() {
    this.shelves.forEach((s) => void s.query.refetch())
  }

  dispose() {
    this.scope.dispose()
  }
}
