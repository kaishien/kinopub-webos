import { reaction } from 'mobx'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ItemShort } from '@/services/api/api.types'
import { UiService } from './ui.service'

const item = (id: number) => ({ id, title: `Item ${id}` }) as ItemShort

describe('UiService', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] })
  })

  describe('focusItem', () => {
    it('applies the first focus immediately', () => {
      const ui = new UiService()

      ui.focusItem(item(1), 'note')

      expect(ui.focused).toEqual({ item: item(1), note: 'note' })
    })

    it('applies a focus immediately when the previous one settled long enough ago', () => {
      const ui = new UiService()

      ui.focusItem(item(1))
      vi.advanceTimersByTime(180)
      ui.focusItem(item(2))

      expect(ui.focused?.item.id).toBe(2)
    })

    it('defers rapid focus changes until focus settles', () => {
      const ui = new UiService()

      ui.focusItem(item(1))
      vi.advanceTimersByTime(50)
      ui.focusItem(item(2))

      expect(ui.focused?.item.id).toBe(1)

      vi.advanceTimersByTime(179)
      expect(ui.focused?.item.id).toBe(1)

      vi.advanceTimersByTime(1)
      expect(ui.focused?.item.id).toBe(2)
    })

    it('only the last of a burst of rapid steps is applied', () => {
      const ui = new UiService()

      ui.focusItem(item(1))
      vi.advanceTimersByTime(50)
      ui.focusItem(item(2))
      vi.advanceTimersByTime(50)
      ui.focusItem(item(3))
      vi.advanceTimersByTime(50)
      ui.focusItem(item(4))

      expect(ui.focused?.item.id).toBe(1)

      vi.advanceTimersByTime(180)
      expect(ui.focused?.item.id).toBe(4)
    })
  })

  describe('blurItem', () => {
    it('clears the focused item on the next tick', () => {
      const ui = new UiService()

      ui.focusItem(item(1))
      ui.blurItem()

      expect(ui.focused?.item.id).toBe(1)

      vi.advanceTimersByTime(0)
      expect(ui.focused).toBeNull()
    })

    it('is cancelled by a focus that follows in the same tick', () => {
      const ui = new UiService()

      ui.focusItem(item(1))
      vi.advanceTimersByTime(200)
      ui.blurItem()
      ui.focusItem(item(2))
      vi.advanceTimersByTime(0)

      expect(ui.focused?.item.id).toBe(2)
    })

    it('is cancelled by a rapid focus too, which is then applied after settling', () => {
      const ui = new UiService()

      ui.focusItem(item(1))
      vi.advanceTimersByTime(50)
      ui.blurItem()
      ui.focusItem(item(2))
      vi.advanceTimersByTime(0)

      expect(ui.focused?.item.id).toBe(1)

      vi.advanceTimersByTime(180)
      expect(ui.focused?.item.id).toBe(2)
    })

    it('clearFocusedItem clears immediately and cancels a pending deferred focus', () => {
      const ui = new UiService()

      ui.focusItem(item(1))
      vi.advanceTimersByTime(50)
      ui.focusItem(item(2))
      ui.clearFocusedItem()
      vi.advanceTimersByTime(500)

      expect(ui.focused).toBeNull()
    })
  })

  describe('toast', () => {
    it('shows the text and hides it after the default delay', () => {
      const ui = new UiService()

      ui.showToast('Saved')
      expect(ui.toast).toBe('Saved')

      vi.advanceTimersByTime(2199)
      expect(ui.toast).toBe('Saved')

      vi.advanceTimersByTime(1)
      expect(ui.toast).toBe('')
    })

    it('restarts the timer when a new toast replaces the old one', () => {
      const ui = new UiService()

      ui.showToast('First')
      vi.advanceTimersByTime(2000)
      ui.showToast('Second', 1000)

      vi.advanceTimersByTime(500)
      expect(ui.toast).toBe('Second')

      vi.advanceTimersByTime(500)
      expect(ui.toast).toBe('')
    })
  })

  describe('backdrop and trailer', () => {
    it('does not notify observers when set to the same value', () => {
      const ui = new UiService()
      const backdrops = vi.fn()
      const trailers = vi.fn()

      reaction(() => ui.backdrop, backdrops)
      reaction(() => ui.trailer, trailers)

      ui.setBackdrop('a.jpg')
      ui.setBackdrop('a.jpg')
      ui.setTrailer('t.m3u8')
      ui.setTrailer('t.m3u8')

      expect(backdrops).toHaveBeenCalledTimes(1)
      expect(trailers).toHaveBeenCalledTimes(1)
      expect(ui.backdrop).toBe('a.jpg')
      expect(ui.trailer).toBe('t.m3u8')
    })

    it('clears to an empty string', () => {
      const ui = new UiService()

      ui.setBackdrop('a.jpg')
      ui.setTrailer('t.m3u8')
      ui.clearBackdrop()
      ui.clearTrailer()

      expect(ui.backdrop).toBe('')
      expect(ui.trailer).toBe('')
    })
  })

  it('stores the page focus key', () => {
    const ui = new UiService()

    ui.setPageFocusKey('home')

    expect(ui.pageFocusKey).toBe('home')
  })
})
