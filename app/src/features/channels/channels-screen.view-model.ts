import { Query } from 'mobx-tanstack-query'
import type { TvChannel } from '@/services/api/api.types'
import type { Services } from '@/services/services'
import { Scope } from '@/shared/view-model/use-view-model'
import { link } from '@/app/routes'

export const channelsQueryKey = ['channels'] as const

export class ChannelsScreenViewModel {
  private readonly scope = new Scope()
  readonly channels: Query<TvChannel[]>

  constructor(private readonly services: Services) {
    const { api, queryClient } = services

    this.channels = new Query<TvChannel[]>({
      queryClient,
      abortSignal: this.scope.signal,
      queryKey: channelsQueryKey,
      queryFn: ({ signal }) => api.tvChannels(signal),
    })
  }

  open(channel: TvChannel) {
    void this.services.router.navigate(link.channel(channel.id))
  }

  dispose() {
    this.scope.dispose()
  }
}
