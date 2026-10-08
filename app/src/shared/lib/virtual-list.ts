import { Virtualizer, type VirtualItem } from '@tanstack/virtual-core'
import { computed, makeObservable, observable, reaction, runInAction } from 'mobx'

export interface VirtualListOptions {
  count: () => number
  step: number
  viewport: number
  offset: () => number
  horizontal?: boolean
  overscan?: number
}

/* oxlint-disable no-underscore-dangle -- `_willUpdate` and `_didMount` are lifecycle hooks TanStack adapters normally call */

/** Scrolling is a transform, not native scroll, so offset and viewport size are fed to the virtualizer directly, without DOM observers. */
export class VirtualList {
  private version = 0
  private readonly virtualizer: Virtualizer<HTMLDivElement, HTMLDivElement>
  private readonly disposers: Array<() => void> = []
  private emitOffset: ((offset: number, isScrolling: boolean) => void) | null = null
  private readonly poolSize: number

  constructor(options: VirtualListOptions) {
    const { count, step, viewport, offset, horizontal = false, overscan = 2 } = options
    const rect = horizontal ? { width: viewport, height: 0 } : { width: 0, height: viewport }
    // The virtualizer requires a scroll element; it's never scrolled, so a detached node is enough.
    const host = document.createElement('div')

    this.poolSize = Math.ceil(viewport / step) + 2 * overscan + 2

    this.virtualizer = new Virtualizer<HTMLDivElement, HTMLDivElement>({
      count: count(),
      horizontal,
      overscan,
      estimateSize: () => step,
      getScrollElement: () => host,
      initialRect: rect,
      initialOffset: offset(),
      observeElementRect: (_, notify) => {
        notify(rect)

        return () => {}
      },
      observeElementOffset: (_, notify) => {
        this.emitOffset = notify
        notify(offset(), false)

        return () => {
          this.emitOffset = null
        }
      },
      scrollToFn: () => {},
      onChange: () => this.bump(),
    })

    makeObservable<this, 'version'>(this, { version: observable, items: computed, lastIndex: computed, totalSize: computed })
    this.virtualizer._willUpdate()

    this.disposers.push(
      reaction(offset, (value) => this.emitOffset?.(value, false)),
      reaction(count, (value) => {
        this.virtualizer.setOptions({ ...this.virtualizer.options, count: value })
        this.virtualizer._willUpdate()
        this.bump()
      }),
    )
  }

  get items(): VirtualItem[] {
    void this.version

    return this.virtualizer.getVirtualItems()
  }

  /**
   * The render window is contiguous and no longer than the pool, so `index % poolSize` is a unique key.
   * Cells that scroll off are reused for new items instead of remounted: less DOM churn and garbage.
   */
  slot(index: number): number {
    return index % this.poolSize
  }

  get lastIndex(): number {
    const items = this.items

    return items.length ? items[items.length - 1].index : -1
  }

  get totalSize(): number {
    void this.version

    return this.virtualizer.getTotalSize()
  }

  dispose() {
    this.disposers.splice(0).forEach((dispose) => dispose())
    this.virtualizer._didMount()()
  }

  private bump() {
    runInAction(() => {
      this.version++
    })
  }
}
