import { observer } from 'mobx-react-lite'
import { List } from '@/shared/ui/list/list'
import { PageTitle } from '@/shared/ui/page-title/page-title'
import { Page } from '@/shared/ui/page/page'
import { useViewModel } from '@/shared/view-model/use-view-model'
import { DeviceSettings } from './device-settings/device-settings'
import { Setting } from './setting/setting'
import { SettingsScreenViewModel } from './settings-screen.view-model'
import styles from './settings-screen.module.css'

export const SettingsScreen = observer(function SettingsScreen() {
  const vm = useViewModel((services) => new SettingsScreenViewModel(services))
  const v = vm.values
  return (
    <Page focusKey="PAGE-settings" initialFocusKey="SET-quality">
      <PageTitle>Настройки</PageTitle>
      {vm.subscriptionLine && <div className={styles.settingsUser}>{vm.subscriptionLine}</div>}
      <List focusKey="SETTINGS">
        <Setting
          focusKey="SET-quality"
          name="Качество видео"
          description="Лучшее доступное или фиксированное"
          value={vm.quality.title}
          onPress={() => vm.cycleQuality()}
          onCycle={vm.cycleQuality}
        />
        <Setting
          name="Тип потока"
          description={vm.stream.description}
          value={vm.stream.title}
          onPress={() => vm.cycleStream()}
          onCycle={vm.cycleStream}
        />
        <DeviceSettings />
        <Setting
          name="Субтитры по умолчанию"
          description="Включать русские субтитры при запуске"
          value={yesNo(v.subtitlesByDefault)}
          onPress={() => vm.toggle('subtitlesByDefault')}
        />
        <Setting
          name="Автозапуск следующей серии"
          description="На титрах начинается отсчёт, затем включается следующая серия"
          value={yesNo(v.autoplayNext)}
          onPress={() => vm.toggle('autoplayNext')}
        />
        <Setting name="Скрыть ряд «Продолжить» на главной" value={yesNo(v.hideContinueRow)} onPress={() => vm.toggle('hideContinueRow')} />
        <Setting name="Сервер API" description="Автоматически: первый отвечающий из списка" value={vm.hostLabel} onPress={vm.cycleHost} />
        <Setting name="Выйти из аккаунта" description="Понадобится заново ввести код устройства" value="" onPress={vm.logout} />
      </List>
      <div className={styles.settingsVersion}>Кинопаб TV {vm.version}</div>
    </Page>
  )
})

const yesNo = (value: boolean) => (value ? 'Да' : 'Нет')
