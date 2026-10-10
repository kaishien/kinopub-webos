import { observer } from 'mobx-react-lite'
import { plural } from '@/shared/lib/format'
import { Empty } from '@/shared/ui/empty'
import { List, ListItem } from '@/shared/ui/list'
import { Page } from '@/shared/ui/page'
import { PageTitle } from '@/shared/ui/page-title'
import { Status } from '@/shared/ui/status'
import { useViewModel } from '@/shared/view-model/use-view-model'
import { BookmarksScreenViewModel } from './bookmarks-screen.view-model'

export const BookmarksScreen = observer(function BookmarksScreen() {
  const vm = useViewModel((services) => new BookmarksScreenViewModel(services))
  const folders = vm.folders.data ?? []

  return (
    <Page focusKey="PAGE-bookmarks" initialFocusKey="BM-0" ready={!vm.folders.isLoading}>
      <PageTitle>Закладки</PageTitle>
      <Status loading={vm.folders.isLoading} error={vm.folders.error?.message} onRetry={() => vm.folders.refetch()} />
      {vm.folders.isSuccess && folders.length === 0 && (
        <Empty>Папок с закладками пока нет. Их можно создать на сайте Кинопаба, а добавлять в них фильмы прямо отсюда.</Empty>
      )}
      <List focusKey="BM-folders">
        {folders.map((folder, index) => (
          <ListItem
            key={folder.id}
            focusKey={`BM-${index}`}
            onPress={() => vm.open(folder)}
            name={folder.title}
            value={`${folder.count} ${plural(folder.count, 'запись', 'записи', 'записей')}`}
          />
        ))}
      </List>
    </Page>
  )
})
