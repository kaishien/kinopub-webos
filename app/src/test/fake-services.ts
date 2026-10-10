import { vi, type Mock } from 'vitest'
import type { ApiService } from '@/services/api/api.service'
import { AuthService } from '@/services/auth/auth.service'
import { FocusMemoryService } from '@/services/focus-memory/focus-memory.service'
import type { ImageService } from '@/services/images/image.service'
import type { PeoplePhotosService } from '@/services/people-photos/people-photos.service'
import { createQueryClient } from '@/services/query/query-client'
import { RemoteService } from '@/services/remote/remote.service'
import { RouterService } from '@/services/router/router.service'
import type { Services } from '@/services/services'
import { SettingsService } from '@/services/settings/settings.service'
import { StorageService } from '@/services/storage/storage.service'
import { TrackMemoryService } from '@/services/track-memory/track-memory.service'
import { UiService } from '@/services/ui/ui.service'

type Fn = (...args: never[]) => unknown
/** Every ApiService method as a vi.fn; set return values per test with `mockResolvedValue`. */
export type FakeApi = { [K in keyof ApiService]: ApiService[K] extends Fn ? Mock<ApiService[K]> : ApiService[K] }

const API_METHODS = [
  'setToken',
  'setPreferredHost',
  'request',
  'requestDeviceCode',
  'pollDeviceToken',
  'refreshToken',
  'notifyDevice',
  'device',
  'saveDeviceSettings',
  'user',
  'genres',
  'countries',
  'fresh',
  'shelf',
  'item',
  'similar',
  'search',
  'byPerson',
  'watchingSerials',
  'watchingMovies',
  'markTime',
  'toggleWatched',
  'toggleWatchlist',
  'history',
  'bookmarkFolders',
  'bookmarkFolderItems',
  'itemBookmarkFolders',
  'toggleBookmark',
  'collections',
  'collectionItems',
  'tvChannels',
  'items',
] as const

export function fakeApi(): FakeApi {
  const api = { onUnauthorized: null, currentHost: 'https://api.test' } as Record<string, unknown>

  for (const name of API_METHODS) api[name] = vi.fn(() => Promise.resolve(undefined))

  return api as unknown as FakeApi
}

/** Assignable to `Services`; `api` methods are also mocks, so `services.api.item.mockResolvedValue(...)` type-checks. */
export type FakeServices = Services & { api: ApiService & FakeApi }

/**
 * Real storage, settings, auth, ui, focus and track memory on top of a fake API; router is unattached,
 * so `navigate`/`replace` are no-ops you can spy on. Images and photos are stubs.
 */
export function fakeServices(overrides: Partial<Services> = {}): FakeServices {
  const storage = new StorageService()
  const api = fakeApi()
  const real = api as unknown as ApiService
  const settings = new SettingsService(storage, real)
  const images = { resized: vi.fn((url: string) => Promise.resolve(url)), prefetch: vi.fn() } as unknown as ImageService
  const peoplePhotos = { byImdb: vi.fn(() => Promise.resolve([])) } as unknown as PeoplePhotosService

  return {
    storage,
    api,
    queryClient: createQueryClient(),
    settings,
    auth: new AuthService(storage, real),
    router: new RouterService(),
    remote: new RemoteService(),
    ui: new UiService(),
    focusMemory: new FocusMemoryService(),
    images,
    peoplePhotos,
    trackMemory: new TrackMemoryService(storage),
    ...overrides,
  } as unknown as FakeServices
}

/** Resolves once pending promises and MobX reactions have settled; works under fake timers too. */
export const flush = () =>
  vi.isFakeTimers() ? vi.advanceTimersByTimeAsync(0).then(() => {}) : new Promise<void>((resolve) => setTimeout(resolve, 0))
