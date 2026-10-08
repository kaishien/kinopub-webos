import { observer } from 'mobx-react-lite'
import { useParams } from 'react-router'
import type { PersonRole } from '@/services/api/api.types'
import { Empty } from '@/shared/ui/empty/empty'
import { Grid } from '@/shared/ui/grid/grid'
import { Page } from '@/shared/ui/page/page'
import { Status } from '@/shared/ui/status/status'
import { useViewModel } from '@/shared/view-model/use-view-model'
import { PersonScreenViewModel } from './person-screen.view-model'

export const PersonScreen = observer(function PersonScreen() {
  const { role = 'cast', name = '' } = useParams()
  const vm = useViewModel((services) => new PersonScreenViewModel(services, role as PersonRole, name))

  return (
    <Page hero title={vm.name} focusKey={`PAGE-person-${role}-${name}`} initialFocusKey="GRID-person-0" ready={!vm.pages.isLoading}>
      <Status loading={vm.pages.isLoading} error={vm.pages.error?.message} onRetry={() => vm.pages.refetch()} />
      {vm.pages.isSuccess && vm.list.length === 0 && <Empty>Ничего не нашлось.</Empty>}
      <Grid items={vm.list} focusKey="GRID-person" loading={vm.pages.isFetchingNextPage} onReachEnd={vm.loadMore} />
    </Page>
  )
})
