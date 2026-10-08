import { makeAutoObservable } from 'mobx'
import { InfiniteQuery } from 'mobx-tanstack-query'
import type { ItemShort, ItemsPage } from '@/services/api/api.types'
import type { Services } from '@/services/services'
import { Scope } from '@/shared/view-model/use-view-model'

const MIN_QUERY_LENGTH = 2
const STORAGE_KEY = 'search-query'

export class SearchScreenViewModel {
  private readonly scope = new Scope()
  query: string
  readonly results: InfiniteQuery<ItemsPage, Error, number>

  constructor(private readonly services: Services) {
    const { api, queryClient, storage } = services
    this.query = storage.get(STORAGE_KEY, '')
    makeAutoObservable<this, 'scope'>(this, { scope: false, results: false }, { autoBind: true })

    this.results = new InfiniteQuery<ItemsPage, Error, number>(queryClient, () => ({
      abortSignal: this.scope.signal,
      enabled: this.normalized.length >= MIN_QUERY_LENGTH,
      dynamicOptionsUpdateDelay: 450,
      queryKey: ['search', this.normalized],
      queryFn: ({ signal, pageParam }) => api.search(this.normalized, pageParam, signal),
      initialPageParam: 1,
      getNextPageParam: (last) => (last.pagination && last.pagination.current < last.pagination.total ? last.pagination.current + 1 : null),
    }))
  }

  get normalized() {
    return this.query.trim()
  }

  get list(): ItemShort[] {
    return this.results.data?.pages.flatMap((p) => p.items) ?? []
  }

  get isEmptyResult() {
    return this.normalized.length >= MIN_QUERY_LENGTH && this.results.isFetched && !this.results.isFetching && this.list.length === 0
  }

  setQuery(value: string) {
    this.query = value
    this.services.storage.set(STORAGE_KEY, value)
  }

  loadMore() {
    if (this.results.hasNextPage && !this.results.isFetchingNextPage) void this.results.fetchNextPage()
  }

  dispose() {
    this.scope.dispose()
  }
}
