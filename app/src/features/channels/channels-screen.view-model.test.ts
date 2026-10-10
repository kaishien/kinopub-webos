import { describe, expect, it, vi } from 'vitest'
import type { TvChannel } from '@/services/api/api.types'
import type { RouterService } from '@/services/router/router.service'
import type { Services } from '@/services/services'
import { fakeServices, type FakeServices } from '@/test/fake-services'
import { ChannelsScreenViewModel, channelsQueryKey } from './channels-screen.view-model'

/** FakeServices is not assignable to Services (see src/test/fake-services.ts); view-models only use what the fake provides. */
const svc = (s: FakeServices) => s as unknown as Services

/** RouterService methods are MobX-bound (non-configurable) so they cannot be spied; a class instance (not a plain object) survives makeAutoObservable untouched. */
class StubRouter {
  constructor(readonly navigate: ReturnType<typeof vi.fn>) {}
}

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
    // Router methods are MobX-bound actions (non-configurable), so a stub replaces spying.
    const navigate = vi.fn()
    const services = fakeServices({ router: new StubRouter(navigate) as unknown as RouterService })

    services.api.tvChannels.mockResolvedValue([channel(1), channel(2)])
    const vm = new ChannelsScreenViewModel(svc(services))

    await vi.waitFor(() => expect(vm.channels.data).toHaveLength(2))
    expect(services.api.tvChannels).toHaveBeenCalledWith(expect.any(AbortSignal))
    expect(services.queryClient.getQueryData(channelsQueryKey)).toHaveLength(2)

    vm.open(channel(2))
    expect(navigate).toHaveBeenCalledWith('/channels/2')
    vm.dispose()
  })
})
