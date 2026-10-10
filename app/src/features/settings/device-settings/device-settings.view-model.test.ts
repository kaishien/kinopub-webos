import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/services/api/api.service'
import type { Device, DeviceSettings } from '@/services/api/api.types'
import type { Services } from '@/services/services'
import { fakeServices, flush, type FakeServices } from '@/test/fake-services'
import { DeviceSettingsViewModel } from './device-settings.view-model'

/** FakeServices is not assignable to Services (see src/test/fake-services.ts); view-models only use what the fake provides. */
const svc = (s: FakeServices) => s as unknown as Services

function settings(overrides: Partial<DeviceSettings> = {}): DeviceSettings {
  return {
    supportSsl: { value: 1, label: 'SSL' },
    supportHevc: { value: 0, label: 'HEVC' },
    supportHdr: { value: 0, label: 'HDR' },
    support4k: { value: 1, label: '4K' },
    mixedPlaylist: { value: 0, label: 'Mixed' },
    serverLocation: {
      type: 'list',
      label: 'Сервер',
      value: [
        { id: 1, label: 'Москва', description: '', selected: 1 },
        { id: 2, label: 'Амстердам', description: '', selected: 0 },
        { id: 3, label: 'Франкфурт', description: '', selected: 0 },
      ],
    },
    streamingType: { type: 'list', label: 'Stream', value: [] },
    ...overrides,
  }
}

const device = (s = settings()): Device => ({ id: 42, title: 'TV', hardware: 'webOS', software: '1.0', settings: s })

describe('DeviceSettingsViewModel', () => {
  let services: FakeServices

  beforeEach(() => {
    services = fakeServices()
    services.api.device.mockResolvedValue(device())
  })

  it('loads the device and derives servers and toggles', async () => {
    const vm = new DeviceSettingsViewModel(svc(services))

    expect(vm.settings).toBeUndefined()
    expect(vm.servers).toEqual([])
    expect(vm.isOn('support4k')).toBe(false)
    await vi.waitFor(() => expect(vm.settings).toBeDefined())
    expect(services.api.device).toHaveBeenCalledWith(expect.any(AbortSignal))
    expect(vm.servers.map((s) => s.label)).toEqual(['Москва', 'Амстердам', 'Франкфурт'])
    expect(vm.server?.id).toBe(1)
    expect(vm.isOn('support4k')).toBe(true)
    expect(vm.isOn('supportHevc')).toBe(false)
    vm.dispose()
  })

  it('cycles the server optimistically, saves it and toasts', async () => {
    services.api.saveDeviceSettings.mockImplementation((_id: number, change: Record<string, number>) =>
      Promise.resolve(
        settings({
          serverLocation: { ...settings().serverLocation, value: [] },
          supportHevc: { value: change.supportHevc ?? 0, label: 'HEVC' },
        }),
      ),
    )
    const vm = new DeviceSettingsViewModel(svc(services))

    await vi.waitFor(() => expect(vm.settings).toBeDefined())
    vm.cycleServer()
    expect(vm.server?.id).toBe(2)
    expect(services.ui.toast).toBe('Сервер: Амстердам. Действует со следующего запуска видео')
    await vi.waitFor(() => expect(services.api.saveDeviceSettings).toHaveBeenCalledWith(42, { serverLocation: 2 }))
    vm.dispose()
  })

  it('wraps the server cycle in both directions and ignores a single option', async () => {
    const vm = new DeviceSettingsViewModel(svc(services))

    await vi.waitFor(() => expect(vm.settings).toBeDefined())
    vm.cycleServer(-1)
    expect(vm.server?.id).toBe(3)
    vm.cycleServer()
    expect(vm.server?.id).toBe(1)
    vm.dispose()

    await vi.waitFor(() => expect(services.api.saveDeviceSettings).toHaveBeenCalledTimes(2))
    services = fakeServices()
    services.api.device.mockResolvedValue(
      device(settings({ serverLocation: { type: 'list', label: '', value: [{ id: 9, label: 'X', description: '', selected: 1 }] } })),
    )
    const single = new DeviceSettingsViewModel(svc(services))

    await vi.waitFor(() => expect(single.server?.id).toBe(9))
    services.api.saveDeviceSettings.mockClear()
    single.cycleServer()
    await flush()
    expect(services.api.saveDeviceSettings).not.toHaveBeenCalled()
    single.dispose()
  })

  it('toggles a flag, applies the saved settings and invalidates loaded items', async () => {
    const saved = settings({ supportHevc: { value: 1, label: 'HEVC' } })
    const invalidate = vi.spyOn(services.queryClient, 'invalidateQueries')

    services.api.saveDeviceSettings.mockResolvedValue(saved)
    const vm = new DeviceSettingsViewModel(svc(services))

    await vi.waitFor(() => expect(vm.settings).toBeDefined())
    vm.toggle('supportHevc')
    expect(vm.isOn('supportHevc')).toBe(true)
    await vi.waitFor(() => expect(services.api.saveDeviceSettings).toHaveBeenCalledWith(42, { supportHevc: 1 }))
    await vi.waitFor(() => expect(vm.settings).toBe(saved))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['item'] })
    vm.dispose()
  })

  it('does nothing before the device is loaded', async () => {
    services.api.device.mockReturnValue(new Promise(() => {}))
    const vm = new DeviceSettingsViewModel(svc(services))

    vm.toggle('supportHdr')
    vm.cycleServer()
    await flush()
    expect(services.api.saveDeviceSettings).not.toHaveBeenCalled()
    vm.dispose()
  })

  // Driven through `save.mutate` directly: `toggle` voids the mutate promise, so a failure there is an unhandled rejection
  // (device-settings.view-model.ts:83) that vitest would report.
  it('rolls back by refetching and toasts when saving fails', async () => {
    services.api.saveDeviceSettings.mockRejectedValue(new ApiError(500, 'нет сети'))
    const vm = new DeviceSettingsViewModel(svc(services))

    await vi.waitFor(() => expect(vm.settings).toBeDefined())
    vm.device.setData((current) => current && { ...current, settings: { ...current.settings, supportHdr: { value: 1, label: 'HDR' } } })
    expect(vm.isOn('supportHdr')).toBe(true)

    await vm.save.mutate({ supportHdr: 1 }).catch(() => {})
    expect(services.ui.toast).toBe('Не сохранилось: нет сети')
    await vi.waitFor(() => expect(services.api.device).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(vm.isOn('supportHdr')).toBe(false))
    vm.dispose()
  })
})
