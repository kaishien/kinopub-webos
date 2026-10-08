import { Query } from 'mobx-tanstack-query'
import type { Collection, ItemShort } from '@/services/api/api.types'
import type { Services } from '@/services/services'
import { Scope } from '@/shared/view-model/use-view-model'

export class CollectionScreenViewModel {
  private readonly scope = new Scope()
  readonly data: Query<{ items: ItemShort[]; collection: Collection }>

  constructor(
    { api, queryClient }: Services,
    readonly id: number,
  ) {
    this.data = new Query<{ items: ItemShort[]; collection: Collection }>({
      queryClient,
      abortSignal: this.scope.signal,
      queryKey: ['collections', id],
      queryFn: ({ signal }) => api.collectionItems(id, signal),
    })
  }

  dispose() {
    this.scope.dispose()
  }
}
