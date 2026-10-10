import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GlideDetector, KEY_REPEAT_MS } from './motion'

describe('GlideDetector', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['performance', 'Date'] })
  })

  it('does not glide on the first step', () => {
    expect(new GlideDetector().step()).toBe(false)
  })

  it('glides when steps follow each other within the window', () => {
    const detector = new GlideDetector()

    detector.step()
    vi.advanceTimersByTime(KEY_REPEAT_MS)

    expect(detector.step()).toBe(true)
    vi.advanceTimersByTime(259)
    expect(detector.step()).toBe(true)
  })

  it('stops gliding after a pause of the glide window or longer', () => {
    const detector = new GlideDetector()

    detector.step()
    vi.advanceTimersByTime(260)

    expect(detector.step()).toBe(false)
  })

  it('measures from the last step, not from the first', () => {
    const detector = new GlideDetector()

    detector.step()
    vi.advanceTimersByTime(200)
    detector.step()
    vi.advanceTimersByTime(200)

    expect(detector.step()).toBe(true)
  })
})
