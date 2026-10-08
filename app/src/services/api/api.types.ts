export type ItemType = 'movie' | 'serial' | 'tvshow' | '4k' | '3d' | 'concert' | 'documovie' | 'docuserial'

export interface Ref {
  id: number
  title: string
}

export interface Posters {
  small: string
  medium: string
  big: string
  wide?: string
}

export interface ItemShort {
  id: number
  type: ItemType | string
  subtype: string
  title: string
  year: number
  cast?: string
  director?: string
  genres?: Ref[]
  countries?: Ref[]
  duration?: { average: number; total: number }
  quality?: number
  plot?: string
  imdb_rating?: number
  kinopoisk_rating?: number
  rating_percentage?: number
  posters: Posters
  finished?: boolean
  /** Unwatched episode count (only in the watching list) */
  new?: number
  total?: number
  watched?: number
  ac3?: number
  langs?: number
  in_watchlist?: boolean
  bookmarks?: Ref[]
}

export interface AudioTrack {
  id: number
  index: number
  codec: string
  channels: number
  lang: string
  type: { id: number; title: string; short_title: string }
  author: { id: number; title: string; short_title: string }
}

export interface SubtitleTrack {
  lang: string
  shift: number
  embed: boolean
  forced: boolean
  file: string
  url: string
}

export type VideoQuality = '2160p' | '1080p' | '720p' | '480p'

// The API accepts type `4k` but always returns an empty list; 4K is really `quality=4`, combinable with type, genre and sort.
export const UHD_QUALITY = 4
export type StreamKind = 'http' | 'hls' | 'hls4' | 'hls2'

export interface VideoFile {
  codec: string
  w: number
  h: number
  quality: VideoQuality | string
  quality_id: number
  file: string
  url: Record<StreamKind, string>
  expires_at?: number
}

export interface Video {
  id: number
  number: number
  snumber: number
  thumbnail: string
  title: string
  tracks: number
  duration: number
  ac3: number
  audios: AudioTrack[]
  subtitles: SubtitleTrack[]
  files: VideoFile[]
  watched: number
  watching: { status: number; time: number }
}

export interface Season {
  id: number
  number: number
  title: string
  watching: { status: number }
  episodes: Video[]
}

export interface Item extends ItemShort {
  trailer?: { id: number; file: string; url: string }
  videos?: Video[]
  seasons?: Season[]
  views?: number
  comments?: number
}

export interface Pagination {
  total: number
  current: number
  perpage: number
  total_items: number
}

export interface ItemsPage {
  items: ItemShort[]
  pagination?: Pagination
}

export interface HistoryEntry {
  time: number
  counter: number
  first_seen: number
  last_seen: number
  item: ItemShort
  media: { id: number; number: number; snumber: number; title: string; duration: number }
}

export interface HistoryPage {
  history: HistoryEntry[]
  pagination: Pagination
}

export interface BookmarkFolder {
  id: number
  title: string
  views: number
  count: number
  created: number
  updated: number
}

export interface Collection {
  id: number
  title: string
  watchers: number
  views: number
  created: number
  updated: number
  posters: Posters
}

export interface TvChannel {
  id: number
  name: string
  title: string
  logos: { s: string; m: string }
  stream: string
  embed: string
  current: string
  playlist: string
  status: string
}

export interface User {
  username: string
  reg_date: number
  subscription: { active: boolean; end_time: number; days: number }
  profile: { name: string | null; avatar: string }
}

export interface DeviceCode {
  code: string
  user_code: string
  verification_uri: string
  interval: number
  expires_in: number
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
}

export interface Genre {
  id: number
  title: string
  type?: string
}

export type PersonRole = 'cast' | 'director'

export interface DeviceFlag {
  value: number
  label: string
}

export interface DeviceOption {
  id: number
  label: string
  description: string
  selected: number
}

/** `value` holds all options; the chosen one is marked by `selected`. */
export interface DeviceList {
  type: 'list'
  value: DeviceOption[]
  label: string
}

export interface DeviceSettings {
  supportSsl: DeviceFlag
  supportHevc: DeviceFlag
  supportHdr: DeviceFlag
  support4k: DeviceFlag
  mixedPlaylist: DeviceFlag
  serverLocation: DeviceList
  streamingType: DeviceList
}

export type DeviceSettingKey = keyof DeviceSettings

export interface Device {
  id: number
  title: string
  hardware: string
  software: string
  settings: DeviceSettings
}
