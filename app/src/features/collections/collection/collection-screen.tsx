import { observer } from 'mobx-react-lite'
import { useLocation, useParams } from 'react-router'
import { Grid } from '@/shared/ui/grid/grid'
import { Page } from '@/shared/ui/page/page'
import { Status } from '@/shared/ui/status/status'
import { useViewModel } from '@/shared/view-model/use-view-model'
import { CollectionScreenViewModel } from './collection-screen.view-model'

export const CollectionScreen = observer(function CollectionScreen() {
  const { id = '0' } = useParams()
  const location = useLocation()
  const vm = useViewModel((services) => new CollectionScreenViewModel(services, Number(id)))
  const title = vm.data.data?.collection.title ?? (location.state as { title?: string } | null)?.title ?? 'Подборка'
  return (
    <Page hero title={title} focusKey={`PAGE-collection-${id}`} initialFocusKey="GRID-collection-0" ready={!vm.data.isLoading}>
      <Status loading={vm.data.isLoading} error={vm.data.error?.message} onRetry={() => vm.data.refetch()} />
      <Grid items={vm.data.data?.items ?? []} focusKey="GRID-collection" />
    </Page>
  )
})
