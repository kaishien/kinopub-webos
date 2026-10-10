import { observer } from 'mobx-react-lite'
import type { CatalogScreenViewModel } from '../catalog-screen.view-model'
import { FILTER_TITLES } from '../filters'
import { filterButtonKey } from '../toolbar/catalog-toolbar'
import { Sheet, SheetOption } from '@/shared/ui/sheet'

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
