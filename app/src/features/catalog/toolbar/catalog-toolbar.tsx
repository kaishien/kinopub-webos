import { observer } from 'mobx-react-lite'
import type { CatalogScreenViewModel } from '@/features/catalog/catalog-screen.view-model'
import type { FilterKind } from '@/features/catalog/filters'
import { FRESH_TYPES } from '@/features/catalog/sections'
import { Button } from '@/shared/ui/button/button'
import { FocusGroup } from '@/shared/ui/focus/focus-group'
import { IconChevronDown, IconFilter, IconSort } from '@/shared/ui/icons/icons'
import styles from './catalog-toolbar.module.css'

export const filterButtonKey = (kind: FilterKind) => `CATALOG-${kind}`

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
      {vm.kinds.map((kind) => (
        <Button
          key={kind}
          size="sm"
          focusKey={filterButtonKey(kind)}
          icon={kind === 'sort' ? <IconSort /> : <IconFilter />}
          trailing={<IconChevronDown />}
          active={vm.isNarrowed(kind)}
          onPress={() => vm.openSheet(kind)}
        >
          {vm.titleOf(kind)}
        </Button>
      ))}
    </FocusGroup>
  )
})
