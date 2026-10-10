import { describe, expect, it } from 'vitest'
import { episodeLabel, formatClock, formatDuration, formatRating, plural, qualityBadge, splitTitle, widePosterUrl } from './format'

describe('formatDuration', () => {
  it('returns an empty string for zero, negative and NaN input', () => {
    expect(formatDuration(0)).toBe('')
    expect(formatDuration(-10)).toBe('')
    expect(formatDuration(Number.NaN)).toBe('')
  })

  it('formats minutes only when under an hour', () => {
    expect(formatDuration(45 * 60)).toBe('45 мин')
    expect(formatDuration(90)).toBe('2 мин')
  })

  it('formats hours and minutes, omitting zero minutes', () => {
    expect(formatDuration(2 * 3600 + 5 * 60)).toBe('2 ч 5 мин')
    expect(formatDuration(3600)).toBe('1 ч')
  })
})

describe('formatClock', () => {
  it('formats mm:ss under an hour and h:mm:ss above', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(65)).toBe('01:05')
    expect(formatClock(3600 + 2 * 60 + 3)).toBe('1:02:03')
    expect(formatClock(10 * 3600)).toBe('10:00:00')
  })

  it('treats negative, NaN and infinite values as zero', () => {
    expect(formatClock(-5)).toBe('00:00')
    expect(formatClock(Number.NaN)).toBe('00:00')
    expect(formatClock(Number.POSITIVE_INFINITY)).toBe('00:00')
  })

  it('truncates fractional seconds', () => {
    expect(formatClock(59.9)).toBe('00:59')
  })
})

const f = (n: number) => plural(n, 'серия', 'серии', 'серий')

describe('plural', () => {
  it('picks the Russian plural form', () => {
    expect(f(1)).toBe('серия')
    expect(f(2)).toBe('серии')
    expect(f(4)).toBe('серии')
    expect(f(5)).toBe('серий')
    expect(f(11)).toBe('серий')
    expect(f(14)).toBe('серий')
    expect(f(21)).toBe('серия')
    expect(f(22)).toBe('серии')
    expect(f(100)).toBe('серий')
    expect(f(111)).toBe('серий')
    expect(f(-3)).toBe('серии')
  })
})

describe('qualityBadge', () => {
  it('maps vertical resolution to a badge', () => {
    expect(qualityBadge(undefined)).toBe('')
    expect(qualityBadge(0)).toBe('')
    expect(qualityBadge(480)).toBe('SD')
    expect(qualityBadge(720)).toBe('HD')
    expect(qualityBadge(1080)).toBe('FHD')
    expect(qualityBadge(1440)).toBe('FHD')
    expect(qualityBadge(2160)).toBe('4K')
  })
})

describe('splitTitle', () => {
  it('splits the Russian and the original title', () => {
    expect(splitTitle('Начало / Inception')).toEqual({ ru: 'Начало', original: 'Inception' })
  })

  it('keeps the whole title as Russian when there is no separator', () => {
    expect(splitTitle('Брат')).toEqual({ ru: 'Брат', original: '' })
    expect(splitTitle('A/B')).toEqual({ ru: 'A/B', original: '' })
  })

  it('splits on the first separator only', () => {
    expect(splitTitle('А / B / C')).toEqual({ ru: 'А', original: 'B / C' })
  })
})

describe('episodeLabel', () => {
  it('uses the season when there is one, and a plain episode label otherwise', () => {
    expect(episodeLabel(2, 5)).toBe('S2 E5')
    expect(episodeLabel(0, 5)).toBe('Серия 5')
  })
})

describe('widePosterUrl', () => {
  it('builds the wide frame url on the default poster host', () => {
    expect(widePosterUrl(123)).toBe('https://m.boramoraboom.ru/poster/item/wide/123.jpg')
  })

  it('reuses the host of the medium poster when present', () => {
    expect(widePosterUrl(5, { medium: 'http://img.example.com/poster/item/medium/5.jpg' })).toBe(
      'http://img.example.com/poster/item/wide/5.jpg',
    )
  })

  it('falls back to the default host when the medium poster has no absolute url', () => {
    expect(widePosterUrl(5, { medium: '/poster/item/medium/5.jpg' })).toBe('https://m.boramoraboom.ru/poster/item/wide/5.jpg')
    expect(widePosterUrl(5, {})).toBe('https://m.boramoraboom.ru/poster/item/wide/5.jpg')
  })
})

describe('formatRating', () => {
  it('formats to one decimal and hides zero or missing ratings', () => {
    expect(formatRating(7.456)).toBe('7.5')
    expect(formatRating(8)).toBe('8.0')
    expect(formatRating(0)).toBe('')
    expect(formatRating(undefined)).toBe('')
  })
})
