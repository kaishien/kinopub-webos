/**
 * Held arrows step at most once per KEY_REPEAT_MS, and scrolling glides linearly over exactly that time,
 * so motion stays continuous. Must match `--glide` in `app/styles/global.css`.
 */
export const KEY_REPEAT_MS = 140

const GLIDE_WINDOW_MS = 260

export class GlideDetector {
  private lastStepAt = -Infinity

  step(): boolean {
    const now = performance.now()
    const gliding = now - this.lastStepAt < GLIDE_WINDOW_MS

    this.lastStepAt = now

    return gliding
  }
}
