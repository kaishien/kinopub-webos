import { vi } from 'vitest'

/**
 * Stand-in for the `hls.js` default export, for `vi.mock('hls.js', ...)`.
 * Event and error-type values match the real library so `hls-stream.ts` keys line up.
 */
export const FakeEvents = {
  MANIFEST_PARSED: 'hlsManifestParsed',
  LEVEL_SWITCHED: 'hlsLevelSwitched',
  AUDIO_TRACKS_UPDATED: 'hlsAudioTracksUpdated',
  AUDIO_TRACK_SWITCHED: 'hlsAudioTrackSwitched',
  SUBTITLE_TRACKS_UPDATED: 'hlsSubtitleTracksUpdated',
  SUBTITLE_TRACK_SWITCH: 'hlsSubtitleTrackSwitch',
  ERROR: 'hlsError',
} as const

export const FakeErrorTypes = {
  NETWORK_ERROR: 'networkError',
  MEDIA_ERROR: 'mediaError',
  OTHER_ERROR: 'otherError',
} as const

export interface FakeLevel {
  height: number
  bitrate: number
}

export interface FakeTrack {
  id: number
  name?: string
  lang?: string
  audioCodec?: string
  forced?: boolean
  default?: boolean
}

type Handler = (event: string, data: unknown) => void

export class FakeHls {
  static instances: FakeHls[] = []
  static supported = true

  static isSupported() {
    return FakeHls.supported
  }

  static reset() {
    FakeHls.instances = []
    FakeHls.supported = true
  }

  /** The most recently constructed instance, which is the one `HlsStream` drives. */
  static get last(): FakeHls {
    const instance = FakeHls.instances.at(-1)

    if (!instance) throw new Error('No Hls instance was created')

    return instance
  }

  levels: FakeLevel[] = []
  currentLevel = -1
  nextLevel = -1
  audioTrack = -1
  subtitleTrack = -1
  subtitleDisplay = false
  readonly config: Record<string, unknown>
  readonly loadSource = vi.fn<(url: string) => void>()
  readonly attachMedia = vi.fn<(element: HTMLMediaElement) => void>()
  readonly startLoad = vi.fn()
  readonly recoverMediaError = vi.fn()
  readonly destroy = vi.fn()
  private readonly handlers = new Map<string, Set<Handler>>()

  constructor(config: Record<string, unknown> = {}) {
    this.config = config
    FakeHls.instances.push(this)
  }

  on(event: string, handler: Handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())

    this.handlers.get(event)!.add(handler)
  }

  off(event: string, handler?: Handler) {
    if (handler) this.handlers.get(event)?.delete(handler)
    else this.handlers.delete(event)
  }

  emit(event: string, data: unknown = {}) {
    this.handlers.get(event)?.forEach((handler) => handler(event, data))
  }

  /** Set the levels and fire MANIFEST_PARSED, as hls.js does after loadSource. */
  parseManifest(heights: number[]) {
    this.levels = heights.map((height) => ({ height, bitrate: height * 1000 }))
    this.emit(FakeEvents.MANIFEST_PARSED, { levels: this.levels })
  }

  updateAudioTracks(tracks: FakeTrack[]) {
    this.emit(FakeEvents.AUDIO_TRACKS_UPDATED, { audioTracks: tracks })
  }

  updateSubtitleTracks(tracks: FakeTrack[]) {
    this.emit(FakeEvents.SUBTITLE_TRACKS_UPDATED, { subtitleTracks: tracks })
  }

  fatal(type: string) {
    this.emit(FakeEvents.ERROR, { type, fatal: true, details: 'test' })
  }
}

/** Factory for `vi.mock('hls.js', fakeHlsModule)`. */
export function fakeHlsModule() {
  return { default: FakeHls, Events: FakeEvents, ErrorTypes: FakeErrorTypes }
}
