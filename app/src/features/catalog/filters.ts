export type FilterKind = 'sort' | 'genre' | 'quality' | 'year' | 'country'

export interface FilterOption<T> {
  value: T | undefined
  title: string
}

export const FILTER_TITLES: Record<FilterKind, string> = {
  sort: 'Сортировка',
  genre: 'Жанр',
  quality: 'Качество',
  year: 'Год',
  country: 'Страна',
}

/** Toolbar label while a filter is not narrowed: the button shows only its value, so «Все» alone would be ambiguous. */
export const FILTER_ANY: Record<Exclude<FilterKind, 'sort'>, string> = {
  genre: 'Все жанры',
  quality: 'Любое качество',
  year: 'Любой год',
  country: 'Все страны',
}

export const DEFAULT_SORT = 'updated-'

export const SORT_OPTIONS: FilterOption<string>[] = [
  { value: DEFAULT_SORT, title: 'По обновлению' },
  { value: 'created-', title: 'Новые' },
  { value: 'views-', title: 'Популярные' },
  { value: 'kinopoisk_rating-', title: 'Рейтинг КП' },
  { value: 'imdb_rating-', title: 'Рейтинг IMDb' },
  { value: 'rating-', title: 'Рейтинг Кинопаба' },
  { value: 'year-', title: 'По году' },
]

// Ids from /v1/references/video-quality.
export const QUALITY_OPTIONS: FilterOption<number>[] = [
  { value: undefined, title: 'Любое' },
  { value: 4, title: '4K' },
  { value: 3, title: '1080p' },
  { value: 2, title: '720p' },
]

const SINGLE_YEARS = 12
const FIRST_DECADE = 1950

/** Recent years one by one, older ones by decade. */
export function yearOptions(): FilterOption<string>[] {
  const current = new Date().getFullYear()
  const singles = Array.from({ length: SINGLE_YEARS }, (_, index) => String(current - index))
  const decades: FilterOption<string>[] = []

  for (let start = Math.floor((current - SINGLE_YEARS) / 10) * 10; start >= FIRST_DECADE; start -= 10)
    decades.push({ value: `${start}-${start + 9}`, title: `${start}-е` })

  return [{ value: undefined, title: 'Все' }, ...singles.map((year) => ({ value: year, title: year })), ...decades]
}
