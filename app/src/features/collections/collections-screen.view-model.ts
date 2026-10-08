import { makeAutoObservable } from 'mobx'
import { InfiniteQuery } from 'mobx-tanstack-query'
import type { Collection, ItemShort, Pagination } from '@/services/api/api.types'
import type { Services } from '@/services/services'
import { plural } from '@/shared/lib/format'
import { Scope } from '@/shared/view-model/use-view-model'
import { link } from '@/app/routes'

type CollectionsPage = { items: Collection[]; pagination: Pagination }

export class CollectionsScreenViewModel {
  private readonly scope = new Scope()
  readonly pages: InfiniteQuery<CollectionsPage, Error, number>

  constructor(private readonly services: Services) {
    const { api, queryClient } = services

    this.pages = new InfiniteQuery<CollectionsPage, Error, number>({
      queryClient,
      abortSignal: this.scope.signal,
      queryKey: ['collections'],
      queryFn: ({ signal, pageParam }) => api.collections(pageParam, signal),
      initialPageParam: 1,
      getNextPageParam: (last) => (last.pagination.current < last.pagination.total ? last.pagination.current + 1 : null),
    })
    makeAutoObservable<this, 'scope'>(this, { scope: false, pages: false }, { autoBind: true })
  }

  /** Mapped to cards because the grid can only render ItemShort. */
  get cards(): ItemShort[] {
    return (this.pages.data?.pages.flatMap((p) => p.items) ?? []).map(
      (c) =>
        ({ id: c.id, type: 'collection', subtype: '', title: c.title, year: 0, posters: c.posters, views: c.views }) as ItemShort & {
          views: number
        },
    )
  }

  subtitle(card: ItemShort) {
    const views = (card as ItemShort & { views?: number }).views ?? 0

    return `${views} ${plural(views, 'просмотр', 'просмотра', 'просмотров')}`
  }

  open(card: ItemShort) {
    void this.services.router.navigate(link.collection(card.id), { state: { title: card.title } })
  }

  loadMore() {
    if (this.pages.hasNextPage && !this.pages.isFetchingNextPage) void this.pages.fetchNextPage()
  }

  dispose() {
    this.scope.dispose()
  }
}
