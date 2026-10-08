import { makeAutoObservable, runInAction } from 'mobx'
import type { SubtitleTrack } from '@/services/api/api.types'
import type { UiService } from '@/services/ui/ui.service'
import { languageName } from '@/shared/lib/language'

export interface SubtitleKind {
  lang: string
  forced: boolean
}

const PRIORITY = ['rus', 'eng', 'ukr']

/** Kinopub external subtitles are SRT: convert to VTT for <track>. */
export class SubtitleTracks {
  selected = -1
  url = ''
  label = ''
  lang = ''
  private objectUrl = ''

  constructor(private readonly ui: UiService) {
    makeAutoObservable<this, 'objectUrl' | 'ui'>(this, { objectUrl: false, ui: false }, { autoBind: true })
  }

  static label(track: SubtitleKind) {
    return `${languageName(track.lang)}${track.forced ? ' · только надписи' : ''}`
  }

  /** Same across episodes of a series even though the URLs differ. */
  static key(track: SubtitleKind) {
    return `${track.lang}${track.forced ? ':forced' : ''}`
  }

  static order(tracks: SubtitleKind[]): number[] {
    return tracks
      .map((track, index) => ({ track, index }))
      .toSorted((a, b) => rank(a.track) - rank(b.track) || SubtitleTracks.label(a.track).localeCompare(SubtitleTracks.label(b.track), 'ru'))
      .map(({ index }) => index)
  }

  async select(tracks: SubtitleTrack[], index: number) {
    this.selected = index
    this.revoke()
    if (index < 0) {
      this.url = ''
      return
    }
    try {
      const vtt = await toVtt(tracks[index].url)
      runInAction(() => {
        this.objectUrl = vtt
        this.url = vtt
        this.label = SubtitleTracks.label(tracks[index])
        this.lang = tracks[index].lang
      })
    } catch {
      this.ui.showToast('Субтитры не загрузились')
      runInAction(() => {
        this.selected = -1
      })
    }
  }

  private revoke() {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl)
    this.objectUrl = ''
  }

  dispose() {
    this.revoke()
  }
}

function rank(track: SubtitleKind) {
  const priority = PRIORITY.indexOf(track.lang)
  return (priority < 0 ? PRIORITY.length : priority) * 2 + (track.forced ? 1 : 0)
}

async function toVtt(url: string): Promise<string> {
  const text = await (await fetch(url)).text()
  const vtt = text.startsWith('WEBVTT') ? text : `WEBVTT\n\n${text.replace(/\r/g, '').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')}`
  return URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }))
}
