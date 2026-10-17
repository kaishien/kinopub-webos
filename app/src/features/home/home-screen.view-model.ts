import { makeAutoObservable } from 'mobx'
import { Query } from 'mobx-tanstack-query'
import { UHD_QUALITY, type ItemShort } from '@/services/api/api.types'
import type { LocalHistoryEntry } from '@/services/local-history/local-history.service'
import type { Services } from '@/services/services'
import { episodeLabel, formatClock } from '@/shared/lib/format'
import { Scope } from '@/shared/view-model/use-view-model'
import { link } from '@/app/routes'

export interface HomeShelf {
  key: string
  title: string
  query: Query<ItemShort[]>
  moreLink?: string
  ranked?: boolean
}

export const CONTINUE_SHELF_KEY = 'continue'
export const CONTINUE_LOCAL_FOCUS_KEY = 'HOME-continue-local'
const TOP_COUNT = 10

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
      // «hot» is what Kinopub ranks by current views: the same data as a Top-10, just numbered.
      shelf('top-movie', 'Топ-10 фильмов', (s) => api.shelf('hot', 'movie', s).then((items) => items.slice(0, TOP_COUNT)), {
        ranked: true,
      }),
      shelf('fresh-serial', 'Новые сериалы', (s) => api.shelf('fresh', 'serial', s), {
        moreLink: link.catalog('serial', { sort: 'created-' }),
      }),
      shelf('top-serial', 'Топ-10 сериалов', (s) => api.shelf('hot', 'serial', s).then((items) => items.slice(0, TOP_COUNT)), {
        ranked: true,
      }),
      shelf('fresh-4k', 'Новое в 4K', (s) => api.items({ quality: UHD_QUALITY, sort: 'created-' }, s).then((page) => page.items), {
        moreLink: link.catalog('4k', { sort: 'created-' }),
      }),
      shelf('popular-tvshow', 'ТВ-шоу', (s) => api.shelf('popular', 'tvshow', s), { moreLink: link.catalog('tvshow', { sort: 'views-' }) }),
      shelf('fresh-docu', 'Документальное', (s) => api.shelf('fresh', 'documovie', s), {
        moreLink: link.catalog('documovie', { sort: 'created-' }),
      }),
    ]
    makeAutoObservable<this, 'scope' | 'services'>(this, { scope: false, services: false, shelves: false }, { autoBind: true })
  }

  get visibleShelves(): HomeShelf[] {
    const hideContinue = this.services.settings.values.hideContinueRow

    return this.shelves.filter((s) => this.itemsOf(s).length > 0 && !(hideContinue && s.key === CONTINUE_SHELF_KEY))
  }

  itemsOf(shelf: HomeShelf): ItemShort[] {
    return shelf.key === CONTINUE_SHELF_KEY ? this.continueItems : (shelf.query.data ?? [])
  }

  /** This TV's unfinished titles first, newest first, then the account's watching list without them. */
  get continueItems(): ItemShort[] {
    const local = this.localUnfinished.map((e) => e.item)
    const shown = new Set(local.map((item) => item.id))
    const account = this.shelves.find((s) => s.key === CONTINUE_SHELF_KEY)?.query.data ?? []

    return [...local, ...account.filter((item) => !shown.has(item.id))]
  }

  private get localUnfinished(): LocalHistoryEntry[] {
    return this.services.localHistory.entries.filter((e) => !e.finished)
  }

  private get localById(): Map<number, LocalHistoryEntry> {
    return new Map(this.localUnfinished.map((e) => [e.item.id, e]))
  }

  /** Watched share: this TV's position for its own titles, watched episodes for the account's serials. */
  continueProgress(item: ItemShort): number | undefined {
    const local = this.localById.get(item.id)

    if (local) return local.duration ? local.time / local.duration : undefined

    return item.total ? (item.watched ?? 0) / item.total : undefined
  }

  continueSubtitle(item: ItemShort): string | undefined {
    const local = this.localById.get(item.id)

    if (!local) return item.new ? `${item.new} новых` : undefined

    const where = local.time > 0 ? formatClock(local.time) : 'с начала'

    return local.season ? `${episodeLabel(local.season, local.episode)} · ${where}` : where
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

  /** What this TV was watching last, from the device: the shared account's watching list says what anyone played. */
  get lastPlayed() {
    return this.services.localHistory.resumable
  }

  get initialFocusKey() {
    return this.lastPlayed ? CONTINUE_LOCAL_FOCUS_KEY : this.firstShelfFocusKey
  }

  continueLastPlayed() {
    const last = this.lastPlayed

    if (last) void this.services.router.navigate(link.player(last.item.id, last.videoId, { t: last.time }))
  }

  retry() {
    this.shelves.forEach((s) => void s.query.refetch())
  }

  dispose() {
    this.scope.dispose()
  }
}
