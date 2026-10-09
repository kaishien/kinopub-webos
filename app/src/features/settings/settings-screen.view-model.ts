import { makeAutoObservable } from 'mobx'
import type { StreamKind } from '@/services/api/api.types'
import type { Services } from '@/services/services'
import type { QualityPreference, ToggleSetting } from '@/services/settings/settings.service'

export interface Option<T extends string> {
  id: T
  title: string
  description?: string
}

export const QUALITY_OPTIONS: Option<QualityPreference>[] = [
  { id: 'auto', title: 'Авто', description: 'Подстраивается под скорость сети' },
  { id: 'max', title: 'Максимальное' },
  { id: '2160p', title: '2160p (4K)' },
  { id: '1080p', title: '1080p' },
  { id: '720p', title: '720p' },
  { id: '480p', title: '480p' },
]

export const STREAM_OPTIONS: Option<StreamKind>[] = [
  { id: 'hls4', title: 'HLS4', description: 'Все дорожки звука и субтитры в одном потоке' },
  { id: 'hls2', title: 'HLS2', description: 'Запасной вариант, если HLS4 не играет' },
  { id: 'hls', title: 'HLS', description: 'Одна дорожка звука' },
  { id: 'http', title: 'MP4', description: 'Прямой файл, без переключения дорожек' },
]

export class SettingsScreenViewModel {
  constructor(private readonly services: Services) {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  get values() {
    return this.services.settings.values
  }

  get user() {
    return this.services.auth.user
  }

  get subscriptionLine(): string {
    const user = this.user

    if (!user) return ''

    const sub = user.subscription

    return sub?.active ? `${user.username} · подписка ещё ${Math.floor(sub.days)} дн.` : `${user.username} · подписка не активна`
  }

  get quality() {
    return QUALITY_OPTIONS.find((o) => o.id === this.values.quality) ?? QUALITY_OPTIONS[0]
  }

  get stream() {
    return STREAM_OPTIONS.find((o) => o.id === this.values.stream) ?? STREAM_OPTIONS[0]
  }

  get hostLabel() {
    return this.values.apiHost ? this.values.apiHost.replace(/^https?:\/\//, '') : 'Автоматически'
  }

  get version() {
    return __APP_VERSION__
  }

  cycleQuality(direction: 1 | -1 = 1) {
    this.services.settings.set('quality', cycle(QUALITY_OPTIONS, this.values.quality, direction).id)
  }

  cycleStream(direction: 1 | -1 = 1) {
    this.services.settings.set('stream', cycle(STREAM_OPTIONS, this.values.stream, direction).id)
  }

  cycleHost() {
    const hosts = ['', ...this.services.settings.hosts]
    const index = hosts.indexOf(this.values.apiHost)

    this.services.settings.set('apiHost', hosts[(index + 1) % hosts.length])
    this.services.ui.showToast('Сервер переключён')
  }

  toggle(key: ToggleSetting) {
    this.services.settings.toggle(key)
  }

  logout() {
    this.services.auth.logout()
  }
}

function cycle<T extends { id: string }>(list: T[], current: string, direction: 1 | -1): T {
  const index = list.findIndex((o) => o.id === current)

  return list[(index + direction + list.length) % list.length]
}
