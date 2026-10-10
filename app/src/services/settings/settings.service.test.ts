import { describe, expect, it } from 'vitest'
import { API_HOSTS, type ApiService } from '@/services/api/api.service'
import { StorageService } from '@/services/storage/storage.service'
import { fakeApi } from '@/test/fake-services'
import { SettingsService } from './settings.service'

function create() {
  const storage = new StorageService()
  const api = fakeApi()
  const settings = new SettingsService(storage, api as unknown as ApiService)

  return { storage, api, settings }
}

describe('SettingsService', () => {
  it('starts with defaults and lets the api pick the host automatically', () => {
    const { api, settings } = create()

    expect(settings.values).toEqual({
      quality: 'auto',
      stream: 'hls4',
      subtitlesByDefault: false,
      autoplayNext: true,
      hideContinueRow: false,
      trailerPreview: true,
      apiHost: '',
    })
    expect(api.setPreferredHost).toHaveBeenCalledWith(null)
    expect(settings.hosts).toBe(API_HOSTS)
  })

  it('merges persisted values over the defaults and applies the saved host', () => {
    const storage = new StorageService()

    storage.set('settings', { quality: '1080p', apiHost: API_HOSTS[2] })
    const api = fakeApi()
    const settings = new SettingsService(storage, api as unknown as ApiService)

    expect(settings.values.quality).toBe('1080p')
    expect(settings.values.autoplayNext).toBe(true)
    expect(api.setPreferredHost).toHaveBeenCalledWith(API_HOSTS[2])
  })

  it('persists changes so a new instance sees them', () => {
    const { storage, settings } = create()

    settings.set('stream', 'hls')

    expect(storage.get('settings', {})).toMatchObject({ stream: 'hls' })
    expect(new SettingsService(storage, fakeApi() as unknown as ApiService).values.stream).toBe('hls')
  })

  it('toggles boolean settings', () => {
    const { settings } = create()

    settings.toggle('autoplayNext')
    expect(settings.values.autoplayNext).toBe(false)

    settings.toggle('autoplayNext')
    expect(settings.values.autoplayNext).toBe(true)
  })

  it('forwards apiHost changes to the api and maps the empty host to null', () => {
    const { api, settings } = create()

    api.setPreferredHost.mockClear()
    settings.set('apiHost', API_HOSTS[1])
    expect(api.setPreferredHost).toHaveBeenLastCalledWith(API_HOSTS[1])

    settings.set('apiHost', '')
    expect(api.setPreferredHost).toHaveBeenLastCalledWith(null)

    api.setPreferredHost.mockClear()
    settings.set('quality', 'max')
    expect(api.setPreferredHost).not.toHaveBeenCalled()
  })
})
