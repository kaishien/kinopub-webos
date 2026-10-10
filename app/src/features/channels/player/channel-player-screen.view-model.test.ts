import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TvChannel } from '@/services/api/api.types'
import { RemoteKey } from '@/services/remote/remote.service'
import { fakeServices } from '@/test/fake-services'
import { FakeErrorTypes, FakeHls } from '@/features/player/stream/fake-hls'
import { ChannelPlayerScreenViewModel } from './channel-player-screen.view-model'

vi.mock('hls.js', async () => (await import('@/features/player/stream/fake-hls')).fakeHlsModule())

const HUD_MS = 3500
const START_TIMEOUT_MS = 20000

const channel = (id: number): TvChannel => ({
  id,
  name: `ch${id}`,
  title: `Канал ${id}`,
  logos: { s: '', m: '' },
  stream: `https://tv.test/${id}.m3u8`,
  embed: '',
  current: '',
  playlist: '',
  status: 'online',
})

const CHANNELS = [channel(1), channel(2), channel(3)]

const key = (keyCode: number, name = '') => ({ keyCode, key: name, target: null }) as unknown as KeyboardEvent

async function settle() {
  for (let i = 0; i < 4; i++) await vi.advanceTimersByTimeAsync(0)
}

async function setup(channelId = 2, channels = CHANNELS) {
  const services = fakeServices()
  const router = {
    replace: vi.spyOn(services.router, 'replace').mockResolvedValue(undefined),
    back: vi.spyOn(services.router, 'back').mockReturnValue(true),
  }

  services.api.tvChannels.mockResolvedValue(channels)
  const push = vi.spyOn(services.remote, 'push')
  const vm = new ChannelPlayerScreenViewModel(services, channelId)
  const onKey = push.mock.calls[0][0] as (event: KeyboardEvent) => boolean
  const element = {} as HTMLVideoElement

  vm.attach(element)
  await settle()

  return { vm, services, router, onKey, element }
}

describe('ChannelPlayerScreenViewModel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeHls.reset()
  })

  it('finds the channel in the list and streams it through hls.js', async () => {
    const { vm, element } = await setup()

    expect(vm.index).toBe(1)
    expect(vm.channel?.title).toBe('Канал 2')
    expect(FakeHls.instances).toHaveLength(1)
    expect(FakeHls.last.loadSource).toHaveBeenCalledWith('https://tv.test/2.m3u8')
    expect(FakeHls.last.attachMedia).toHaveBeenCalledWith(element)
    expect(vm.loading).toBe(true)
  })

  it('has no channel while the list is unknown', async () => {
    const { vm } = await setup(99)

    expect(vm.channel).toBeUndefined()
    expect(vm.index).toBe(-1)
    expect(FakeHls.instances).toHaveLength(0)
  })

  it('leaves the loading state once playback starts', async () => {
    const { vm } = await setup()

    vm.onPlaying()

    expect(vm.loading).toBe(false)
    expect(vm.error).toBe('')
  })

  it('reports an unreachable server when nothing plays within the start timeout', async () => {
    const { vm } = await setup()

    vi.advanceTimersByTime(START_TIMEOUT_MS - 1)
    expect(vm.error).toBe('')

    vi.advanceTimersByTime(1)
    expect(vm.error).toContain('Эфир не загружается')
  })

  it('does not report a timeout once playback has started', async () => {
    const { vm } = await setup()

    vm.onPlaying()
    vi.advanceTimersByTime(START_TIMEOUT_MS)

    expect(vm.error).toBe('')
  })

  it('shows the channel error when the stream fails for good', async () => {
    const { vm } = await setup()

    FakeHls.last.fatal(FakeErrorTypes.NETWORK_ERROR)
    FakeHls.last.fatal(FakeErrorTypes.NETWORK_ERROR)
    expect(vm.error).toBe('')

    FakeHls.last.fatal(FakeErrorTypes.NETWORK_ERROR)

    expect(vm.error).toContain('Канал не отвечает')
    expect(vm.loading).toBe(false)

    vi.advanceTimersByTime(START_TIMEOUT_MS)
    expect(vm.error).toContain('Канал не отвечает')
  })

  it('hides the HUD after a few seconds and brings it back on any unhandled key', async () => {
    const { vm, onKey } = await setup()

    expect(vm.hudVisible).toBe(true)
    vi.advanceTimersByTime(HUD_MS)
    expect(vm.hudVisible).toBe(false)

    expect(onKey(key(RemoteKey.Enter))).toBe(false)
    expect(vm.hudVisible).toBe(true)
  })

  it('switches channels with the arrows, wrapping around the list', async () => {
    const { onKey, router } = await setup(3)

    expect(onKey(key(RemoteKey.Up))).toBe(true)
    expect(router.replace).toHaveBeenLastCalledWith('/channels/1')

    expect(onKey(key(RemoteKey.Down))).toBe(true)
    expect(router.replace).toHaveBeenLastCalledWith('/channels/2')
  })

  it('channel keys switch too', async () => {
    const { onKey, router } = await setup(1)

    expect(onKey(key(RemoteKey.ChannelDown))).toBe(true)
    expect(router.replace).toHaveBeenLastCalledWith('/channels/3')

    expect(onKey(key(RemoteKey.ChannelUp))).toBe(true)
    expect(router.replace).toHaveBeenLastCalledWith('/channels/2')
  })

  it('ignores channel switching while the list is empty', async () => {
    const { onKey, router } = await setup(1, [])

    expect(onKey(key(RemoteKey.Up))).toBe(true)
    expect(router.replace).not.toHaveBeenCalled()
  })

  it('back leaves the player', async () => {
    const { onKey, router } = await setup()

    expect(onKey(key(RemoteKey.Back))).toBe(true)
    expect(router.back).toHaveBeenCalledTimes(1)
  })

  it('dispose stops the stream, the timers and the key handling', async () => {
    const { vm, onKey, router } = await setup()
    const hls = FakeHls.last

    vm.dispose()
    vi.advanceTimersByTime(START_TIMEOUT_MS)

    expect(hls.destroy).toHaveBeenCalledTimes(1)
    expect(vm.hudVisible).toBe(true)
    expect(vm.error).toBe('')

    window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: RemoteKey.Back }))
    expect(router.back).not.toHaveBeenCalled()
    expect(onKey).toBeTypeOf('function')
  })
})
