import { makeAutoObservable } from 'mobx'
import { Query } from 'mobx-tanstack-query'
import type { ItemShort } from '@/services/api/api.types'
import type { Services } from '@/services/services'
import { plural } from '@/shared/lib/format'
import { Scope } from '@/shared/view-model/use-view-model'

export class WatchingScreenViewModel {
  private readonly scope = new Scope()
  readonly serials: Query<ItemShort[]>
  readonly movies: Query<ItemShort[]>

  constructor({ api, queryClient }: Services) {
    this.serials = new Query<ItemShort[]>({
      queryClient,
      abortSignal: this.scope.signal,
      queryKey: ['watching', 'serials'],
      queryFn: ({ signal }) => api.watchingSerials(0, signal),
      staleTime: 0,
    })
    this.movies = new Query<ItemShort[]>({
      queryClient,
      abortSignal: this.scope.signal,
      queryKey: ['watching', 'movies'],
      queryFn: ({ signal }) => api.watchingMovies(signal),
      staleTime: 0,
    })
    makeAutoObservable<this, 'scope'>(this, { scope: false, serials: false, movies: false }, { autoBind: true })
  }

  get isLoading() {
    return this.serials.isLoading || this.movies.isLoading
  }

  get isEmpty() {
    return this.serials.isSuccess && this.movies.isSuccess && !this.serials.data?.length && !this.movies.data?.length
  }

  get error() {
    return this.serials.error?.message ?? this.movies.error?.message ?? null
  }

  retry() {
    void this.serials.refetch()
    void this.movies.refetch()
  }

  static progress(item: ItemShort) {
    return item.total ? (item.watched ?? 0) / item.total : undefined
  }

  static subtitle(item: ItemShort) {
    if (item.new) return `${item.new} ${plural(item.new, 'новая серия', 'новые серии', 'новых серий')}`

    return item.total ? `${item.watched ?? 0} из ${item.total}` : undefined
  }

  dispose() {
    this.scope.dispose()
  }
}
