import { makeAutoObservable } from 'mobx'
import { InfiniteQuery } from 'mobx-tanstack-query'
import type { BookmarkFolder, ItemShort, Pagination } from '@/services/api/api.types'
import type { Services } from '@/services/services'
import { Scope } from '@/shared/view-model/use-view-model'
import { nextPage } from '@/services/query/next-page'

type FolderPage = { folder: BookmarkFolder; items: ItemShort[]; pagination: Pagination }

export class BookmarkFolderScreenViewModel {
  private readonly scope = new Scope()
  readonly pages: InfiniteQuery<FolderPage, Error, number>

  constructor(
    { api, queryClient }: Services,
    readonly id: number,
  ) {
    this.pages = new InfiniteQuery<FolderPage, Error, number>({
      queryClient,
      abortSignal: this.scope.signal,
      queryKey: ['bookmarks', 'folder', id],
      queryFn: ({ signal, pageParam }) => api.bookmarkFolderItems(id, pageParam, signal),
      initialPageParam: 1,
      getNextPageParam: nextPage,
      staleTime: 0,
    })
    makeAutoObservable<this, 'scope'>(this, { scope: false, id: false, pages: false }, { autoBind: true })
  }

  get title() {
    return this.pages.data?.pages[0]?.folder.title
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
