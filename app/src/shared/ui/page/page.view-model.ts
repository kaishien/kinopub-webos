import { makeAutoObservable } from 'mobx'
import { GlideDetector } from '@/shared/ui/motion'

const BOTTOM_PADDING = 60

export class PageViewModel {
  offset: number
  /** True while an arrow is held: scrolling then moves linearly, in step with key repeats. */
  gliding = false
  /** Deliberately not observable. */
  initialFocusPlaced = false
  private stack: HTMLElement | null = null
  private readonly glide = new GlideDetector()

  constructor(
    private readonly top: number,
    initialOffset: number,
    readonly viewport: number,
    /** Pin the focused row to the top of the viewport instead of scrolling minimally. */
    private readonly pinned: boolean,
  ) {
    this.offset = initialOffset
    makeAutoObservable<this, 'stack' | 'top' | 'glide' | 'pinned'>(
      this,
      { stack: false, top: false, glide: false, viewport: false, pinned: false, initialFocusPlaced: false },
      { autoBind: true },
    )
  }

  markInitialFocusPlaced() {
    this.initialFocusPlaced = true
  }

  setStack(el: HTMLElement | null) {
    this.stack = el
  }

  offsetOf(el: HTMLElement): number {
    return this.stack ? offsetWithin(el, this.stack) : 0
  }

  reveal(el: HTMLElement | null) {
    if (!el || !this.stack) return
    const elementTop = offsetWithin(el, this.stack)
    const elementBottom = elementTop + el.offsetHeight + BOTTOM_PADDING
    let next = this.offset
    // Pinned: near the top show everything above (titles, filters); deeper, pin the element to the top.
    if (this.pinned) next = elementBottom <= this.viewport ? 0 : Math.max(0, elementTop - this.top)
    else if (elementTop - this.top < this.offset) next = Math.max(0, elementTop - this.top)
    else if (elementBottom > this.offset + this.viewport) next = Math.max(0, elementBottom - this.viewport)
    if (next === this.offset) return
    this.gliding = this.glide.step()
    this.offset = next
  }

  dispose() {
    this.stack = null
  }
}

function offsetWithin(el: HTMLElement, ancestor: HTMLElement): number {
  let offset = 0
  let node: HTMLElement | null = el
  while (node && node !== ancestor) {
    offset += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }
  return offset
}
