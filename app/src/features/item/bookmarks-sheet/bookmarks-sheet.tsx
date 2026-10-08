import { setFocus } from '@noriginmedia/norigin-spatial-navigation'
import { observer } from 'mobx-react-lite'
import { useEffect } from 'react'
import { Sheet } from '@/shared/ui/sheet/sheet'
import { Spinner } from '@/shared/ui/spinner/spinner'
import { SheetOption } from '@/shared/ui/sheet/sheet-option/sheet-option'
import type { ItemScreenViewModel } from '@/features/item/item-screen.view-model'
import styles from './bookmarks-sheet.module.css'

export const BookmarksSheet = observer(function BookmarksSheet({ vm }: { vm: ItemScreenViewModel }) {
  const folders = vm.folders.data ?? []
  useEffect(() => {
    if (folders.length) setFocus('SHEET-folder-0')
  }, [folders.length])
  return (
    <Sheet title="Закладки" onClose={vm.closeBookmarks}>
      {vm.folders.isLoading && <Spinner />}
      {!vm.folders.isLoading && folders.length === 0 && <p className={styles.hint}>Папок пока нет. Создайте папку на сайте Кинопаба.</p>}
      {folders.map((folder, index) => (
        <SheetOption
          key={folder.id}
          focusKey={`SHEET-folder-${index}`}
          active={vm.isInFolder(folder.id)}
          onPress={() => vm.toggleBookmark.mutate(folder)}
        >
          {folder.title}
        </SheetOption>
      ))}
    </Sheet>
  )
})
