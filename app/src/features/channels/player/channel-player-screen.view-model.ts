import { makeAutoObservable, reaction } from 'mobx'
import { Query } from 'mobx-tanstack-query'
import type { TvChannel } from '@/services/api/api.types'
import { RemoteKey, RemoteService } from '@/services/remote/remote.service'
import type { Services } from '@/services/services'
import { Scope } from '@/shared/view-model/use-view-model'
import { link } from '@/app/routes'
import { HlsStream } from '@/features/player/stream/hls-stream'
import { channelsQueryKey } from '@/features/channels/channels-screen.view-model'

const HUD_MS = 3500
/** If the stream hasn't started by then, the channels server is likely unreachable from this network. */
const START_TIMEOUT_MS = 20000
const UNREACHABLE_MESSAGE =
  'Эфир не загружается: сервер каналов не отдаёт видео в вашей сети. Обычно помогает VPN на роутере. Можно попробовать другой канал стрелками вверх и вниз.'

/** Played via hls.js: the TV's native player answers a direct HLS URL with "Format error" though canPlayType says "maybe". */
export class ChannelPlayerScreenViewModel {
  private readonly scope = new Scope()
  hudVisible = true
  error = ''
  loading = true
  readonly channels: Query<TvChannel[]>
  readonly stream = new HlsStream('auto')
  private hudTimer: number | null = null
  private startTimer: number | null = null
  private readonly unsubscribe: () => void

  constructor(
    private readonly services: Services,
    readonly channelId: number,
  ) {
    const { api, queryClient, remote } = services

    this.channels = new Query<TvChannel[]>({
      queryClient,
      abortSignal: this.scope.signal,
      queryKey: channelsQueryKey,
      queryFn: ({ signal }) => api.tvChannels(signal),
    })
    makeAutoObservable<this, 'scope' | 'hudTimer' | 'startTimer' | 'unsubscribe'>(
      this,
      { scope: false, channelId: false, channels: false, stream: false, hudTimer: false, startTimer: false, unsubscribe: false },
      { autoBind: true },
    )
    this.unsubscribe = remote.push(this.onKey)
    this.scope.defer(
      reaction(
        () => this.channel?.stream,
        (url) => {
          if (url) this.stream.load(url)
        },
        { fireImmediately: true },
      ),
    )
    this.scope.defer(
      reaction(
        () => this.stream.failure,
        (failure) => {
          if (failure) this.onVideoError()
        },
      ),
    )
    this.scope.defer(this.stream.dispose)
    this.startTimer = window.setTimeout(this.onStartTimeout, START_TIMEOUT_MS)
    this.showHud()
  }

  get list() {
    return this.channels.data ?? []
  }

  get index() {
    return this.list.findIndex((c) => c.id === this.channelId)
  }

  get channel(): TvChannel | undefined {
    return this.list[this.index]
  }

  showHud() {
    this.hudVisible = true
    if (this.hudTimer) clearTimeout(this.hudTimer)

    this.hudTimer = window.setTimeout(() => {
      this.hudVisible = false
    }, HUD_MS)
  }

  attach(element: HTMLVideoElement | null) {
    this.stream.attach(element)
  }

  onPlaying() {
    this.loading = false
    this.error = ''
  }

  private onStartTimeout() {
    if (this.loading && !this.error) this.error = UNREACHABLE_MESSAGE
  }

  onVideoError() {
    this.error = 'Канал не отвечает. Попробуйте другой: стрелки вверх и вниз.'
    this.loading = false
  }

  private switchBy(delta: number) {
    const list = this.list

    if (!list.length) return

    const next = list[(this.index + delta + list.length) % list.length]

    void this.services.router.replace(link.channel(next.id))
  }

  private onKey(event: KeyboardEvent): boolean {
    if (RemoteService.isBack(event)) {
      this.services.router.back()

      return true
    }
    if (event.keyCode === RemoteKey.Up || event.keyCode === RemoteKey.ChannelUp) {
      this.switchBy(1)

      return true
    }
    if (event.keyCode === RemoteKey.Down || event.keyCode === RemoteKey.ChannelDown) {
      this.switchBy(-1)

      return true
    }

    this.showHud()

    return false
  }

  dispose() {
    this.scope.dispose()
    this.unsubscribe()
    if (this.hudTimer) clearTimeout(this.hudTimer)
    if (this.startTimer) clearTimeout(this.startTimer)
  }
}
