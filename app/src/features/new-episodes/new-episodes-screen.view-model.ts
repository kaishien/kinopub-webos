import { makeAutoObservable } from 'mobx'
import { Query } from 'mobx-tanstack-query'
import type { ItemShort } from '@/services/api/api.types'
import type { Services } from '@/services/services'
import { plural } from '@/shared/lib/format'
import { Scope } from '@/shared/view-model/use-view-model'

export class NewEpisodesScreenViewModel {
  private readonly scope = new Scope()
  readonly serials: Query<ItemShort[]>

  constructor({ api, queryClient }: Services) {
    this.serials = new Query<ItemShort[]>({
      queryClient,
      abortSignal: this.scope.signal,
      queryKey: ['watching', 'serials', 'subscribed'],
      queryFn: ({ signal }) => api.watchingSerials(1, signal),
      staleTime: 0,
    })
    makeAutoObservable<this, 'scope'>(this, { scope: false, serials: false }, { autoBind: true })
  }

  get list(): ItemShort[] {
    return (this.serials.data ?? []).filter((item) => (item.new ?? 0) > 0)
  }

  get isEmpty() {
    return this.serials.isSuccess && this.list.length === 0
  }

  get error() {
    return this.serials.error?.message ?? null
  }

  retry() {
    void this.serials.refetch()
  }

  static subtitle(item: ItemShort) {
    const count = item.new ?? 0
    return `${count} ${plural(count, 'новая серия', 'новые серии', 'новых серий')}`
  }

  dispose() {
    this.scope.dispose()
  }
}
