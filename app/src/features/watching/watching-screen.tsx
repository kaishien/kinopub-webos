import { observer } from 'mobx-react-lite'
import { ItemsRow } from '@/shared/ui/items-row'
import { Page } from '@/shared/ui/page'
import { Status } from '@/shared/ui/status'
import { useViewModel } from '@/shared/view-model/use-view-model'
import { WatchingScreenViewModel } from './watching-screen.view-model'
import { Empty } from '@/shared/ui/empty'

export const WatchingScreen = observer(function WatchingScreen() {
  const vm = useViewModel((services) => new WatchingScreenViewModel(services))
  const serials = vm.serials.data ?? []
  const movies = vm.movies.data ?? []

  return (
    <Page
      hero
      title="Я смотрю"
      focusKey="PAGE-watching"
      initialFocusKey={serials.length ? 'ROW-w-serials' : 'ROW-w-movies'}
      ready={!vm.isLoading}
    >
      <Status loading={vm.isLoading} error={vm.error} onRetry={vm.retry} />
      {vm.isEmpty && <Empty>Здесь появятся сериалы, которые вы начали смотреть, и фильмы, поставленные на паузу.</Empty>}
      {serials.length > 0 && (
        <ItemsRow
          title="Сериалы"
          items={serials}
          focusKey="ROW-w-serials"
          progressOf={WatchingScreenViewModel.progress}
          subtitleOf={WatchingScreenViewModel.subtitle}
        />
      )}
      {movies.length > 0 && <ItemsRow title="Фильмы" items={movies} focusKey="ROW-w-movies" />}
    </Page>
  )
})
