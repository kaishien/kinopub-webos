import { createContext, useContext } from 'react'
import { ApiService } from './api/api.service'
import { AuthService } from './auth/auth.service'
import { FocusMemoryService } from './focus-memory/focus-memory.service'
import { ImageService } from './images/image.service'
import { PeoplePhotosService } from './people-photos/people-photos.service'
import { createQueryClient, type AppQueryClient } from './query/query-client'
import { RemoteService } from './remote/remote.service'
import { RouterService } from './router/router.service'
import { SettingsService } from './settings/settings.service'
import { StorageService } from './storage/storage.service'
import { TrackMemoryService } from './track-memory/track-memory.service'
import { UiService } from './ui/ui.service'

export interface Services {
  storage: StorageService
  api: ApiService
  queryClient: AppQueryClient
  settings: SettingsService
  auth: AuthService
  router: RouterService
  remote: RemoteService
  ui: UiService
  focusMemory: FocusMemoryService
  images: ImageService
  peoplePhotos: PeoplePhotosService
  trackMemory: TrackMemoryService
}

export function createServices(): Services {
  const storage = new StorageService()
  const api = new ApiService()
  const settings = new SettingsService(storage, api)
  const auth = new AuthService(storage, api)

  return {
    storage,
    api,
    queryClient: createQueryClient(),
    settings,
    auth,
    router: new RouterService(),
    remote: new RemoteService(),
    ui: new UiService(),
    focusMemory: new FocusMemoryService(),
    images: new ImageService(),
    peoplePhotos: new PeoplePhotosService(),
    trackMemory: new TrackMemoryService(storage),
  }
}

export const ServicesContext = createContext<Services | null>(null)

export function useServices(): Services {
  const services = useContext(ServicesContext)

  if (!services) throw new Error('ServicesContext не предоставлен')

  return services
}
