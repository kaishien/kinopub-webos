import { observer } from 'mobx-react-lite'
import { ItemsRow } from '@/shared/ui/items-row'
import { Page } from '@/shared/ui/page'
import { useViewModel } from '@/shared/view-model/use-view-model'
import { ContinueButton } from './continue-button/continue-button'
import { CONTINUE_LOCAL_FOCUS_KEY, CONTINUE_SHELF_KEY, HomeScreenViewModel } from './home-screen.view-model'
import { Spinner } from '@/shared/ui/spinner'
import { Status } from '@/shared/ui/status'

export const HomeScreen = observer(function HomeScreen() {
  const vm = useViewModel((services) => new HomeScreenViewModel(services))

  if (vm.isLoading) {
    return (
      // Own key: otherwise React reuses this screen for home, which then stays without its info block.
      <Page key="loading" focusKey="PAGE-home">
        <Spinner centered={1080} />
      </Page>
    )
  }

  if (vm.error) {
    return (
      <Page key="error" focusKey="PAGE-home" initialFocusKey="HOME-retry">
        <Status title="Каталог не загрузился" error={vm.error} onRetry={vm.retry} retryFocusKey="HOME-retry" />
      </Page>
    )
  }

  return (
    <Page hero focusKey="PAGE-home" initialFocusKey={vm.initialFocusKey}>
      {vm.lastPlayed && <ContinueButton last={vm.lastPlayed} focusKey={CONTINUE_LOCAL_FOCUS_KEY} onPress={vm.continueLastPlayed} />}
      {vm.visibleShelves.map((shelf) => (
        <ItemsRow
          key={shelf.key}
          focusKey={`ROW-${shelf.key}`}
          title={shelf.title}
          items={vm.itemsOf(shelf)}
          moreLink={shelf.moreLink}
          ranked={shelf.ranked}
          progressOf={shelf.key === CONTINUE_SHELF_KEY ? vm.continueProgress : undefined}
          subtitleOf={shelf.key === CONTINUE_SHELF_KEY ? vm.continueSubtitle : undefined}
        />
      ))}
    </Page>
  )
})
