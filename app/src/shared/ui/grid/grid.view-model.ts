import { makeAutoObservable, observable, reaction } from 'mobx'
import type { ImageService } from '@/services/images/image.service'
import type { ItemShort } from '@/services/api/api.types'
import { VirtualList } from '@/shared/lib/virtual-list'
import type { PageViewModel } from '@/shared/ui/page/page.view-model'

/** Request the next page this many rows early so it arrives before focus reaches the end. */
const NEXT_PAGE_ROWS = 4
const IMAGE_AHEAD_ROWS = 4

export interface GridCallbacks {
  onPress: (item: ItemShort) => void
  onFocus: (item: ItemShort, node: HTMLElement | null, note?: string) => void
  onBlur: (item: ItemShort) => void
  onReachEnd?: () => void
}

export class GridViewModel {
  items: ItemShort[]
  root: HTMLDivElement | null = null
  readonly list: VirtualList
  private readonly step: number
  /** Captured once at construction: screens must pass stable view-model methods. */
  private readonly callbacks: GridCallbacks
  private readonly stopPrefetch: () => void

  constructor(
    private readonly page: PageViewModel,
    images: ImageService,
    readonly columns: number,
    rowStep: number,
    items: ItemShort[],
    callbacks: GridCallbacks,
  ) {
    this.items = items
    this.callbacks = callbacks
    makeAutoObservable<this, 'page' | 'callbacks' | 'step' | 'stopPrefetch'>(
      this,
      { items: observable.ref, page: false, list: false, columns: false, callbacks: false, step: false, stopPrefetch: false },
      { autoBind: true },
    )
    this.step = rowStep
    this.list = new VirtualList({
      count: () => this.rows,
      step: this.step,
      viewport: page.viewport,
      offset: () => this.localOffset,
      overscan: 2,
    })
    this.stopPrefetch = reaction(
      () => [this.list.lastIndex, this.items] as const,
      ([lastRow, list]) => {
        const from = (lastRow + 1) * columns
        const ahead = list.slice(from, from + IMAGE_AHEAD_ROWS * columns)

        images.prefetch(ahead.map((item) => item.posters.medium))
      },
    )
  }

  get count() {
    return this.items.length
  }

  get rows() {
    return Math.ceil(this.count / this.columns)
  }

  /** Grid position is re-read from the DOM on every page scroll: filters and headers above it change height as data loads. */
  get localOffset() {
    const offset = this.page.offset

    return this.root ? Math.max(0, offset - this.page.offsetOf(this.root)) : offset
  }

  get firstVisible() {
    const row = Math.ceil(this.localOffset / this.step)

    return Math.min(row * this.columns, Math.max(0, this.count - 1))
  }

  setRoot(el: HTMLDivElement | null) {
    this.root = el
  }

  setItems(items: ItemShort[]) {
    this.items = items
  }

  press(item: ItemShort) {
    this.callbacks.onPress(item)
  }

  focus(item: ItemShort, index: number, node: HTMLElement | null, note?: string) {
    this.callbacks.onFocus(item, node, note)
    const row = Math.floor(index / this.columns)

    if (row >= this.rows - NEXT_PAGE_ROWS) this.callbacks.onReachEnd?.()
  }

  blur(item: ItemShort) {
    this.callbacks.onBlur(item)
  }

  dispose() {
    this.stopPrefetch()
    this.list.dispose()
    this.root = null
  }
}
