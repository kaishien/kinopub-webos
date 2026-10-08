import { observer } from 'mobx-react-lite'
import { Button } from '@/shared/ui/button/button'
import { FocusGroup } from '@/shared/ui/focus/focus-group'
import { IconChevronDown, IconFilter, IconSort } from '@/shared/ui/icons/icons'
import type { CatalogScreenViewModel } from '@/features/catalog/catalog-screen.view-model'
import { FRESH_TYPES } from '@/features/catalog/sections'
import styles from './catalog-toolbar.module.css'

export const TOOLBAR_FOCUS = { sort: 'CATALOG-sort', genre: 'CATALOG-genre' } as const

export const CatalogToolbar = observer(function CatalogToolbar({ vm }: { vm: CatalogScreenViewModel }) {
  if (vm.section.fresh) {
    return (
      <FocusGroup reveal focusKey="CATALOG-toolbar" className={styles.catalogToolbar}>
        {FRESH_TYPES.map((option) => (
          <Button key={option.id} size="sm" active={option.id === vm.freshType} onPress={() => vm.setFreshType(option.id)}>
            {option.title}
          </Button>
        ))}
      </FocusGroup>
    )
  }
  return (
    <FocusGroup reveal focusKey="CATALOG-toolbar" className={styles.catalogToolbar}>
      <Button
        size="sm"
        focusKey={TOOLBAR_FOCUS.sort}
        icon={<IconSort />}
        trailing={<IconChevronDown />}
        onPress={() => vm.openSheet('sort')}
      >
        <span className={styles.catalogToolbarLabel}>Сортировка</span> {vm.sortTitle}
      </Button>
      {vm.hasGenres && (
        <Button
          size="sm"
          focusKey={TOOLBAR_FOCUS.genre}
          icon={<IconFilter />}
          trailing={<IconChevronDown />}
          active={vm.genre !== undefined}
          onPress={() => vm.openSheet('genre')}
        >
          <span className={styles.catalogToolbarLabel}>Жанр</span> {vm.genreTitle}
        </Button>
      )}
    </FocusGroup>
  )
})
