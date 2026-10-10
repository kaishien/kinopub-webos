import { observer } from 'mobx-react-lite'
import { Grid } from '@/shared/ui/grid'
import { Page } from '@/shared/ui/page'
import { useViewModel } from '@/shared/view-model/use-view-model'
import { SEARCH_INPUT_FOCUS_KEY, SearchInput } from './search-input/search-input'
import { SearchScreenViewModel } from './search-screen.view-model'
import styles from './search-screen.module.css'
import { Empty } from '@/shared/ui/empty'

const GRID_FOCUS_KEY = 'GRID-search'

export const SearchScreen = observer(function SearchScreen() {
  const vm = useViewModel((services) => new SearchScreenViewModel(services))

  return (
    <Page focusKey="PAGE-search" initialFocusKey={SEARCH_INPUT_FOCUS_KEY}>
      <div className={styles.searchBox}>
        <SearchInput value={vm.query} onChange={vm.setQuery} resultsFocusKey={vm.list.length ? GRID_FOCUS_KEY : undefined} />
      </div>
      {!vm.results.isFetched && !vm.results.isFetching && (
        <div className={styles.searchHint}>Нажмите ОК, чтобы открыть клавиатуру. Результаты появляются по мере ввода.</div>
      )}
      {vm.isEmptyResult && (
        <Empty>По запросу «{vm.normalized}» ничего не нашлось. Попробуйте другое написание или оригинальное название.</Empty>
      )}
      <Grid items={vm.list} focusKey={GRID_FOCUS_KEY} loading={vm.results.isFetching} onReachEnd={vm.loadMore} />
    </Page>
  )
})
