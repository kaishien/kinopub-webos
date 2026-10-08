import { Query } from 'mobx-tanstack-query'
import type { BookmarkFolder } from '@/services/api/api.types'
import type { Services } from '@/services/services'
import { Scope } from '@/shared/view-model/use-view-model'
import { link } from '@/app/routes'

export class BookmarksScreenViewModel {
  private readonly scope = new Scope()
  readonly folders: Query<BookmarkFolder[]>

  constructor(private readonly services: Services) {
    const { api, queryClient } = services
    this.folders = new Query<BookmarkFolder[]>({
      queryClient,
      abortSignal: this.scope.signal,
      queryKey: ['bookmarks'],
      queryFn: ({ signal }) => api.bookmarkFolders(signal),
      staleTime: 0,
    })
  }

  open(folder: BookmarkFolder) {
    void this.services.router.navigate(link.bookmarkFolder(folder.id), { state: { title: folder.title } })
  }

  dispose() {
    this.scope.dispose()
  }
}
