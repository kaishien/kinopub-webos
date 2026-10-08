import { observer } from 'mobx-react-lite'
import { useLocation, useParams } from 'react-router'
import { Grid } from '@/shared/ui/grid/grid'
import { Page } from '@/shared/ui/page/page'
import { Status } from '@/shared/ui/status/status'
import { useViewModel } from '@/shared/view-model/use-view-model'
import { BookmarkFolderScreenViewModel } from './bookmark-folder-screen.view-model'
import { Empty } from '@/shared/ui/empty/empty'

export const BookmarkFolderScreen = observer(function BookmarkFolderScreen() {
  const { id = '0' } = useParams()
  const location = useLocation()
  const vm = useViewModel((services) => new BookmarkFolderScreenViewModel(services, Number(id)))
  const title = vm.title ?? (location.state as { title?: string } | null)?.title ?? 'Закладки'
  return (
    <Page hero title={title} focusKey={`PAGE-bm-${id}`} initialFocusKey="GRID-bm-0" ready={!vm.pages.isLoading}>
      <Status loading={vm.pages.isLoading} error={vm.pages.error?.message} onRetry={() => vm.pages.refetch()} />
      {vm.pages.isSuccess && vm.list.length === 0 && <Empty>Папка пуста.</Empty>}
      <Grid items={vm.list} focusKey="GRID-bm" loading={vm.pages.isFetchingNextPage} onReachEnd={vm.loadMore} />
    </Page>
  )
})
