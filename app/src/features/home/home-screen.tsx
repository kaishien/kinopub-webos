import { observer } from 'mobx-react-lite'
import { ItemsRow } from '@/shared/ui/items-row'
import { Page } from '@/shared/ui/page'
import { useViewModel } from '@/shared/view-model/use-view-model'
import { CONTINUE_SHELF_KEY, HomeScreenViewModel } from './home-screen.view-model'
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
    <Page hero focusKey="PAGE-home" initialFocusKey={vm.firstShelfFocusKey}>
      {vm.visibleShelves.map((shelf) => (
        <ItemsRow
          key={shelf.key}
          focusKey={`ROW-${shelf.key}`}
          title={shelf.title}
          items={shelf.query.data ?? []}
          moreLink={shelf.moreLink}
          ranked={shelf.ranked}
          progressOf={shelf.key === CONTINUE_SHELF_KEY ? continueProgress : undefined}
          subtitleOf={shelf.key === CONTINUE_SHELF_KEY ? continueSubtitle : undefined}
        />
      ))}
    </Page>
  )
})

const continueProgress = (item: { total?: number; watched?: number }) => (item.total ? (item.watched ?? 0) / item.total : undefined)
const continueSubtitle = (item: { new?: number }) => (item.new ? `${item.new} новых` : undefined)
