import { makeAutoObservable, reaction } from 'mobx'
import type { ImageService } from '@/services/images/image.service'
import type { UiService } from '@/services/ui/ui.service'

// Focus must dwell on a card first, so fast scrolling doesn't load frames at all.
const DWELL_MS = 450
// Kinopub frames come in 4K; 1280px wide is enough for a dimmed backdrop.
const BACKDROP_WIDTH = 1280

export class BackdropViewModel {
  layers: [string, string] = ['', '']
  top = 0
  private wanted = ''
  private timer: number | null = null
  private readonly stop: () => void

  constructor(
    ui: UiService,
    private readonly images: ImageService,
  ) {
    makeAutoObservable<this, 'images' | 'wanted' | 'timer' | 'stop'>(
      this,
      { images: false, wanted: false, timer: false, stop: false },
      { autoBind: true },
    )
    this.stop = reaction(
      () => ui.backdrop,
      (url) => this.schedule(url),
      { fireImmediately: true },
    )
  }

  private schedule(url: string) {
    this.wanted = url
    if (this.timer) clearTimeout(this.timer)
    if (!url) return
    this.timer = window.setTimeout(() => void this.load(url), DWELL_MS)
  }

  private async load(url: string) {
    const src = await this.images.resized(url, BACKDROP_WIDTH)
    if (url !== this.wanted) return
    // Decode before showing so the crossfade starts from a ready image without a stutter.
    const image = new Image()
    image.src = src
    await image.decode().catch(() => {})
    if (url === this.wanted) this.show(src)
  }

  private show(src: string) {
    if (this.layers[this.top] === src) return
    const next = 1 - this.top
    this.layers[next] = src
    this.top = next
  }

  dispose() {
    this.stop()
    if (this.timer) clearTimeout(this.timer)
  }
}
