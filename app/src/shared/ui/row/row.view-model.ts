import { makeAutoObservable, reaction } from 'mobx'
import type { ImageService } from '@/services/images/image.service'
import { VirtualList } from '@/shared/lib/virtual-list'
import { CARD_GAP, ROW_VIEWPORT } from '@/shared/ui/card/card-metrics'
import { GlideDetector } from '@/shared/ui/motion'

export interface RowParams {
  count: number
  width: number
  initialOffset: number
  saveOffset: (offset: number) => void
  images: ImageService
  imageOf?: (index: number) => string | undefined
}

const IMAGE_AHEAD = 4

export class RowViewModel {
  offset: number
  count: number
  readonly list: VirtualList
  root: HTMLDivElement | null = null
  /** True while an arrow is held: the track then moves linearly, in step with key repeats. */
  gliding = false
  private readonly glide = new GlideDetector()
  private readonly step: number
  private readonly saveOffset: (offset: number) => void
  private readonly stopPrefetch: () => void

  constructor({ count, width, initialOffset, saveOffset, images, imageOf }: RowParams) {
    this.count = count
    this.saveOffset = saveOffset
    this.step = width + CARD_GAP
    this.offset = initialOffset
    makeAutoObservable<this, 'step' | 'saveOffset' | 'stopPrefetch' | 'glide'>(
      this,
      { list: false, root: false, step: false, saveOffset: false, stopPrefetch: false, glide: false },
      { autoBind: true },
    )
    this.list = new VirtualList({
      count: () => this.count,
      step: this.step,
      viewport: ROW_VIEWPORT,
      offset: () => this.offset,
      horizontal: true,
      overscan: 3,
    })
    this.stopPrefetch = reaction(
      () => [this.list.lastIndex, this.count] as const,
      ([last, total]) => {
        if (!imageOf) return
        const urls: string[] = []
        for (let index = last + 1; index < Math.min(total, last + 1 + IMAGE_AHEAD); index++) {
          const url = imageOf(index)
          if (url) urls.push(url)
        }
        images.prefetch(urls)
      },
      { fireImmediately: true },
    )
  }

  get maxOffset() {
    return Math.max(0, this.count * this.step - CARD_GAP - ROW_VIEWPORT)
  }

  get firstVisible() {
    return Math.min(Math.ceil(this.offset / this.step), Math.max(0, this.count - 1))
  }

  setRoot(el: HTMLDivElement | null) {
    this.root = el
  }

  setCount(count: number) {
    this.count = count
  }

  focusItem(index: number) {
    const next = Math.min(index * this.step, this.maxOffset)
    if (next === this.offset) return
    this.gliding = this.glide.step()
    this.offset = next
  }

  dispose() {
    this.stopPrefetch()
    this.saveOffset(this.offset)
    this.list.dispose()
    this.root = null
  }
}
