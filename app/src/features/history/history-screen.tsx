import { observer } from 'mobx-react-lite'
import { Grid } from '@/shared/ui/grid/grid'
import { Page } from '@/shared/ui/page/page'
import { Status } from '@/shared/ui/status/status'
import { useViewModel } from '@/shared/view-model/use-view-model'
import { HistoryScreenViewModel } from './history-screen.view-model'
import { Empty } from '@/shared/ui/empty/empty'

export const HistoryScreen = observer(function HistoryScreen() {
  const vm = useViewModel((services) => new HistoryScreenViewModel(services))
  return (
    <Page hero title="История" focusKey="PAGE-history" initialFocusKey="GRID-history-0" ready={!vm.pages.isLoading}>
      <Status loading={vm.pages.isLoading} error={vm.pages.error?.message} onRetry={() => vm.pages.refetch()} />
      {vm.pages.isSuccess && vm.items.length === 0 && <Empty>Вы ещё ничего не смотрели.</Empty>}
      <Grid
        items={vm.items}
        focusKey="GRID-history"
        loading={vm.pages.isFetchingNextPage}
        onReachEnd={vm.loadMore}
        subtitleOf={vm.subtitle}
      />
    </Page>
  )
})
