import { beforeEach, describe, expect, it, vi } from 'vitest'
import { COUNTDOWN_S, NextUp, type NextUpOptions } from './next-up'

const DURATION = 600

function setup(overrides: Partial<NextUpOptions> = {}) {
  const options = {
    hasNext: vi.fn(() => true),
    autoplay: vi.fn(() => true),
    chain: 0,
    advance: vi.fn(),
    pause: vi.fn(),
    ...overrides,
  }
  const nextUp = new NextUp(options)

  return { nextUp, options }
}

describe('NextUp', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  describe('credits phase', () => {
    it('stays hidden while the credits are far away', () => {
      const { nextUp } = setup()

      nextUp.onTime(100, DURATION)

      expect(nextUp.phase).toBe('hidden')
      expect(nextUp.visible).toBe(false)
    })

    it('shows the card once playback enters the last 30 seconds', () => {
      const { nextUp } = setup()

      nextUp.onTime(DURATION - 30, DURATION)

      expect(nextUp.phase).toBe('credits')
      expect(nextUp.visible).toBe(true)
    })

    it('does not show for the very last second (the ended event takes over)', () => {
      const { nextUp } = setup()

      nextUp.onTime(DURATION - 1, DURATION)

      expect(nextUp.phase).toBe('hidden')
    })

    it('ignores short videos', () => {
      const { nextUp } = setup()

      nextUp.onTime(280, 299)

      expect(nextUp.phase).toBe('hidden')
    })

    it('ignores the last episode', () => {
      const { nextUp } = setup({ hasNext: () => false })

      nextUp.onTime(DURATION - 20, DURATION)

      expect(nextUp.phase).toBe('hidden')
    })

    it('hides again when the viewer seeks back out of the credits', () => {
      const { nextUp } = setup()

      nextUp.onTime(DURATION - 20, DURATION)
      expect(nextUp.countdown).toBe(COUNTDOWN_S)

      nextUp.onTime(DURATION - 60, DURATION)

      expect(nextUp.phase).toBe('hidden')
      expect(nextUp.countdown).toBeNull()
    })
  })

  describe('countdown', () => {
    it('counts down once a second and then advances automatically', () => {
      const { nextUp, options } = setup()

      nextUp.onTime(DURATION - 20, DURATION)
      expect(nextUp.countdown).toBe(COUNTDOWN_S)

      vi.advanceTimersByTime(1000)
      expect(nextUp.countdown).toBe(COUNTDOWN_S - 1)

      vi.advanceTimersByTime((COUNTDOWN_S - 2) * 1000)
      expect(nextUp.countdown).toBe(1)
      expect(options.advance).not.toHaveBeenCalled()

      vi.advanceTimersByTime(1000)
      expect(options.advance).toHaveBeenCalledWith(true)
      expect(nextUp.countdown).toBeNull()
    })

    it('shows without a countdown when autoplay is off', () => {
      const { nextUp, options } = setup({ autoplay: () => false })

      nextUp.onTime(DURATION - 20, DURATION)
      vi.advanceTimersByTime(COUNTDOWN_S * 2000)

      expect(nextUp.phase).toBe('credits')
      expect(nextUp.countdown).toBeNull()
      expect(options.advance).not.toHaveBeenCalled()
    })

    it('does not restart the countdown on repeated time updates within the credits', () => {
      const { nextUp } = setup()

      nextUp.onTime(DURATION - 20, DURATION)
      vi.advanceTimersByTime(3000)
      nextUp.onTime(DURATION - 17, DURATION)

      expect(nextUp.countdown).toBe(COUNTDOWN_S - 3)
      expect(nextUp.run).toBe(1)
    })

    it('bumps run every time a countdown starts so the fill animation restarts', () => {
      const { nextUp } = setup()

      nextUp.onTime(DURATION - 20, DURATION)
      nextUp.onTime(DURATION - 60, DURATION)
      nextUp.onTime(DURATION - 20, DURATION)

      expect(nextUp.run).toBe(2)
    })

    it('playNow stops the countdown and advances as a manual choice', () => {
      const { nextUp, options } = setup()

      nextUp.onTime(DURATION - 20, DURATION)
      nextUp.playNow()
      vi.advanceTimersByTime(COUNTDOWN_S * 1000)

      expect(options.advance).toHaveBeenCalledTimes(1)
      expect(options.advance).toHaveBeenCalledWith(false)
      expect(nextUp.countdown).toBeNull()
    })
  })

  describe('dismiss', () => {
    it('hides the card and keeps it hidden while still in the credits', () => {
      const { nextUp, options } = setup()

      nextUp.onTime(DURATION - 20, DURATION)
      nextUp.dismiss()

      expect(nextUp.phase).toBe('hidden')
      expect(nextUp.countdown).toBeNull()

      nextUp.onTime(DURATION - 15, DURATION)
      vi.advanceTimersByTime(COUNTDOWN_S * 1000)

      expect(nextUp.phase).toBe('hidden')
      expect(options.advance).not.toHaveBeenCalled()
    })

    it('re-arms after seeking back well before the credits', () => {
      const { nextUp } = setup()

      nextUp.onTime(DURATION - 20, DURATION)
      nextUp.dismiss()
      nextUp.onTime(DURATION - 35, DURATION)
      nextUp.onTime(DURATION - 20, DURATION)
      expect(nextUp.phase).toBe('hidden')

      nextUp.onTime(DURATION - 41, DURATION)
      nextUp.onTime(DURATION - 20, DURATION)

      expect(nextUp.phase).toBe('credits')
    })
  })

  describe('ended phase', () => {
    it('reports nothing to show when there is no next episode', () => {
      const { nextUp } = setup({ hasNext: () => false })

      expect(nextUp.onEnded()).toBe(false)
      expect(nextUp.phase).toBe('hidden')
    })

    it('switches to the ended phase and starts the countdown', () => {
      const { nextUp, options } = setup()

      expect(nextUp.onEnded()).toBe(true)
      expect(nextUp.phase).toBe('ended')
      expect(nextUp.countdown).toBe(COUNTDOWN_S)

      vi.advanceTimersByTime(COUNTDOWN_S * 1000)

      expect(options.advance).toHaveBeenCalledWith(true)
    })

    it('keeps the countdown running when the credits card was already up', () => {
      const { nextUp } = setup()

      nextUp.onTime(DURATION - 20, DURATION)
      vi.advanceTimersByTime(4000)
      nextUp.onEnded()

      expect(nextUp.phase).toBe('ended')
      expect(nextUp.countdown).toBe(COUNTDOWN_S - 4)
    })

    it('shows even after the card was dismissed during the credits', () => {
      const { nextUp } = setup()

      nextUp.onTime(DURATION - 20, DURATION)
      nextUp.dismiss()

      expect(nextUp.onEnded()).toBe(true)
      expect(nextUp.phase).toBe('ended')
    })
  })

  describe('still watching', () => {
    it('asks instead of advancing after three automatic episodes', () => {
      const { nextUp, options } = setup({ chain: 3 })

      nextUp.onEnded()
      vi.advanceTimersByTime(COUNTDOWN_S * 1000)

      expect(nextUp.phase).toBe('still-watching')
      expect(options.pause).toHaveBeenCalledTimes(1)
      expect(options.advance).not.toHaveBeenCalled()
      expect(nextUp.countdown).toBeNull()
    })

    it('keeps the still-watching screen on a later ended event', () => {
      const { nextUp } = setup({ chain: 3 })

      nextUp.onEnded()
      vi.advanceTimersByTime(COUNTDOWN_S * 1000)

      expect(nextUp.onEnded()).toBe(true)
      expect(nextUp.phase).toBe('still-watching')
      expect(nextUp.countdown).toBeNull()
    })

    it('resets the chain when the viewer touches the remote', () => {
      const { nextUp, options } = setup({ chain: 3 })

      nextUp.userActive()
      nextUp.onEnded()
      vi.advanceTimersByTime(COUNTDOWN_S * 1000)

      expect(nextUp.phase).toBe('ended')
      expect(options.advance).toHaveBeenCalledWith(true)
      expect(nextUp.nextChain).toBe(1)
    })

    it('exposes the chain length the next episode should start with', () => {
      expect(setup({ chain: 0 }).nextUp.nextChain).toBe(1)
      expect(setup({ chain: 2 }).nextUp.nextChain).toBe(3)
    })
  })

  it('dispose stops the countdown so nothing advances afterwards', () => {
    const { nextUp, options } = setup()

    nextUp.onEnded()
    nextUp.dispose()
    vi.advanceTimersByTime(COUNTDOWN_S * 1000)

    expect(options.advance).not.toHaveBeenCalled()
    expect(nextUp.countdown).toBeNull()
  })
})
