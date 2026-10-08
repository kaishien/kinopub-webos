import { observer } from 'mobx-react-lite'
import { Sheet } from '@/shared/ui/sheet/sheet'
import { SheetOption } from '@/shared/ui/sheet/sheet-option/sheet-option'
import { SORT_OPTIONS, type CatalogScreenViewModel } from '@/features/catalog/catalog-screen.view-model'
import { TOOLBAR_FOCUS } from '@/features/catalog/toolbar/catalog-toolbar'

export const FilterSheet = observer(function FilterSheet({ vm }: { vm: CatalogScreenViewModel }) {
  if (vm.sheet === 'sort') {
    const active = Math.max(
      0,
      SORT_OPTIONS.findIndex((option) => option.id === vm.sort),
    )

    return (
      <Sheet title="Сортировка" onClose={vm.closeSheet} initialFocusKey={`SHEET-sort-${active}`} returnFocusKey={TOOLBAR_FOCUS.sort}>
        {SORT_OPTIONS.map((option, index) => (
          <SheetOption
            key={option.id}
            focusKey={`SHEET-sort-${index}`}
            active={option.id === vm.sort}
            onPress={() => vm.setSort(option.id)}
          >
            {option.title}
          </SheetOption>
        ))}
      </Sheet>
    )
  }
  if (vm.sheet === 'genre') {
    const genres = vm.genres.data ?? []
    const active = vm.genre === undefined ? 'all' : String(vm.genre)

    return (
      <Sheet title="Жанр" onClose={vm.closeSheet} initialFocusKey={`SHEET-genre-${active}`} returnFocusKey={TOOLBAR_FOCUS.genre}>
        <SheetOption focusKey="SHEET-genre-all" active={vm.genre === undefined} onPress={() => vm.setGenre(undefined)}>
          Все жанры
        </SheetOption>
        {genres.map((genre) => (
          <SheetOption
            key={genre.id}
            focusKey={`SHEET-genre-${genre.id}`}
            active={genre.id === vm.genre}
            onPress={() => vm.setGenre(genre.id)}
          >
            {genre.title}
          </SheetOption>
        ))}
      </Sheet>
    )
  }

  return null
})
