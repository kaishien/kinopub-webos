import { observer } from 'mobx-react-lite'
import { useViewModel } from '@/shared/view-model/use-view-model'
import { Setting } from '@/features/settings/setting/setting'
import { DeviceSettingsViewModel } from './device-settings.view-model'

const yesNo = (value: boolean) => (value ? 'Да' : 'Нет')

export const DeviceSettings = observer(function DeviceSettings() {
  const vm = useViewModel((services) => new DeviceSettingsViewModel(services))

  if (!vm.settings) return null

  return (
    <>
      <Setting
        name="Сервер раздачи"
        description="Откуда идёт видео. Если подтормаживает — попробуйте другой"
        value={vm.server?.label ?? '—'}
        onPress={() => vm.cycleServer()}
        onCycle={vm.cycleServer}
      />
      <Setting
        name="HEVC (H.265)"
        description="Меньше трафика при том же качестве. Выключите, если видео не воспроизводится"
        value={yesNo(vm.isOn('supportHevc'))}
        onPress={() => vm.toggle('supportHevc')}
      />
      <Setting
        name="HDR"
        description="Расширенный цвет и яркость в фильмах, где он есть"
        value={yesNo(vm.isOn('supportHdr'))}
        onPress={() => vm.toggle('supportHdr')}
      />
      <Setting
        name="4K"
        description="Отдавать 2160p, где оно есть"
        value={yesNo(vm.isOn('support4k'))}
        onPress={() => vm.toggle('support4k')}
      />
    </>
  )
})
