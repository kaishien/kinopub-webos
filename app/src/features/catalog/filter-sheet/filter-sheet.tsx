import { observer } from 'mobx-react-lite'
import type { CatalogScreenViewModel } from '@/features/catalog/catalog-screen.view-model'
import { FILTER_TITLES } from '@/features/catalog/filters'
import { filterButtonKey } from '@/features/catalog/toolbar/catalog-toolbar'
import { Sheet } from '@/shared/ui/sheet/sheet'
import { SheetOption } from '@/shared/ui/sheet/sheet-option/sheet-option'

export const FilterSheet = observer(function FilterSheet({ vm }: { vm: CatalogScreenViewModel }) {
  const kind = vm.sheet

  if (!kind) return null

  const active = vm.activeIndex(kind)

  return (
    <Sheet
      title={FILTER_TITLES[kind]}
      onClose={vm.closeSheet}
      initialFocusKey={`SHEET-${kind}-${active}`}
      returnFocusKey={filterButtonKey(kind)}
    >
      {vm.options(kind).map((option, index) => (
        <SheetOption
          key={String(option.value ?? 'all')}
          focusKey={`SHEET-${kind}-${index}`}
          active={index === active}
          onPress={() => vm.select(kind, option.value)}
        >
          {option.title}
        </SheetOption>
      ))}
    </Sheet>
  )
})
