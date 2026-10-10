import { beforeEach, describe, expect, it, vi } from 'vitest'
import { API_HOSTS } from '@/services/api/api.service'
import type { AuthService } from '@/services/auth/auth.service'
import type { Services } from '@/services/services'
import { fakeServices, type FakeServices } from '@/test/fake-services'
import { QUALITY_OPTIONS, STREAM_OPTIONS, SettingsScreenViewModel } from './settings-screen.view-model'

/** FakeServices is not assignable to Services (see src/test/fake-services.ts); view-models only use what the fake provides. */
const svc = (s: FakeServices) => s as unknown as Services

describe('SettingsScreenViewModel', () => {
  let services: FakeServices
  let vm: SettingsScreenViewModel

  beforeEach(() => {
    services = fakeServices()
    vm = new SettingsScreenViewModel(svc(services))
  })

  it('reflects the current settings and version', () => {
    expect(vm.values).toBe(services.settings.values)
    expect(vm.quality).toBe(QUALITY_OPTIONS[0])
    expect(vm.stream).toBe(STREAM_OPTIONS[0])
    expect(vm.hostLabel).toBe('Автоматически')
    expect(vm.version).toBe('test')
    expect(vm.user).toBeNull()
    expect(vm.subscriptionLine).toBe('')
  })

  it('cycles quality and stream in both directions, wrapping around', () => {
    vm.cycleQuality()
    expect(vm.values.quality).toBe('max')
    vm.cycleQuality(-1)
    expect(vm.values.quality).toBe('auto')
    vm.cycleQuality(-1)
    expect(vm.values.quality).toBe('480p')
    expect(vm.quality.title).toBe('480p')

    vm.cycleStream()
    expect(vm.values.stream).toBe('hls2')
    vm.cycleStream(-1)
    vm.cycleStream(-1)
    expect(vm.values.stream).toBe('http')
    expect(vm.stream.title).toBe('MP4')
    expect(services.storage.get('settings', {})).toMatchObject({ quality: '480p', stream: 'http' })
  })

  it('cycles the host through automatic and every API host, toasting each time', () => {
    const setPreferredHost = services.api.setPreferredHost

    setPreferredHost.mockClear()
    vm.cycleHost()
    expect(vm.values.apiHost).toBe(API_HOSTS[0])
    expect(vm.hostLabel).toBe(API_HOSTS[0].replace(/^https?:\/\//, ''))
    expect(setPreferredHost).toHaveBeenLastCalledWith(API_HOSTS[0])
    expect(services.ui.toast).toBe('Сервер переключён')

    for (let i = 1; i < API_HOSTS.length; i++) vm.cycleHost()
    expect(vm.values.apiHost).toBe(API_HOSTS[API_HOSTS.length - 1])
    vm.cycleHost()
    expect(vm.values.apiHost).toBe('')
    expect(vm.hostLabel).toBe('Автоматически')
    expect(setPreferredHost).toHaveBeenLastCalledWith(null)
  })

  it('toggles boolean settings', () => {
    vm.toggle('hideContinueRow')
    expect(vm.values.hideContinueRow).toBe(true)
    vm.toggle('hideContinueRow')
    expect(vm.values.hideContinueRow).toBe(false)
    vm.toggle('autoplayNext')
    expect(vm.values.autoplayNext).toBe(false)
  })

  it('describes the subscription of the signed-in user', () => {
    services.auth.user = {
      username: 'dmitriy',
      reg_date: 0,
      subscription: { active: true, end_time: 0, days: 12.7 },
      profile: { name: null, avatar: '' },
    }
    expect(vm.subscriptionLine).toBe('dmitriy · подписка ещё 12 дн.')

    services.auth.user = { ...services.auth.user, subscription: { active: false, end_time: 0, days: 0 } }
    expect(vm.subscriptionLine).toBe('dmitriy · подписка не активна')
  })

  it('logs out through the auth service', () => {
    // AuthService.logout is a MobX-bound action (non-configurable), so a stub replaces spying.
    const logout = vi.fn()
    const stubbed = new SettingsScreenViewModel(svc(fakeServices({ auth: { user: null, logout } as unknown as AuthService })))

    stubbed.logout()
    expect(logout).toHaveBeenCalledTimes(1)
  })
})
