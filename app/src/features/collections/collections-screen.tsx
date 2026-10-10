import { observer } from 'mobx-react-lite'
import { Grid } from '@/shared/ui/grid'
import { Page } from '@/shared/ui/page'
import { Status } from '@/shared/ui/status'
import { useViewModel } from '@/shared/view-model/use-view-model'
import { CollectionsScreenViewModel } from './collections-screen.view-model'

export const CollectionsScreen = observer(function CollectionsScreen() {
  const vm = useViewModel((services) => new CollectionsScreenViewModel(services))

  return (
    <Page hero title="Подборки" focusKey="PAGE-collections" initialFocusKey="GRID-collections-0" ready={!vm.pages.isLoading}>
      <Status loading={vm.pages.isLoading} error={vm.pages.error?.message} onRetry={() => vm.pages.refetch()} />
      <Grid
        items={vm.cards}
        focusKey="GRID-collections"
        wide
        loading={vm.pages.isFetchingNextPage}
        onReachEnd={vm.loadMore}
        subtitleOf={vm.subtitle}
        onPress={vm.open}
      />
    </Page>
  )
})
