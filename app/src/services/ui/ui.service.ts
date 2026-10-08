import { makeAutoObservable, observable } from 'mobx'
import type { ItemShort } from '@/services/api/api.types'

const TOAST_MS = 2200
// On rapid steps (held arrow) the info block updates once focus settles: re-rendering large text every step drops frames.
const FOCUS_SETTLE_MS = 180

export interface FocusedItem {
  item: ItemShort
  note?: string
}

export class UiService {
  backdrop = ''
  toast = ''
  pageFocusKey = ''
  focused: FocusedItem | null = null
  private toastTimer: number | null = null
  private focusTimer: number | null = null
  private blurTimer: number | null = null
  private lastFocusAt = -Infinity

  constructor() {
    makeAutoObservable<this, 'toastTimer' | 'focusTimer' | 'blurTimer' | 'lastFocusAt'>(
      this,
      { toastTimer: false, focusTimer: false, blurTimer: false, lastFocusAt: false, focused: observable.ref },
      { autoBind: true },
    )
  }

  setPageFocusKey(key: string) {
    this.pageFocusKey = key
  }

  focusItem(item: ItemShort, note?: string) {
    const now = performance.now()
    const rapid = now - this.lastFocusAt < FOCUS_SETTLE_MS

    this.lastFocusAt = now
    this.cancelTimers()
    const next = { item, note }

    if (!rapid) {
      this.setFocused(next)

      return
    }

    this.focusTimer = window.setTimeout(() => this.setFocused(next), FOCUS_SETTLE_MS)
  }

  // Clear on the next tick: if focus moved to a neighbouring card, its focusItem cancels this and the block doesn't flash.
  blurItem() {
    if (this.blurTimer) clearTimeout(this.blurTimer)

    this.blurTimer = window.setTimeout(this.clearFocusedItem, 0)
  }

  clearFocusedItem() {
    this.cancelTimers()
    this.focused = null
  }

  private cancelTimers() {
    if (this.focusTimer) clearTimeout(this.focusTimer)
    if (this.blurTimer) clearTimeout(this.blurTimer)

    this.focusTimer = null
    this.blurTimer = null
  }

  private setFocused(focused: FocusedItem) {
    this.focused = focused
  }

  setBackdrop(url: string) {
    if (url !== this.backdrop) this.backdrop = url
  }

  clearBackdrop() {
    this.setBackdrop('')
  }

  showToast(text: string, ms = TOAST_MS) {
    this.toast = text
    if (this.toastTimer) clearTimeout(this.toastTimer)

    this.toastTimer = window.setTimeout(() => {
      this.toast = ''
    }, ms)
  }
}
