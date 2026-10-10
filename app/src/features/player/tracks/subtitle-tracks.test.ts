import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SubtitleTrack } from '@/services/api/api.types'
import { UiService } from '@/services/ui/ui.service'
import { SubtitleTracks } from './subtitle-tracks'

function track(lang: string, forced = false, url = `https://cdn.test/${lang}${forced ? '-forced' : ''}.srt`): SubtitleTrack {
  return { lang, forced, url, shift: 0, embed: false, file: url }
}

const SRT = '1\r\n00:00:01,000 --> 00:00:02,500\r\nПривет\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\nМир\r\n'

describe('SubtitleTracks', () => {
  describe('labels and keys', () => {
    it('names the language in Russian', () => {
      expect(SubtitleTracks.label({ lang: 'rus', forced: false })).toBe('Русский')
      expect(SubtitleTracks.label({ lang: 'eng', forced: false })).toBe('Английский')
    })

    it('marks forced tracks as captions only', () => {
      expect(SubtitleTracks.label({ lang: 'rus', forced: true })).toBe('Русский · только надписи')
    })

    it('falls back to the raw code for unknown languages', () => {
      expect(SubtitleTracks.label({ lang: 'xyz', forced: false })).toBe('xyz')
    })

    it('keys by language and forced flag only, so the choice carries across episodes', () => {
      expect(SubtitleTracks.key({ lang: 'rus', forced: false })).toBe('rus')
      expect(SubtitleTracks.key({ lang: 'rus', forced: true })).toBe('rus:forced')
      expect(SubtitleTracks.key(track('eng', false, 'https://a'))).toBe(SubtitleTracks.key(track('eng', false, 'https://b')))
    })
  })

  describe('order', () => {
    it('puts Russian, English and Ukrainian first, then the rest alphabetically', () => {
      const tracks = [
        { lang: 'ger', forced: false },
        { lang: 'ukr', forced: false },
        { lang: 'fre', forced: false },
        { lang: 'eng', forced: false },
        { lang: 'rus', forced: false },
      ]

      expect(SubtitleTracks.order(tracks).map((i) => tracks[i].lang)).toEqual(['rus', 'eng', 'ukr', 'ger', 'fre'])
    })

    it('places the forced track of a language right after the full one', () => {
      const tracks = [
        { lang: 'eng', forced: false },
        { lang: 'rus', forced: true },
        { lang: 'rus', forced: false },
      ]

      expect(SubtitleTracks.order(tracks).map((i) => `${tracks[i].lang}${tracks[i].forced ? '!' : ''}`)).toEqual(['rus', 'rus!', 'eng'])
    })

    it('returns original indices', () => {
      const tracks = [
        { lang: 'eng', forced: false },
        { lang: 'rus', forced: false },
      ]

      expect(SubtitleTracks.order(tracks)).toEqual([1, 0])
    })

    it('handles an empty list', () => {
      expect(SubtitleTracks.order([])).toEqual([])
    })
  })

  describe('select', () => {
    let ui: UiService
    let subtitles: SubtitleTracks
    let blobs: Blob[]
    let revoked: string[]

    beforeEach(() => {
      ui = new UiService()
      subtitles = new SubtitleTracks(ui)
      blobs = []
      revoked = []
      let counter = 0

      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.resolve(new Response(SRT))),
      )
      URL.createObjectURL = vi.fn((blob: Blob) => {
        blobs.push(blob)
        counter += 1

        return `blob:${counter}`
      })
      URL.revokeObjectURL = vi.fn((url: string) => {
        revoked.push(url)
      })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('converts the SRT file to VTT and exposes it for the track element', async () => {
      const tracks = [track('rus'), track('eng')]

      await subtitles.select(tracks, 1)

      expect(subtitles.selected).toBe(1)
      expect(subtitles.url).toBe('blob:1')
      expect(subtitles.lang).toBe('eng')
      expect(subtitles.label).toBe('Английский')
      expect(fetch).toHaveBeenCalledWith(tracks[1].url)

      const vtt = await blobs[0].text()

      expect(vtt.startsWith('WEBVTT\n\n')).toBe(true)
      expect(vtt).toContain('00:00:01.000 --> 00:00:02.500')
      expect(vtt).not.toContain('\r')
      expect(blobs[0].type).toBe('text/vtt')
    })

    it('keeps a file that is already VTT untouched', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.resolve(new Response('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi\n'))),
      )

      await subtitles.select([track('eng')], 0)

      expect(await blobs[0].text()).toBe('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi\n')
    })

    it('turns subtitles off and releases the previous object URL', async () => {
      await subtitles.select([track('rus')], 0)
      await subtitles.select([track('rus')], -1)

      expect(subtitles.selected).toBe(-1)
      expect(subtitles.url).toBe('')
      expect(revoked).toEqual(['blob:1'])
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('releases the previous object URL when switching tracks', async () => {
      const tracks = [track('rus'), track('eng')]

      await subtitles.select(tracks, 0)
      await subtitles.select(tracks, 1)

      expect(revoked).toEqual(['blob:1'])
      expect(subtitles.url).toBe('blob:2')
    })

    it('shows a toast and deselects when the file cannot be loaded', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.reject(new Error('offline'))),
      )

      await subtitles.select([track('rus')], 0)

      expect(ui.toast).toBe('Субтитры не загрузились')
      expect(subtitles.selected).toBe(-1)
      expect(subtitles.url).toBe('')
    })

    it('dispose releases the object URL', async () => {
      await subtitles.select([track('rus')], 0)
      subtitles.dispose()

      expect(revoked).toEqual(['blob:1'])
    })
  })
})
