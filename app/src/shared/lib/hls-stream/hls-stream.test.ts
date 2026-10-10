import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { QualityPreference } from '@/services/settings/settings.service'
import { FakeErrorTypes, FakeEvents, FakeHls } from './fake-hls'
import { HlsStream } from './hls-stream'

vi.mock('hls.js', async () => (await import('./fake-hls')).fakeHlsModule())

const URL1 = 'https://cdn.test/a.m3u8'
const URL2 = 'https://cdn.test/b.m3u8'

function element() {
  return { src: '' } as unknown as HTMLVideoElement
}

/** A stream that is attached, loading URL1 and has parsed the given ladder (top to bottom by default). */
function playing(quality: QualityPreference, heights = [2160, 1080, 720, 480]) {
  const stream = new HlsStream(quality)
  const el = element()

  stream.attach(el)
  stream.load(URL1, 0)
  FakeHls.last.parseManifest(heights)

  return { stream, el, hls: FakeHls.last }
}

describe('HlsStream', () => {
  beforeEach(() => {
    FakeHls.reset()
  })

  describe('lifecycle', () => {
    it('does nothing until both an element and a URL are known', () => {
      const stream = new HlsStream('auto')

      stream.load(URL1)
      expect(FakeHls.instances).toHaveLength(0)

      stream.attach(element())
      expect(FakeHls.instances).toHaveLength(1)
    })

    it('attaches the media and loads the source with the start position', () => {
      const stream = new HlsStream('auto')
      const el = element()

      stream.attach(el)
      stream.load(URL1, 42)

      const hls = FakeHls.last

      expect(hls.attachMedia).toHaveBeenCalledWith(el)
      expect(hls.loadSource).toHaveBeenCalledWith(URL1)
      expect(hls.config.startPosition).toBe(42)
      expect(hls.config.startLevel).toBe(-1)
    })

    it('ignores loading the same URL twice', () => {
      const stream = new HlsStream('auto')

      stream.attach(element())
      stream.load(URL1)
      stream.load(URL1, 10)

      expect(FakeHls.instances).toHaveLength(1)
    })

    it('restarts on a new URL, destroying the previous instance', () => {
      const stream = new HlsStream('auto')

      stream.attach(element())
      stream.load(URL1)
      const first = FakeHls.last

      stream.load(URL2)

      expect(first.destroy).toHaveBeenCalledTimes(1)
      expect(FakeHls.instances).toHaveLength(2)
      expect(FakeHls.last.loadSource).toHaveBeenCalledWith(URL2)
    })

    it('restart reloads even the same URL from the given position and clears the failure', () => {
      const { stream, hls } = playing('auto')

      hls.fatal(FakeErrorTypes.MEDIA_ERROR)
      hls.fatal(FakeErrorTypes.MEDIA_ERROR)
      hls.fatal(FakeErrorTypes.MEDIA_ERROR)
      expect(stream.failure).toBe('media')

      stream.restart(URL1, 300)

      expect(hls.destroy).toHaveBeenCalledTimes(1)
      expect(stream.failure).toBeNull()
      expect(FakeHls.last).not.toBe(hls)
      expect(FakeHls.last.config.startPosition).toBe(300)
    })

    it('re-attaching the same element is a no-op', () => {
      const stream = new HlsStream('auto')
      const el = element()

      stream.attach(el)
      stream.load(URL1)
      stream.attach(el)

      expect(FakeHls.instances).toHaveLength(1)
    })

    it('detaching keeps the instance but a later load waits for a new element', () => {
      const stream = new HlsStream('auto')

      stream.attach(element())
      stream.load(URL1)
      stream.attach(null)
      stream.load(URL2)

      expect(FakeHls.instances).toHaveLength(1)
    })

    it('falls back to a plain src when MSE is unsupported', () => {
      FakeHls.supported = false
      const stream = new HlsStream('auto')
      const el = element()

      stream.attach(el)
      stream.load(URL1)

      expect(el.src).toBe(URL1)
      expect(FakeHls.instances).toHaveLength(0)
    })

    it('dispose destroys the instance and forgets the element', () => {
      const { stream, hls } = playing('auto')

      stream.dispose()
      stream.load(URL2)

      expect(hls.destroy).toHaveBeenCalledTimes(1)
      expect(FakeHls.instances).toHaveLength(1)
    })
  })

  describe('quality', () => {
    it('maps level heights to qualities sorted from best to worst', () => {
      const { stream } = playing('auto', [480, 1080, 2160, 720, 1600, 800, 500])

      expect(stream.qualities).toEqual(['2160p', '2160p', '1080p', '1080p', '720p', '720p', '480p'])
    })

    it('auto leaves the level choice to hls.js', () => {
      const { stream, hls } = playing('auto')

      expect(hls.currentLevel).toBe(-1)
      expect(stream.variant?.quality).toBe('2160p')
    })

    it('auto reports the level hls.js actually switched to', () => {
      const { stream, hls } = playing('auto')

      hls.emit(FakeEvents.LEVEL_SWITCHED, { level: 2 })

      expect(stream.activeLevel).toBe(2)
      expect(stream.variant?.quality).toBe('720p')
    })

    it('max pins the top level as soon as the manifest is parsed', () => {
      const { stream, hls } = playing('max', [480, 720, 1080])

      expect(hls.currentLevel).toBe(2)
      expect(stream.variant?.quality).toBe('1080p')
    })

    it('a fixed preference pins the matching level', () => {
      const { stream, hls } = playing('720p', [2160, 1080, 720, 480])

      expect(hls.currentLevel).toBe(2)
      expect(stream.variant?.quality).toBe('720p')
    })

    it('a preference above the ladder picks the best available, one between levels picks the next lower', () => {
      expect(playing('2160p', [1080, 720]).stream.variant?.quality).toBe('1080p')
      expect(playing('1080p', [2160, 720]).stream.variant?.quality).toBe('720p')
    })

    it('a preference below the ladder picks the lowest level', () => {
      const { stream, hls } = playing('480p', [2160, 1080])

      expect(stream.variant?.quality).toBe('1080p')
      expect(hls.currentLevel).toBe(1)
    })

    it('setQuality switches the level on the fly', () => {
      const { stream, hls } = playing('max')

      stream.setQuality('480p')
      expect(hls.currentLevel).toBe(3)

      stream.setQuality('auto')
      expect(hls.currentLevel).toBe(-1)
    })

    it('remembers a quality set before the manifest and applies it on parse', () => {
      const stream = new HlsStream('auto')

      stream.attach(element())
      stream.load(URL1)
      stream.setQuality('1080p')
      FakeHls.last.parseManifest([2160, 1080, 720])

      expect(FakeHls.last.currentLevel).toBe(1)
    })

    it('has no variant before the manifest', () => {
      const stream = new HlsStream('max')

      expect(stream.variant).toBeUndefined()
      expect(stream.qualities).toEqual([])
    })
  })

  describe('lowerQuality', () => {
    it('steps down one quality and pins it', () => {
      const { stream, hls } = playing('max')

      expect(stream.lowerQuality()).toBe('1080p')
      expect(stream.quality).toBe('1080p')
      expect(hls.currentLevel).toBe(1)

      expect(stream.lowerQuality()).toBe('720p')
      expect(stream.lowerQuality()).toBe('480p')
    })

    it('returns null at the bottom of the ladder', () => {
      const { stream } = playing('480p')

      expect(stream.lowerQuality()).toBeNull()
      expect(stream.quality).toBe('480p')
    })

    it('steps below the level hls.js was playing in auto', () => {
      const { stream, hls } = playing('auto')

      hls.emit(FakeEvents.LEVEL_SWITCHED, { level: 1 })

      expect(stream.lowerQuality()).toBe('720p')
      expect(hls.currentLevel).toBe(2)
    })

    it('skips duplicate heights of the same quality', () => {
      const { stream } = playing('max', [2160, 1080, 1000, 720])

      expect(stream.lowerQuality()).toBe('1080p')
      expect(stream.lowerQuality()).toBe('720p')
    })
  })

  describe('audio tracks', () => {
    it('lists the tracks and keeps the current one when it is playable', () => {
      const { stream, hls } = playing('auto')

      hls.audioTrack = 1
      hls.updateAudioTracks([
        { id: 0, name: '1. Дубляж', lang: 'rus' },
        { id: 1, name: '2. Original', lang: 'eng' },
      ])

      expect(stream.audios).toEqual([
        { id: 0, name: '1. Дубляж', lang: 'rus' },
        { id: 1, name: '2. Original', lang: 'eng' },
      ])
      expect(stream.audioId).toBe(1)
      expect(stream.audio?.lang).toBe('eng')
      expect(hls.audioTrack).toBe(1)
    })

    it('drops multichannel tracks by name (AC3, E-AC3, DTS)', () => {
      const { stream, hls } = playing('auto')

      hls.updateAudioTracks([
        { id: 0, name: 'Дубляж AC3 5.1', lang: 'rus' },
        { id: 1, name: 'Дубляж E-AC-3', lang: 'rus' },
        { id: 2, name: 'Original DTS', lang: 'eng' },
        { id: 3, name: 'Дубляж AAC', lang: 'rus' },
        { id: 4, name: 'EAC3', lang: 'eng' },
      ])

      expect(stream.audios.map((a) => a.id)).toEqual([3])
    })

    it('drops multichannel tracks by codec', () => {
      const { stream, hls } = playing('auto')

      hls.updateAudioTracks([
        { id: 0, name: 'Дубляж', audioCodec: 'ac-3' },
        { id: 1, name: 'Дубляж', audioCodec: 'ec-3' },
        { id: 2, name: 'Original', audioCodec: 'dts' },
        { id: 3, name: 'Original', audioCodec: 'mp4a.40.2' },
      ])

      expect(stream.audios.map((a) => a.id)).toEqual([3])
    })

    it('moves off an unplayable default track to the first playable one', () => {
      const { stream, hls } = playing('auto')

      hls.audioTrack = 0
      hls.updateAudioTracks([
        { id: 0, name: 'Дубляж AC3', lang: 'rus' },
        { id: 1, name: 'Дубляж AAC', lang: 'rus' },
        { id: 2, name: 'Original', lang: 'eng' },
      ])

      expect(stream.audioId).toBe(1)
      expect(hls.audioTrack).toBe(1)
    })

    it('reports an audio failure when every track is multichannel', () => {
      const { stream, hls } = playing('auto')

      hls.updateAudioTracks([
        { id: 0, name: 'AC3' },
        { id: 1, audioCodec: 'ec-3' },
      ])

      expect(stream.audios).toEqual([])
      expect(stream.failure).toBe('audio')
    })

    it('names unnamed tracks by their number', () => {
      const { stream, hls } = playing('auto')

      hls.updateAudioTracks([{ id: 0 }, { id: 1, name: '' }])

      expect(stream.audios.map((a) => a.name)).toEqual(['Дорожка 1', 'Дорожка 2'])
      expect(stream.audios[0].lang).toBe('')
    })

    it('setAudio switches the hls track and follows the switched event', () => {
      const { stream, hls } = playing('auto')

      hls.updateAudioTracks([
        { id: 0, name: 'A' },
        { id: 1, name: 'B' },
      ])
      stream.setAudio(1)

      expect(hls.audioTrack).toBe(1)
      expect(stream.audio?.name).toBe('B')

      hls.emit(FakeEvents.AUDIO_TRACK_SWITCHED, { id: 0 })
      expect(stream.audioId).toBe(0)
    })

    it('audio falls back to the first track when none is selected', () => {
      const { stream, hls } = playing('auto')

      hls.updateAudioTracks([
        { id: 5, name: 'A' },
        { id: 6, name: 'B' },
      ])
      hls.emit(FakeEvents.AUDIO_TRACK_SWITCHED, { id: 99 })

      expect(stream.audio?.id).toBe(5)
    })
  })

  describe('subtitle tracks', () => {
    it('lists in-stream subtitles and recognises forced ones by flag or name', () => {
      const { stream, hls } = playing('auto')

      hls.updateSubtitleTracks([
        { id: 0, lang: 'rus', name: 'Russian' },
        { id: 1, lang: 'rus', name: 'Russian (forced)' },
        { id: 2, lang: 'eng', forced: true },
        { id: 3 },
      ])

      expect(stream.subtitles).toEqual([
        { id: 0, lang: 'rus', forced: false },
        { id: 1, lang: 'rus', forced: true },
        { id: 2, lang: 'eng', forced: true },
        { id: 3, lang: '', forced: false },
      ])
    })

    it('turns off the track hls.js auto-enabled when the viewer has not chosen one', () => {
      const { stream, hls } = playing('auto')

      hls.subtitleTrack = 0
      hls.subtitleDisplay = true
      hls.updateSubtitleTracks([{ id: 0, lang: 'rus', default: true }])

      expect(hls.subtitleTrack).toBe(-1)
      expect(hls.subtitleDisplay).toBe(false)
      expect(stream.subtitleId).toBe(-1)
    })

    it('keeps the chosen track across a stream restart', () => {
      const { stream, hls } = playing('auto')

      hls.updateSubtitleTracks([
        { id: 0, lang: 'rus' },
        { id: 1, lang: 'eng' },
      ])
      stream.setSubtitle(1)
      expect(hls.subtitleTrack).toBe(1)
      expect(hls.subtitleDisplay).toBe(true)

      stream.restart(URL1, 10)
      const next = FakeHls.last

      next.updateSubtitleTracks([
        { id: 0, lang: 'rus' },
        { id: 1, lang: 'eng' },
      ])

      expect(next.subtitleTrack).toBe(1)
      expect(next.subtitleDisplay).toBe(true)
      expect(stream.subtitleId).toBe(1)
    })

    it('forgets a choice the new stream does not offer', () => {
      const { stream, hls } = playing('auto')

      hls.updateSubtitleTracks([{ id: 0 }, { id: 1 }, { id: 2 }])
      stream.setSubtitle(2)
      hls.updateSubtitleTracks([{ id: 0 }])

      expect(stream.subtitleId).toBe(-1)
      expect(hls.subtitleTrack).toBe(-1)
    })

    it('follows the switch event', () => {
      const { stream, hls } = playing('auto')

      hls.emit(FakeEvents.SUBTITLE_TRACK_SWITCH, { id: 3 })

      expect(stream.subtitleId).toBe(3)
    })

    it('remembers a subtitle choice made before the stream exists', () => {
      const stream = new HlsStream('auto')

      stream.setSubtitle(1)
      stream.attach(element())
      stream.load(URL1)
      FakeHls.last.updateSubtitleTracks([{ id: 0 }, { id: 1 }])

      expect(FakeHls.last.subtitleTrack).toBe(1)
    })
  })

  describe('errors', () => {
    it('ignores non-fatal errors', () => {
      const { stream, hls } = playing('auto')

      hls.emit(FakeEvents.ERROR, { type: FakeErrorTypes.NETWORK_ERROR, fatal: false })

      expect(stream.failure).toBeNull()
      expect(hls.startLoad).not.toHaveBeenCalled()
    })

    it('retries loading twice on fatal network errors before reporting', () => {
      const { stream, hls } = playing('auto')

      hls.fatal(FakeErrorTypes.NETWORK_ERROR)
      hls.fatal(FakeErrorTypes.NETWORK_ERROR)
      expect(hls.startLoad).toHaveBeenCalledTimes(2)
      expect(stream.failure).toBeNull()

      hls.fatal(FakeErrorTypes.NETWORK_ERROR)
      expect(stream.failure).toBe('network')
      expect(hls.startLoad).toHaveBeenCalledTimes(2)
    })

    it('tries to recover twice from fatal media errors before reporting', () => {
      const { stream, hls } = playing('auto')

      hls.fatal(FakeErrorTypes.MEDIA_ERROR)
      hls.fatal(FakeErrorTypes.MEDIA_ERROR)
      expect(hls.recoverMediaError).toHaveBeenCalledTimes(2)
      expect(stream.failure).toBeNull()

      hls.fatal(FakeErrorTypes.MEDIA_ERROR)
      expect(stream.failure).toBe('media')
    })

    it('reports other fatal errors as media failures right away', () => {
      const { stream, hls } = playing('auto')

      hls.fatal(FakeErrorTypes.OTHER_ERROR)

      expect(stream.failure).toBe('media')
    })

    it('counts network and media retries separately', () => {
      const { stream, hls } = playing('auto')

      hls.fatal(FakeErrorTypes.NETWORK_ERROR)
      hls.fatal(FakeErrorTypes.MEDIA_ERROR)
      hls.fatal(FakeErrorTypes.NETWORK_ERROR)
      hls.fatal(FakeErrorTypes.MEDIA_ERROR)

      expect(stream.failure).toBeNull()
    })

    it('a fresh start gets fresh retry budgets', () => {
      const { stream, hls } = playing('auto')

      hls.fatal(FakeErrorTypes.NETWORK_ERROR)
      hls.fatal(FakeErrorTypes.NETWORK_ERROR)
      stream.restart(URL1, 0)

      const next = FakeHls.last

      next.fatal(FakeErrorTypes.NETWORK_ERROR)
      next.fatal(FakeErrorTypes.NETWORK_ERROR)

      expect(next.startLoad).toHaveBeenCalledTimes(2)
      expect(stream.failure).toBeNull()
    })
  })
})
