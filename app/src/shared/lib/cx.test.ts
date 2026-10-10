import { describe, expect, it } from 'vitest'
import { cx } from './cx'

describe('cx', () => {
  it('joins truthy class names with a space', () => {
    expect(cx('a', 'b', 'c')).toBe('a b c')
  })

  it('drops false, null, undefined and empty strings', () => {
    expect(cx('card', false, null, undefined, '', 'focused')).toBe('card focused')
  })

  it('returns an empty string when nothing is truthy', () => {
    expect(cx(false, undefined)).toBe('')
    expect(cx()).toBe('')
  })
})
