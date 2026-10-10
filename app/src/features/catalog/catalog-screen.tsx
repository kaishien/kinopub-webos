import { observer } from 'mobx-react-lite'
import { useLocation, useParams, useSearchParams } from 'react-router'
import { Empty } from '@/shared/ui/empty'
import { Grid } from '@/shared/ui/grid'
import { Page } from '@/shared/ui/page'
import { Status } from '@/shared/ui/status'
import { useViewModel } from '@/shared/view-model/use-view-model'
import { CatalogScreenViewModel } from './catalog-screen.view-model'
import { FilterSheet } from './filter-sheet/filter-sheet'
import { CatalogToolbar } from './toolbar/catalog-toolbar'

/** Sections share one route: keying by type remounts the screen and its view-model when switching. */
export function CatalogScreen() {
  const { type = 'movie' } = useParams()

  return <CatalogContent key={type} type={type} />
}

const CatalogContent = observer(function CatalogContent({ type }: { type: string }) {
  const [params] = useSearchParams()
  const location = useLocation()
  const vm = useViewModel(
    (services) =>
      new CatalogScreenViewModel(
        services,
        type,
        {
          sort: params.get('sort') ?? undefined,
          genre: Number(params.get('genre')) || undefined,
        },
        location.key,
      ),
  )

  return (
    <>
      <Page
        hero
        title={vm.title}
        focusKey={`PAGE-catalog-${type}`}
        initialFocusKey={`GRID-${type}-0`}
        ready={vm.list.length > 0 || vm.items.isError}
      >
        <CatalogToolbar vm={vm} />
        {vm.list.length === 0 && <Status loading={vm.items.isLoading} error={vm.error} onRetry={() => vm.items.refetch()} />}
        {vm.items.isSuccess && vm.list.length === 0 && <Empty>Под эти фильтры ничего не подходит.</Empty>}
        <Grid items={vm.list} focusKey={`GRID-${type}`} loading={vm.items.isFetchingNextPage} onReachEnd={vm.loadMore} />
      </Page>
      <FilterSheet vm={vm} />
    </>
  )
})
