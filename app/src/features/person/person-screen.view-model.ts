import { makeAutoObservable } from 'mobx'
import { InfiniteQuery } from 'mobx-tanstack-query'
import type { ItemShort, ItemsPage, PersonRole } from '@/services/api/api.types'
import type { Services } from '@/services/services'
import { Scope } from '@/shared/view-model/use-view-model'
import { nextPage } from '@/services/query/next-page'

export class PersonScreenViewModel {
  private readonly scope = new Scope()
  readonly pages: InfiniteQuery<ItemsPage, Error, number>

  constructor(
    { api, queryClient }: Services,
    readonly role: PersonRole,
    readonly name: string,
  ) {
    this.pages = new InfiniteQuery<ItemsPage, Error, number>({
      queryClient,
      abortSignal: this.scope.signal,
      queryKey: ['person', role, name],
      queryFn: ({ signal, pageParam }) => api.byPerson(role, name, pageParam, signal),
      initialPageParam: 1,
      getNextPageParam: nextPage,
    })
    makeAutoObservable<this, 'scope'>(this, { scope: false, role: false, name: false, pages: false }, { autoBind: true })
  }

  get list(): ItemShort[] {
    return this.pages.data?.pages.flatMap((p) => p.items) ?? []
  }

  loadMore() {
    if (this.pages.hasNextPage && !this.pages.isFetchingNextPage) void this.pages.fetchNextPage()
  }

  dispose() {
    this.scope.dispose()
  }
}
