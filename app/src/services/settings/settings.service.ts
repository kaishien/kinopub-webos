import { makeAutoObservable } from 'mobx'
import { API_HOSTS, type ApiService } from '@/services/api/api.service'
import type { StreamKind } from '@/services/api/api.types'
import type { StorageService } from '@/services/storage/storage.service'

export type QualityPreference = 'auto' | 'max' | '2160p' | '1080p' | '720p' | '480p'

export interface Settings {
  quality: QualityPreference
  stream: StreamKind
  subtitlesByDefault: boolean
  autoplayNext: boolean
  hideContinueRow: boolean
  /** Play the muted trailer behind the item screen's hero. */
  trailerPreview: boolean
  /** '' means pick the host automatically */
  apiHost: string
}

const DEFAULTS: Settings = {
  quality: 'auto',
  stream: 'hls4',
  subtitlesByDefault: false,
  autoplayNext: true,
  hideContinueRow: false,
  trailerPreview: true,
  apiHost: '',
}

export type ToggleSetting = 'subtitlesByDefault' | 'autoplayNext' | 'hideContinueRow' | 'trailerPreview'

const STORAGE_KEY = 'settings'

export class SettingsService {
  readonly values: Settings

  constructor(
    private readonly storage: StorageService,
    private readonly api: ApiService,
  ) {
    this.values = { ...DEFAULTS, ...storage.get<Partial<Settings>>(STORAGE_KEY, {}) }
    makeAutoObservable(this, {}, { autoBind: true })
    this.api.setPreferredHost(this.values.apiHost || null)
  }

  get hosts(): readonly string[] {
    return API_HOSTS
  }

  set<K extends keyof Settings>(key: K, value: Settings[K]) {
    this.values[key] = value
    this.storage.set(STORAGE_KEY, this.values)
    if (key === 'apiHost') this.api.setPreferredHost(this.values.apiHost || null)
  }

  toggle(key: ToggleSetting) {
    this.set(key, !this.values[key])
  }
}
