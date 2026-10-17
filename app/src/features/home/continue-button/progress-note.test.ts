import { describe, expect, it } from 'vitest'
import { progressNote } from './progress-note'

describe('progressNote', () => {
  it('shows the episode and where it stopped, or «с начала» for a fresh start', () => {
    expect(progressNote({ time: 3413, duration: 4120 }, 'S1 E3')).toBe('S1 E3 · 56:53 из 1:08:40')
    expect(progressNote({ time: 0, duration: 2400 }, 'S1 E4')).toBe('S1 E4 · с начала')
    expect(progressNote({ time: 600, duration: 5400 }, '')).toBe('10:00 из 1:30:00')
  })
})
