import { makeAutoObservable } from 'mobx'
import { Mutation, Query } from 'mobx-tanstack-query'
import type { Device, DeviceOption, DeviceSettingKey, DeviceSettings } from '@/services/api/api.types'
import type { Services } from '@/services/services'
import { Scope } from '@/shared/view-model/use-view-model'

export type DeviceToggle = 'supportHevc' | 'supportHdr' | 'support4k'
type DeviceChange = Partial<Record<DeviceSettingKey, number>>

export class DeviceSettingsViewModel {
  private readonly scope = new Scope()
  readonly device: Query<Device>
  readonly save: Mutation<DeviceSettings, DeviceChange>

  constructor(private readonly services: Services) {
    const { api, queryClient, ui } = services
    this.device = new Query<Device>({
      queryClient,
      abortSignal: this.scope.signal,
      queryKey: ['device'],
      queryFn: ({ signal }) => api.device(signal),
      staleTime: 0,
    })
    this.save = new Mutation<DeviceSettings, DeviceChange>({
      queryClient,
      abortSignal: this.scope.signal,
      mutationFn: (change) => api.saveDeviceSettings(this.device.data!.id, change),
      onSuccess: (settings) => {
        this.device.setData((device) => device && { ...device, settings })
        // Video links in already loaded items were issued under the old settings.
        void queryClient.invalidateQueries({ queryKey: ['item'] })
      },
      onError: (error) => {
        ui.showToast(`Не сохранилось: ${error.message}`)
        void this.device.refetch()
      },
    })
    makeAutoObservable<this, 'scope' | 'services'>(this, { scope: false, services: false, device: false, save: false }, { autoBind: true })
  }

  get settings(): DeviceSettings | undefined {
    return this.device.data?.settings
  }

  get servers(): DeviceOption[] {
    return this.settings?.serverLocation.value ?? []
  }

  get server(): DeviceOption | undefined {
    return this.servers.find((option) => option.selected === 1)
  }

  isOn(key: DeviceToggle) {
    return this.settings?.[key].value === 1
  }

  cycleServer(direction: 1 | -1 = 1) {
    const servers = this.servers
    if (servers.length < 2) return
    const index = servers.findIndex((option) => option.selected === 1)
    const next = servers[(index + direction + servers.length) % servers.length]
    this.apply({ serverLocation: next.id }, (settings) => ({
      ...settings,
      serverLocation: {
        ...settings.serverLocation,
        value: servers.map(({ id, label, description }) => ({ id, label, description, selected: id === next.id ? 1 : 0 })),
      },
    }))
    this.services.ui.showToast(`Сервер: ${next.label}. Действует со следующего запуска видео`)
  }

  toggle(key: DeviceToggle) {
    const value = this.isOn(key) ? 0 : 1
    this.apply({ [key]: value }, (settings) => ({ ...settings, [key]: { ...settings[key], value } }))
  }

  private apply(change: DeviceChange, optimistic: (settings: DeviceSettings) => DeviceSettings) {
    if (!this.device.data) return
    this.device.setData((device) => device && { ...device, settings: optimistic(device.settings) })
    void this.save.mutate(change)
  }

  dispose() {
    this.scope.dispose()
  }
}
