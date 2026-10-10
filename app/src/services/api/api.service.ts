import type {
  Country,
  Device,
  DeviceSettingKey,
  DeviceSettings,
  PersonRole,
  BookmarkFolder,
  Collection,
  DeviceCode,
  Genre,
  HistoryPage,
  Item,
  ItemShort,
  ItemsPage,
  Pagination,
  TokenResponse,
  TvChannel,
  User,
} from './api.types'

export const CLIENT_ID = 'xbmc'
export const CLIENT_SECRET = 'cgg3gtifu46urtfp2zp1nqtba0k2ezxh'

export const API_HOSTS = [
  'https://api.boramoraboom.ru',
  'https://api.teleos.club',
  'https://api.srvkp.net',
  'https://api.srvkp.com',
  'https://api.service-kp.com',
] as const

const REQUEST_TIMEOUT_MS = 8000
const PER_PAGE = 36

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }

  get isAuth() {
    return this.status === 401
  }

  get isNetwork() {
    return this.status === 0
  }
}

type Query = Record<string, string | number | boolean | undefined | null>

interface RequestOptions {
  method?: 'GET' | 'POST'
  signal?: AbortSignal
  auth?: boolean
  /** Some endpoints only accept these as form fields in the body, not in the query string. */
  form?: Record<string, string | number>
}

interface ErrorBody {
  error?: string
  error_description?: string
  message?: string
}

export class ApiService {
  private hosts: string[] = [...API_HOSTS]
  private hostIndex = 0
  private accessToken: string | null = null

  onUnauthorized: (() => Promise<boolean>) | null = null

  setToken(token: string | null) {
    this.accessToken = token
  }

  setPreferredHost(host: string | null) {
    this.hosts = host ? [host, ...API_HOSTS.filter((h) => h !== host)] : [...API_HOSTS]
    this.hostIndex = 0
  }

  get currentHost() {
    return this.hosts[this.hostIndex]
  }

  async request<T>(path: string, params: Query = {}, options: RequestOptions = {}, retryAuth = true): Promise<T> {
    const { method = 'GET', signal, auth = true, form } = options
    const query = { ...params, ...(auth && this.accessToken ? { access_token: this.accessToken } : {}) }
    const start = this.hostIndex
    let lastError: unknown = null

    // An `abort` listener on an already-aborted signal never fires, so check up front or the request goes out anyway.
    if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new DOMException('Aborted', 'AbortError')

    for (let attempt = 0; attempt < this.hosts.length; attempt++) {
      const index = (start + attempt) % this.hosts.length
      const url = `${this.hosts[index]}${path}${toQueryString(query)}`
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      const onOuterAbort = () => controller.abort()

      signal?.addEventListener('abort', onOuterAbort, { once: true })

      try {
        const payload = form ? new URLSearchParams(Object.entries(form).map(([key, value]) => [key, String(value)])) : undefined
        const response = await fetch(url, { method, signal: controller.signal, body: payload })

        this.hostIndex = index
        const text = await response.text()
        const body = parseJson(text)

        if (response.status === 401 && auth && retryAuth && this.onUnauthorized) {
          if (await this.onUnauthorized()) return this.request<T>(path, params, options, false)
        }
        if (!response.ok) {
          const err = body as ErrorBody | null

          throw new ApiError(response.status, err?.error_description || err?.message || err?.error || `HTTP ${response.status}`, body)
        }

        return body as T
      } catch (error) {
        if (error instanceof ApiError) throw error
        if (signal?.aborted) throw error

        lastError = error
      } finally {
        clearTimeout(timer)
        signal?.removeEventListener('abort', onOuterAbort)
      }
    }

    throw new ApiError(0, 'Сервер не отвечает', lastError)
  }

  private get<T>(path: string, params: Query = {}, signal?: AbortSignal) {
    return this.request<T>(path, params, { signal })
  }

  private post<T>(path: string, params: Query = {}, signal?: AbortSignal) {
    return this.request<T>(path, params, { method: 'POST', signal })
  }

  requestDeviceCode(signal?: AbortSignal) {
    return this.request<DeviceCode>(
      '/oauth2/device',
      { grant_type: 'device_code', client_id: CLIENT_ID, client_secret: CLIENT_SECRET },
      { method: 'POST', signal, auth: false },
    )
  }

  pollDeviceToken(code: string, signal?: AbortSignal) {
    return this.request<TokenResponse>(
      '/oauth2/device',
      { grant_type: 'device_token', client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code },
      { method: 'POST', signal, auth: false },
    )
  }

  refreshToken(refreshToken: string) {
    return this.request<TokenResponse>(
      '/oauth2/token',
      { grant_type: 'refresh_token', client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refreshToken },
      { method: 'POST', auth: false },
      false,
    )
  }

  notifyDevice(title: string, hardware: string, software: string) {
    return this.post('/v1/device/notify', { title, hardware, software })
  }

  device(signal?: AbortSignal) {
    return this.get<{ device: Device }>('/v1/device/info', {}, signal).then((r) => r.device)
  }

  saveDeviceSettings(id: number, values: Partial<Record<DeviceSettingKey, number>>) {
    return this.request<{ settings: DeviceSettings }>(`/v1/device/${id}/settings`, {}, { method: 'POST', form: values }).then(
      (r) => r.settings,
    )
  }

  user(signal?: AbortSignal) {
    return this.get<{ user: User }>('/v1/user', {}, signal).then((r) => r.user)
  }

  genres(type: string | undefined, signal?: AbortSignal) {
    return this.get<{ items: Genre[] }>('/v1/genres', { type }, signal).then((r) => r.items)
  }

  /** `year` is a single year («2024») or an inclusive range («2010-2019»). */
  items(
    params: { type?: string; sort?: string; genre?: number; quality?: number; year?: string; country?: number; page?: number },
    signal?: AbortSignal,
  ) {
    return this.get<ItemsPage>('/v1/items', { perpage: PER_PAGE, ...params }, signal)
  }

  countries(signal?: AbortSignal) {
    return this.get<{ items: Country[] }>('/v1/countries', {}, signal).then((r) => r.items)
  }

  /** Kinopub requires `type` here. */
  fresh(type: string, page: number, signal?: AbortSignal) {
    return this.get<ItemsPage>('/v1/items/fresh', { type, page, perpage: PER_PAGE }, signal)
  }

  shelf(kind: 'fresh' | 'hot' | 'popular', type: string, signal?: AbortSignal) {
    return this.get<ItemsPage>(`/v1/items/${kind}`, { type, perpage: 24 }, signal).then((r) => r.items)
  }

  item(id: number, signal?: AbortSignal) {
    return this.get<{ item: Item }>(`/v1/items/${id}`, { nolinks: 0 }, signal).then((r) => r.item)
  }

  similar(id: number, signal?: AbortSignal) {
    return this.get<ItemsPage>('/v1/items/similar', { id }, signal).then((r) => r.items)
  }

  search(q: string, page: number, signal?: AbortSignal) {
    return this.get<ItemsPage>('/v1/items/search', { q, field: 'title', page, perpage: PER_PAGE, sectioned: 0 }, signal)
  }

  byPerson(role: PersonRole, name: string, page: number, signal?: AbortSignal) {
    return this.get<ItemsPage>('/v1/items/search', { q: name, field: role, page, perpage: PER_PAGE, sectioned: 0 }, signal)
  }

  watchingSerials(subscribed: 0 | 1, signal?: AbortSignal) {
    return this.get<{ items: ItemShort[] }>('/v1/watching/serials', { subscribed }, signal).then((r) => r.items)
  }

  watchingMovies(signal?: AbortSignal) {
    return this.get<{ items: ItemShort[] }>('/v1/watching/movies', {}, signal).then((r) => r.items)
  }

  markTime(id: number, time: number, video?: number, season?: number) {
    return this.get('/v1/watching/marktime', { id, time: Math.floor(time), video, season })
  }

  toggleWatched(id: number, video?: number, season?: number) {
    return this.get('/v1/watching/toggle', { id, video, season })
  }

  toggleWatchlist(id: number) {
    return this.get<{ watching: boolean }>('/v1/watching/togglewatchlist', { id })
  }

  history(page: number, signal?: AbortSignal) {
    return this.get<HistoryPage>('/v1/history', { page, perpage: PER_PAGE }, signal)
  }

  bookmarkFolders(signal?: AbortSignal) {
    return this.get<{ items: BookmarkFolder[] }>('/v1/bookmarks', {}, signal).then((r) => r.items)
  }

  bookmarkFolderItems(id: number, page: number, signal?: AbortSignal) {
    return this.get<{ folder: BookmarkFolder; items: ItemShort[]; pagination: Pagination }>(
      `/v1/bookmarks/${id}`,
      { page, perpage: PER_PAGE },
      signal,
    )
  }

  itemBookmarkFolders(item: number, signal?: AbortSignal) {
    return this.get<{ folders: BookmarkFolder[] }>('/v1/bookmarks/get-item-folders', { item }, signal).then((r) => r.folders)
  }

  toggleBookmark(item: number, folder: number) {
    return this.post<{ status: number }>('/v1/bookmarks/toggle-item', { item, folder })
  }

  collections(page: number, signal?: AbortSignal) {
    return this.get<{ items: Collection[]; pagination: Pagination }>(
      '/v1/collections',
      { page, perpage: PER_PAGE, sort: 'created-' },
      signal,
    )
  }

  collectionItems(id: number, signal?: AbortSignal) {
    return this.get<{ items: ItemShort[]; collection: Collection }>('/v1/collections/view', { id }, signal)
  }

  tvChannels(signal?: AbortSignal) {
    return this.get<{ channels: TvChannel[] }>('/v1/tv/index', {}, signal).then((r) => r.channels)
  }
}

function toQueryString(params: Query): string {
  const parts: string[] = []

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue

    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  }

  return parts.length ? `?${parts.join('&')}` : ''
}

function parseJson(text: string): unknown {
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
