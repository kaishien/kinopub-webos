export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return ''
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)
  if (hours === 0) return `${minutes} мин`
  return minutes ? `${hours} ч ${minutes} мин` : `${hours} ч`
}

export function formatClock(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  const h = Math.floor(safe / 3600)
  const m = Math.floor((safe % 3600) / 60)
  const s = Math.floor(safe % 60)
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return many
  if (last > 1 && last < 5) return few
  if (last === 1) return one
  return many
}

export function qualityBadge(quality: number | undefined): string {
  if (!quality) return ''
  if (quality >= 2160) return '4K'
  if (quality >= 1080) return 'FHD'
  if (quality >= 720) return 'HD'
  return 'SD'
}

/** Kinopub returns titles as «Русское название / Original title». */
export function splitTitle(title: string): { ru: string; original: string } {
  const index = title.indexOf(' / ')
  if (index < 0) return { ru: title, original: '' }
  return { ru: title.slice(0, index), original: title.slice(index + 3) }
}

export function episodeLabel(season: number, episode: number): string {
  return season ? `S${season} E${episode}` : `Серия ${episode}`
}

const POSTER_HOST = 'https://m.boramoraboom.ru'

/** Short items lack the wide frame in the API response, but its URL is predictable. */
export function widePosterUrl(id: number, posters?: { medium?: string }): string {
  const host = posters?.medium?.match(/^https?:\/\/[^/]+/)?.[0] ?? POSTER_HOST
  return `${host}/poster/item/wide/${id}.jpg`
}

export function formatRating(value?: number): string {
  return value ? value.toFixed(1) : ''
}
