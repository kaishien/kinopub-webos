import type { PersonRole } from '@/services/api/api.types'

export const routes = {
  home: '/',
  search: '/search',
  watching: '/watching',
  newEpisodes: '/new-episodes',
  catalog: '/catalog/:type',
  bookmarks: '/bookmarks',
  bookmarkFolder: '/bookmarks/:id',
  history: '/history',
  collections: '/collections',
  collection: '/collections/:id',
  channels: '/channels',
  channel: '/channels/:id',
  settings: '/settings',
  item: '/item/:id',
  player: '/item/:id/play/:videoId',
  person: '/person/:role/:name',
} as const

export const link = {
  home: () => routes.home,
  search: () => routes.search,
  watching: () => routes.watching,
  newEpisodes: () => routes.newEpisodes,
  catalog: (type: string, params?: { sort?: string; genre?: number }) => {
    const qs = new URLSearchParams()

    if (params?.sort) qs.set('sort', params.sort)
    if (params?.genre) qs.set('genre', String(params.genre))

    const query = qs.toString()

    return `/catalog/${type}${query ? `?${query}` : ''}`
  },
  bookmarks: () => routes.bookmarks,
  bookmarkFolder: (id: number) => `/bookmarks/${id}`,
  history: () => routes.history,
  collections: () => routes.collections,
  collection: (id: number) => `/collections/${id}`,
  channels: () => routes.channels,
  channel: (id: number) => `/channels/${id}`,
  settings: () => routes.settings,
  item: (id: number) => `/item/${id}`,
  person: (role: PersonRole, name: string) => `/person/${role}/${encodeURIComponent(name)}`,
  player: (id: number, videoId: number, params?: { t?: number; q?: string }) => {
    const qs = new URLSearchParams()

    if (params?.t) qs.set('t', String(Math.floor(params.t)))
    if (params?.q) qs.set('q', params.q)

    const query = qs.toString()

    return `/item/${id}/play/${videoId}${query ? `?${query}` : ''}`
  },
}
