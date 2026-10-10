import { describe, expect, it, vi } from 'vitest'
import type { TvChannel } from '@/services/api/api.types'
import { fakeServices } from '@/test/fake-services'
import { ChannelsScreenViewModel, channelsQueryKey } from './channels-screen.view-model'

const channel = (id: number): TvChannel => ({
  id,
  name: `ch${id}`,
  title: `Канал ${id}`,
  logos: { s: '', m: '' },
  stream: '',
  embed: '',
  current: '',
  playlist: '',
  status: 'online',
})

describe('ChannelsScreenViewModel', () => {
  it('loads the channel list under the shared key and opens a channel', async () => {
    const services = fakeServices()
    const navigate = vi.spyOn(services.router, 'navigate')

    services.api.tvChannels.mockResolvedValue([channel(1), channel(2)])
    const vm = new ChannelsScreenViewModel(services)

    await vi.waitFor(() => expect(vm.channels.data).toHaveLength(2))
    expect(services.api.tvChannels).toHaveBeenCalledWith(expect.any(AbortSignal))
    expect(services.queryClient.getQueryData(channelsQueryKey)).toHaveLength(2)

    vm.open(channel(2))
    expect(navigate).toHaveBeenCalledWith('/channels/2')
    vm.dispose()
  })
})
