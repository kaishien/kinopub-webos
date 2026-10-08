const CHECK_MS = 1000
const STALL_MS = 12000
const STARVED_BUFFER_S = 2

/** starved: no data (network, quality too high); stuck: data is buffered but frames don't advance (decoder). */
export type StallKind = 'starved' | 'stuck'

export interface StallWatchdogOptions {
  element: () => HTMLVideoElement | null
  active: () => boolean
  onStall: (kind: StallKind) => void
}

/** Playback can hang without any error (browser silently waits for data or can't decode), so watch currentTime instead. */
export class StallWatchdog {
  private lastTime = -1
  private lastProgressAt = performance.now()
  private readonly timer: number

  constructor(private readonly options: StallWatchdogOptions) {
    this.timer = window.setInterval(this.check, CHECK_MS)
  }

  reset() {
    this.lastTime = -1
    this.lastProgressAt = performance.now()
  }

  dispose() {
    clearInterval(this.timer)
  }

  private readonly check = () => {
    const el = this.options.element()
    if (!el || !this.options.active() || el.ended) {
      this.reset()
      return
    }
    if (Math.abs(el.currentTime - this.lastTime) > 0.05) {
      this.lastTime = el.currentTime
      this.lastProgressAt = performance.now()
      return
    }
    if (performance.now() - this.lastProgressAt < STALL_MS) return
    this.reset()
    this.options.onStall(classify(el))
  }
}

/** Data buffered ahead (contiguous or past a gap) but frames stuck means it isn't decodable; unsupported audio tracks looked like this. */
function classify(el: HTMLVideoElement): StallKind {
  const { buffered, currentTime } = el
  for (let i = 0; i < buffered.length; i++) {
    const start = buffered.start(i)
    const end = buffered.end(i)
    if (start <= currentTime + 0.5 && end > currentTime) return end - currentTime < STARVED_BUFFER_S ? 'starved' : 'stuck'
    if (start > currentTime + 0.5) return 'stuck'
  }
  return 'starved'
}
