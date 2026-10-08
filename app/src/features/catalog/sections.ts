import { UHD_QUALITY } from '@/services/api/api.types'

export interface CatalogSection {
  id: string
  title: string
  type?: string
  genre?: number
  /** 4K is the `UHD_QUALITY` quality filter, not a separate type. */
  quality?: number
  fresh?: boolean
}

export const CATALOG_SECTIONS: CatalogSection[] = [
  { id: 'fresh', title: 'Новинки', fresh: true },
  { id: 'movie', title: 'Фильмы', type: 'movie' },
  { id: 'serial', title: 'Сериалы', type: 'serial' },
  { id: 'anime', title: 'Аниме', genre: 25 },
  { id: 'concert', title: 'Концерты', type: 'concert' },
  { id: 'documovie', title: 'Докуфильмы', type: 'documovie' },
  { id: 'docuserial', title: 'Докусериалы', type: 'docuserial' },
  { id: 'tvshow', title: 'ТВ-шоу', type: 'tvshow' },
  { id: 'sport', title: 'Спорт', genre: 20 },
  { id: '4k', title: '4K', quality: UHD_QUALITY },
  { id: '3d', title: '3D', type: '3d' },
]

/** `/items/fresh` requires a type; 4K new releases are the «4K» section sorted by «Новые». */
export const FRESH_TYPES: Array<{ id: string; title: string }> = [
  { id: 'movie', title: 'Фильмы' },
  { id: 'serial', title: 'Сериалы' },
  { id: 'tvshow', title: 'ТВ-шоу' },
  { id: 'concert', title: 'Концерты' },
  { id: 'documovie', title: 'Докуфильмы' },
  { id: 'docuserial', title: 'Докусериалы' },
]

export function findSection(id: string): CatalogSection {
  return CATALOG_SECTIONS.find((s) => s.id === id) ?? { id, title: id, type: id }
}
