import { makeAutoObservable, reaction } from 'mobx'
import type { Services } from '@/services/services'

/** Lets the page settle first: the trailer is a request plus a decoder, and a quick Back shouldn't start one. */
const DWELL_MS = 1500

/** Plays the screen's trailer muted under the hero text, once, while no card has focus (a focused card owns the hero). */
export class TrailerPreviewViewModel {
  src = ''
  /** Set once the video has frames, so the fade-in starts from a picture rather than black. */
  playing = false
  private timer: number | null = null
  private readonly stop: () => void

  constructor({ ui, settings }: Services) {
    makeAutoObservable<this, 'timer' | 'stop'>(this, { timer: false, stop: false }, { autoBind: true })
    this.stop = reaction(
      () => (settings.values.trailerPreview && !ui.focused ? ui.trailer : ''),
      (url) => this.schedule(url),
      { fireImmediately: true },
    )
  }

  private schedule(url: string) {
    if (this.timer) clearTimeout(this.timer)

    this.clear()
    if (!url) return

    this.timer = window.setTimeout(() => {
      this.src = url
    }, DWELL_MS)
  }

  onPlaying() {
    this.playing = true
  }

  /** Ended or failed: the still frame behind takes over again. */
  clear() {
    this.src = ''
    this.playing = false
  }

  dispose() {
    this.stop()
    if (this.timer) clearTimeout(this.timer)
  }
}
