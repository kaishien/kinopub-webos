import { observer } from 'mobx-react-lite'
import { Grid } from '@/shared/ui/grid/grid'
import { Page } from '@/shared/ui/page/page'
import { Status } from '@/shared/ui/status/status'
import { useViewModel } from '@/shared/view-model/use-view-model'
import { NewEpisodesScreenViewModel } from './new-episodes-screen.view-model'
import { Empty } from '@/shared/ui/empty/empty'

export const NewEpisodesScreen = observer(function NewEpisodesScreen() {
  const vm = useViewModel((services) => new NewEpisodesScreenViewModel(services))
  return (
    <Page hero title="Новые эпизоды" focusKey="PAGE-new-episodes" initialFocusKey="GRID-new-0" ready={!vm.serials.isLoading}>
      <Status loading={vm.serials.isLoading} error={vm.error} onRetry={vm.retry} />
      {vm.isEmpty && <Empty>Новых серий в сериалах, на которые вы подписаны, пока нет.</Empty>}
      <Grid items={vm.list} focusKey="GRID-new" subtitleOf={NewEpisodesScreenViewModel.subtitle} />
    </Page>
  )
})
