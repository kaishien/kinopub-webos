// oxlint-disable import/no-named-as-default, import/no-named-as-default-member -- hls.js exports the class as default; its types only know that
import Hls, {
  ErrorTypes,
  Events,
  type AudioTrackSwitchedData,
  type AudioTracksUpdatedData,
  type ErrorData,
  type Level,
  type LevelSwitchedData,
  type MediaPlaylist,
  type SubtitleTracksUpdatedData,
  type SubtitleTrackSwitchData,
} from 'hls.js'
import { makeAutoObservable, runInAction } from 'mobx'
import type { VideoQuality } from '@/services/api/api.types'
import type { QualityPreference } from '@/services/settings/settings.service'

export interface StreamVariant {
  level: number
  quality: VideoQuality
  height: number
  bandwidth: number
}

export interface StreamAudio {
  id: number
  name: string
  lang: string
}

/** In-stream HLS4 subtitles: series often have only these, with no external files in the API. */
export interface StreamSubtitle {
  id: number
  lang: string
  forced: boolean
}

/** webOS can't play multichannel audio (AC3, E-AC3, DTS) via MSE though isTypeSupported says yes: each segment buffers a split second and video stalls. */
const UNPLAYABLE_AUDIO = /\b(E-?AC-?3|AC-?3|DTS)\b/i
const UNPLAYABLE_CODEC = /^(ac-3|ec-3|dts)/i

const QUALITY_BY_HEIGHT: Array<[number, VideoQuality]> = [
  [1600, '2160p'],
  [800, '1080p'],
  [500, '720p'],
  [0, '480p'],
]

const QUALITY_ORDER: VideoQuality[] = ['2160p', '1080p', '720p', '480p']

export type StreamFailure = 'network' | 'media' | 'audio'

const SELF_RECOVERY_ATTEMPTS = 2

export class HlsStream {
  variants: StreamVariant[] = []
  audios: StreamAudio[] = []
  quality: QualityPreference
  activeLevel = -1
  audioId = -1
  subtitles: StreamSubtitle[] = []
  subtitleId = -1
  failure: StreamFailure | null = null

  private hls: Hls | null = null
  private element: HTMLVideoElement | null = null
  private url = ''
  private startPosition = -1
  private networkRetries = 0
  private mediaRetries = 0

  constructor(quality: QualityPreference) {
    this.quality = quality
    makeAutoObservable<this, 'hls' | 'element' | 'url' | 'startPosition' | 'networkRetries' | 'mediaRetries'>(
      this,
      { hls: false, element: false, url: false, startPosition: false, networkRetries: false, mediaRetries: false },
      { autoBind: true },
    )
  }

  get variant(): StreamVariant | undefined {
    const sorted = this.sortedVariants

    if (!sorted.length) return undefined
    if (this.quality === 'auto') return sorted.find((v) => v.level === this.activeLevel) ?? sorted[0]
    if (this.quality === 'max') return sorted[0]

    const wanted = QUALITY_ORDER.indexOf(this.quality)

    return sorted.find((v) => QUALITY_ORDER.indexOf(v.quality) >= wanted) ?? sorted[sorted.length - 1]
  }

  get audio(): StreamAudio | undefined {
    return this.audios.find((a) => a.id === this.audioId) ?? this.audios[0]
  }

  get qualities(): VideoQuality[] {
    return this.sortedVariants.map((v) => v.quality)
  }

  private get sortedVariants() {
    return this.variants.toSorted((a, b) => QUALITY_ORDER.indexOf(a.quality) - QUALITY_ORDER.indexOf(b.quality))
  }

  attach(element: HTMLVideoElement | null) {
    if (this.element === element) return

    this.element = element
    this.start()
  }

  load(url: string, startPosition = -1) {
    if (this.url === url) return

    this.url = url
    this.startPosition = startPosition
    this.start()
  }

  restart(url: string, startPosition: number) {
    this.url = url
    this.startPosition = startPosition
    this.start()
  }

  lowerQuality(): VideoQuality | null {
    const current = this.variant?.quality
    const lower = this.qualities.find((quality) => QUALITY_ORDER.indexOf(quality) > QUALITY_ORDER.indexOf(current ?? '2160p'))

    if (!lower) return null

    this.setQuality(lower)

    return lower
  }

  setQuality(quality: QualityPreference) {
    this.quality = quality
    this.applyQuality()
  }

  setAudio(id: number) {
    this.audioId = id
    if (this.hls) this.hls.audioTrack = id
  }

  setSubtitle(id: number) {
    this.subtitleId = id
    if (!this.hls) return

    this.hls.subtitleTrack = id
    this.hls.subtitleDisplay = id >= 0
  }

  dispose() {
    this.hls?.destroy()
    this.hls = null
    this.element = null
  }

  private start() {
    const { element, url } = this

    if (!element || !url) return

    this.hls?.destroy()
    this.hls = null
    this.failure = null
    this.networkRetries = 0
    this.mediaRetries = 0
    // oxlint-disable-next-line import/no-named-as-default-member -- hls.js types only declare isSupported as static
    if (!Hls.isSupported()) {
      element.src = url

      return
    }

    const hls = new Hls({
      enableWorker: false,
      maxBufferLength: 40,
      backBufferLength: 30,
      startLevel: -1,
      startPosition: this.startPosition,
    })

    this.hls = hls
    hls.on(Events.MANIFEST_PARSED, this.onManifest)
    hls.on(Events.AUDIO_TRACKS_UPDATED, (_: Events.AUDIO_TRACKS_UPDATED, data: AudioTracksUpdatedData) =>
      this.onAudioTracks(data.audioTracks),
    )
    hls.on(Events.LEVEL_SWITCHED, (_: Events.LEVEL_SWITCHED, data: LevelSwitchedData) => this.onLevelSwitched(data.level))
    hls.on(Events.AUDIO_TRACK_SWITCHED, (_: Events.AUDIO_TRACK_SWITCHED, data: AudioTrackSwitchedData) => this.onAudioSwitched(data.id))
    hls.on(Events.SUBTITLE_TRACKS_UPDATED, (_: Events.SUBTITLE_TRACKS_UPDATED, data: SubtitleTracksUpdatedData) =>
      this.onSubtitleTracks(data.subtitleTracks),
    )
    hls.on(Events.SUBTITLE_TRACK_SWITCH, (_: Events.SUBTITLE_TRACK_SWITCH, data: SubtitleTrackSwitchData) =>
      this.onSubtitleSwitched(data.id),
    )
    hls.on(Events.ERROR, (_: Events.ERROR, data: ErrorData) => this.onError(data))
    hls.attachMedia(element)
    hls.loadSource(url)
  }

  private onManifest() {
    const hls = this.hls

    if (!hls) return

    this.variants = hls.levels.map(toVariant)
    // No buffer before the first fragment, so pin the chosen level now; Auto starts low and climbs on its own.
    this.applyQuality()
  }

  /** Audio tracks arrive separately from the manifest; drop unplayable ones and move off an unplayable default. */
  private onAudioTracks(tracks: MediaPlaylist[]) {
    this.audios = tracks.filter(isPlayable).map(toAudio)
    const current = this.hls?.audioTrack ?? -1

    if (!this.audios.length) {
      // Every track is multichannel: this path can't play it, the fallback is needed.
      this.failure = 'audio'

      return
    }
    if (this.audios.some((audio) => audio.id === current)) this.audioId = current
    else this.setAudio(this.audios[0].id)
  }

  /** hls.js auto-enables DEFAULT=YES tracks; keep only the viewer's choice, including across stream restarts. */
  private onSubtitleTracks(tracks: MediaPlaylist[]) {
    this.subtitles = tracks.map(toSubtitle)
    this.setSubtitle(this.subtitles.some((track) => track.id === this.subtitleId) ? this.subtitleId : -1)
  }

  private onSubtitleSwitched(id: number) {
    this.subtitleId = id
  }

  private onLevelSwitched(level: number) {
    this.activeLevel = level
  }

  private onAudioSwitched(id: number) {
    this.audioId = id
  }

  private get level() {
    return this.quality === 'auto' ? -1 : (this.variant?.level ?? -1)
  }

  private applyQuality() {
    const hls = this.hls

    if (!hls || !this.variants.length) return

    hls.currentLevel = this.level
  }

  private onError(data: ErrorData) {
    if (!data.fatal || !this.hls) return
    if (data.type === ErrorTypes.NETWORK_ERROR && this.networkRetries < SELF_RECOVERY_ATTEMPTS) {
      this.networkRetries++
      this.hls.startLoad()

      return
    }
    if (data.type === ErrorTypes.MEDIA_ERROR && this.mediaRetries < SELF_RECOVERY_ATTEMPTS) {
      this.mediaRetries++
      this.hls.recoverMediaError()

      return
    }

    runInAction(() => {
      this.failure = data.type === ErrorTypes.NETWORK_ERROR ? 'network' : 'media'
    })
  }
}

function toVariant(level: Level, index: number): StreamVariant {
  return {
    level: index,
    quality: QUALITY_BY_HEIGHT.find(([min]) => level.height >= min)?.[1] ?? '480p',
    height: level.height,
    bandwidth: level.bitrate,
  }
}

function isPlayable(track: MediaPlaylist): boolean {
  return !UNPLAYABLE_AUDIO.test(track.name ?? '') && !UNPLAYABLE_CODEC.test(track.audioCodec ?? '')
}

function toAudio(track: MediaPlaylist): StreamAudio {
  return { id: track.id, name: track.name || `Дорожка ${track.id + 1}`, lang: track.lang ?? '' }
}

function toSubtitle(track: MediaPlaylist): StreamSubtitle {
  return { id: track.id, lang: track.lang ?? '', forced: track.forced || /forced/i.test(track.name ?? '') }
}
