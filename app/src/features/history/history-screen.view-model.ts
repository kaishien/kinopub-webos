import { makeAutoObservable } from 'mobx'
import { InfiniteQuery } from 'mobx-tanstack-query'
import type { HistoryEntry, HistoryPage, ItemShort } from '@/services/api/api.types'
import type { LocalHistoryEntry } from '@/services/local-history/local-history.service'
import type { Services } from '@/services/services'
import { episodeLabel, formatClock } from '@/shared/lib/format'
import { Scope } from '@/shared/view-model/use-view-model'
import { nextPage } from '@/services/query/next-page'

export class HistoryScreenViewModel {
  private readonly scope = new Scope()
  readonly pages: InfiniteQuery<HistoryPage, Error, number>

  constructor(private readonly services: Services) {
    const { api, queryClient } = services

    this.pages = new InfiniteQuery<HistoryPage, Error, number>({
      queryClient,
      abortSignal: this.scope.signal,
      queryKey: ['history'],
      queryFn: ({ signal, pageParam }) => api.history(pageParam, signal),
      initialPageParam: 1,
      getNextPageParam: nextPage,
      staleTime: 0,
    })
    makeAutoObservable<this, 'scope' | 'services'>(this, { scope: false, services: false, pages: false }, { autoBind: true })
  }

  get entries(): HistoryEntry[] {
    return this.pages.data?.pages.flatMap((p) => p.history) ?? []
  }

  /** What this TV watched comes first: the account's history mixes in everyone who shares it. */
  get localEntries(): LocalHistoryEntry[] {
    return this.services.localHistory.entries
  }

  /** This TV's titles, then the account's history without the titles already shown. */
  get items(): ItemShort[] {
    const local = this.localEntries.map((e) => e.item)
    const shown = new Set(local.map((item) => item.id))

    return [...local, ...this.entries.map((e) => e.item).filter((item) => !shown.has(item.id))]
  }

  private get entryById(): Map<number, HistoryEntry> {
    return new Map(this.entries.map((e) => [e.item.id, e]))
  }

  private get localById(): Map<number, LocalHistoryEntry> {
    return new Map(this.localEntries.map((e) => [e.item.id, e]))
  }

  subtitle(item: ItemShort): string | undefined {
    const local = this.localById.get(item.id)

    if (local) {
      if (local.finished) return 'просмотрено'

      return local.season ? `${episodeLabel(local.season, local.episode)} · ${formatClock(local.time)}` : formatClock(local.time)
    }

    const entry = this.entryById.get(item.id)

    if (!entry) return undefined

    const media = entry.media

    if (media?.snumber) return `${episodeLabel(media.snumber, media.number)} · ${formatClock(entry.time)}`

    return formatClock(entry.time)
  }

  loadMore() {
    if (this.pages.hasNextPage && !this.pages.isFetchingNextPage) void this.pages.fetchNextPage()
  }

  dispose() {
    this.scope.dispose()
  }
}
