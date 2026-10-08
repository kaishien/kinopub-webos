import { makeAutoObservable } from 'mobx'
import { InfiniteQuery } from 'mobx-tanstack-query'
import type { HistoryEntry, HistoryPage, ItemShort } from '@/services/api/api.types'
import type { Services } from '@/services/services'
import { episodeLabel, formatClock } from '@/shared/lib/format'
import { Scope } from '@/shared/view-model/use-view-model'

export class HistoryScreenViewModel {
  private readonly scope = new Scope()
  readonly pages: InfiniteQuery<HistoryPage, Error, number>

  constructor({ api, queryClient }: Services) {
    this.pages = new InfiniteQuery<HistoryPage, Error, number>({
      queryClient,
      abortSignal: this.scope.signal,
      queryKey: ['history'],
      queryFn: ({ signal, pageParam }) => api.history(pageParam, signal),
      initialPageParam: 1,
      getNextPageParam: (last) => (last.pagination.current < last.pagination.total ? last.pagination.current + 1 : null),
      staleTime: 0,
    })
    makeAutoObservable<this, 'scope'>(this, { scope: false, pages: false }, { autoBind: true })
  }

  get entries(): HistoryEntry[] {
    return this.pages.data?.pages.flatMap((p) => p.history) ?? []
  }

  get items(): ItemShort[] {
    return this.entries.map((e) => e.item)
  }

  subtitle(item: ItemShort): string | undefined {
    const entry = this.entries.find((e) => e.item.id === item.id)
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
