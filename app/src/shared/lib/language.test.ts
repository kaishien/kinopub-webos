import { describe, expect, it } from 'vitest'
import { languageName } from './language'

describe('languageName', () => {
  it('maps ISO 639-2 codes to capitalised Russian names', () => {
    expect(languageName('rus')).toBe('Русский')
    expect(languageName('eng')).toBe('Английский')
    expect(languageName('ger')).toBe('Немецкий')
    expect(languageName('deu')).toBe('Немецкий')
    expect(languageName('fre')).toBe('Французский')
  })

  it('is case-insensitive about the code', () => {
    expect(languageName('ENG')).toBe('Английский')
  })

  it('passes two-letter codes straight to Intl', () => {
    expect(languageName('ja')).toBe('Японский')
  })

  it('returns the code itself when no name is known', () => {
    expect(languageName('xxx')).toBe('xxx')
    expect(languageName('zzz')).toBe('zzz')
  })
})
