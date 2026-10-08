import { observer } from 'mobx-react-lite'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { itemFocusKey, rowNavigation } from '@/shared/lib/index-navigation'
import { cx } from '@/shared/lib/cx'
import { useViewModel } from '@/shared/view-model/use-view-model'
import { FocusGroup } from '@/shared/ui/focus/focus-group'
import { usePage } from '@/shared/ui/page/page'
import { RowViewModel } from './row.view-model'
import styles from './row.module.css'

export interface RowProps {
  focusKey: string
  title?: string
  count: number
  item: { width: number; height: number }
  /** `focusKey` lets the row navigate by index without measuring the DOM. */
  renderItem: (index: number, focusKey: string) => ReactNode
  /** Read only once, when the row is created. */
  imageOf?: (index: number) => string | undefined
}

export const Row = observer(function Row({ focusKey, title, count, item, renderItem, imageOf }: RowProps) {
  const { page, locationKey } = usePage()
  const vm = useViewModel(
    ({ focusMemory, images }) =>
      new RowViewModel({
        images,
        imageOf,
        count,
        width: item.width,
        initialOffset: focusMemory.offset(locationKey, focusKey),
        saveOffset: (offset) => focusMemory.saveOffset(locationKey, focusKey, offset),
      }),
  )
  const [navigation] = useState(() => rowNavigation(focusKey))
  useEffect(() => vm.setCount(count), [vm, count])

  return (
    <RowItemFocusContext.Provider value={vm.focusItem}>
      <div className={styles.row} ref={vm.setRoot}>
        {title && <h2 className={styles.rowTitle}>{title}</h2>}
        <FocusGroup
          focusKey={focusKey}
          onChildFocus={() => page.reveal(vm.root)}
          nextFocusResolver={navigation}
          className={styles.rowViewport}
        >
          <div
            className={cx(styles.rowTrack, vm.gliding && styles.isGliding)}
            style={{ width: vm.list.totalSize, height: item.height, transform: `translateX(-${vm.offset}px)` }}
          >
            {vm.list.items.map((cell) => (
              <div key={vm.list.slot(cell.index)} className={styles.rowCell} style={{ left: cell.start }}>
                {renderItem(cell.index, itemFocusKey(focusKey, cell.index))}
              </div>
            ))}
          </div>
        </FocusGroup>
      </div>
    </RowItemFocusContext.Provider>
  )
})

const RowItemFocusContext = createContext<(index: number) => void>(() => {})

export const useRowItemFocus = () => useContext(RowItemFocusContext)
