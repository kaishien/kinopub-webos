import { makeAutoObservable } from 'mobx'

/** Kinopub has no credits markers, so assume credits start this many seconds before the end. */
const CREDITS_S = 30
const MIN_DURATION_S = 300
/** Seeking back this far before the credits zone re-arms a dismissed card. */
const REARM_S = 10

export const COUNTDOWN_S = 10
const STILL_WATCHING_AFTER = 3

export type NextUpPhase = 'hidden' | 'credits' | 'ended' | 'still-watching'

export interface NextUpOptions {
  hasNext: () => boolean
  autoplay: () => boolean
  chain: number
  advance: (auto: boolean) => void
  pause: () => void
}

export class NextUp {
  phase: NextUpPhase = 'hidden'
  countdown: number | null = null
  /** Changing it restarts the button fill animation. */
  run = 0

  private chain: number
  private dismissed = false
  private timer: number | null = null

  constructor(private readonly options: NextUpOptions) {
    this.chain = options.chain
    makeAutoObservable<this, 'options' | 'timer'>(this, { options: false, timer: false }, { autoBind: true })
  }

  get visible() {
    return this.phase !== 'hidden'
  }

  onTime(time: number, duration: number) {
    if (duration < MIN_DURATION_S || !this.options.hasNext()) return

    const remaining = duration - time

    if (this.phase === 'credits' && remaining > CREDITS_S) this.hide()
    if (this.dismissed && remaining > CREDITS_S + REARM_S) this.dismissed = false
    if (this.phase === 'hidden' && !this.dismissed && remaining <= CREDITS_S && remaining > 1) this.show('credits')
  }

  onEnded(): boolean {
    if (!this.options.hasNext()) return false
    if (this.phase !== 'still-watching') this.show('ended')

    return true
  }

  userActive() {
    this.chain = 0
  }

  dismiss() {
    this.dismissed = true
    this.hide()
  }

  playNow() {
    this.stop()
    this.options.advance(false)
  }

  private show(phase: 'credits' | 'ended') {
    this.phase = phase
    if (this.options.autoplay()) this.start()
    else this.stop()
  }

  private hide() {
    this.stop()
    this.phase = 'hidden'
  }

  private start() {
    if (this.countdown !== null) return

    this.countdown = COUNTDOWN_S
    this.run += 1
    this.timer = window.setInterval(this.tick, 1000)
  }

  private stop() {
    if (this.timer) clearInterval(this.timer)

    this.timer = null
    this.countdown = null
  }

  private tick() {
    if (this.countdown === null) return

    this.countdown -= 1
    if (this.countdown > 0) return

    this.stop()
    if (this.chain >= STILL_WATCHING_AFTER) {
      this.phase = 'still-watching'
      this.options.pause()

      return
    }

    this.options.advance(true)
  }

  get nextChain() {
    return this.chain + 1
  }

  dispose() {
    this.stop()
  }
}
