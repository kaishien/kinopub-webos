import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StallWatchdog, type StallKind } from './stall-watchdog'

interface FakeElement {
  currentTime: number
  ended: boolean
  ranges: Array<[number, number]>
  buffered: TimeRanges
}

function fakeElement(): FakeElement {
  const el: FakeElement = {
    currentTime: 0,
    ended: false,
    ranges: [],
    buffered: {
      get length() {
        return el.ranges.length
      },
      start: (i: number) => el.ranges[i][0],
      end: (i: number) => el.ranges[i][1],
    },
  }

  return el
}

const STALL_MS = 12000

function setup(options: { active?: boolean; element?: FakeElement | null } = {}) {
  const el = options.element === undefined ? fakeElement() : options.element
  const onStall = vi.fn<(kind: StallKind) => void>()
  let active = options.active ?? true
  const watchdog = new StallWatchdog({
    element: () => el as unknown as HTMLVideoElement | null,
    active: () => active,
    onStall,
  })

  return { el: el as FakeElement, onStall, watchdog, setActive: (value: boolean) => (active = value) }
}

/** The first check records the starting position; the stall timeout counts from there. */
function freezeUntilStall(extra = 0) {
  vi.advanceTimersByTime(1000 + STALL_MS + extra)
}

describe('StallWatchdog', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] })
  })

  it('stays quiet while playback advances', () => {
    const { el, onStall } = setup()

    for (let i = 0; i < 30; i++) {
      el.currentTime += 1
      vi.advanceTimersByTime(1000)
    }

    expect(onStall).not.toHaveBeenCalled()
  })

  it('reports starvation when the position is frozen with nothing buffered', () => {
    const { onStall } = setup()

    vi.advanceTimersByTime(1000 + STALL_MS - 1000)
    expect(onStall).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1000)
    expect(onStall).toHaveBeenCalledTimes(1)
    expect(onStall).toHaveBeenCalledWith('starved')
  })

  it('treats a tiny buffer ahead as starvation too', () => {
    const { el, onStall } = setup()

    el.currentTime = 100
    el.ranges = [[90, 101]]
    freezeUntilStall()

    expect(onStall).toHaveBeenCalledWith('starved')
  })

  it('reports a stuck decoder when plenty is buffered but frames do not advance', () => {
    const { el, onStall } = setup()

    el.currentTime = 100
    el.ranges = [[90, 130]]
    freezeUntilStall()

    expect(onStall).toHaveBeenCalledWith('stuck')
  })

  it('reports stuck when the buffer continues past a gap ahead of the position', () => {
    const { el, onStall } = setup()

    el.currentTime = 100
    el.ranges = [
      [0, 50],
      [102, 140],
    ]
    freezeUntilStall()

    expect(onStall).toHaveBeenCalledWith('stuck')
  })

  it('reports starvation when only data behind the position is buffered', () => {
    const { el, onStall } = setup()

    el.currentTime = 100
    el.ranges = [[0, 99]]
    freezeUntilStall()

    expect(onStall).toHaveBeenCalledWith('starved')
  })

  it('ignores small jitter in currentTime', () => {
    const { el, onStall } = setup()

    el.currentTime = 10
    vi.advanceTimersByTime(1000)
    for (let i = 0; i < 15; i++) {
      el.currentTime = 10 + (i % 2) * 0.01
      vi.advanceTimersByTime(1000)
    }

    expect(onStall).toHaveBeenCalledTimes(1)
  })

  it('does not watch while inactive and starts fresh when activated again', () => {
    const { onStall, setActive } = setup({ active: false })

    freezeUntilStall(10000)
    expect(onStall).not.toHaveBeenCalled()

    setActive(true)
    vi.advanceTimersByTime(STALL_MS - 1000)
    expect(onStall).not.toHaveBeenCalled()

    vi.advanceTimersByTime(2000)
    expect(onStall).toHaveBeenCalledTimes(1)
  })

  it('ignores an ended element', () => {
    const { el, onStall } = setup()

    el.ended = true
    freezeUntilStall(10000)

    expect(onStall).not.toHaveBeenCalled()
  })

  it('ignores a missing element', () => {
    const { onStall } = setup({ element: null })

    freezeUntilStall(10000)

    expect(onStall).not.toHaveBeenCalled()
  })

  it('reports once per stall and waits a full period before the next report', () => {
    const { onStall } = setup()

    freezeUntilStall()
    expect(onStall).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(STALL_MS)
    expect(onStall).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1000)
    expect(onStall).toHaveBeenCalledTimes(2)
  })

  it('reset postpones detection', () => {
    const { onStall, watchdog } = setup()

    vi.advanceTimersByTime(1000 + STALL_MS - 2000)
    watchdog.reset()
    vi.advanceTimersByTime(STALL_MS)
    expect(onStall).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1000)
    expect(onStall).toHaveBeenCalledTimes(1)
  })

  it('dispose stops checking', () => {
    const { onStall, watchdog } = setup()

    watchdog.dispose()
    freezeUntilStall(10000)

    expect(onStall).not.toHaveBeenCalled()
  })
})
