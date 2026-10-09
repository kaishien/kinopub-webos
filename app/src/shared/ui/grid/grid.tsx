import { observer } from 'mobx-react-lite'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { ItemShort } from '@/services/api/api.types'
import { link } from '@/app/routes'
import { widePosterUrl } from '@/shared/lib/format'
import { gridNavigation, itemFocusKey } from '@/shared/lib/index-navigation'
import { useViewModel } from '@/shared/view-model/use-view-model'
import { gridCard } from '@/shared/ui/card/card-metrics'
import { FocusGroup } from '@/shared/ui/focus/focus-group'
import { usePage } from '@/shared/ui/page/page'
import { GridCell } from './grid-cell/grid-cell'
import { GridViewModel } from './grid.view-model'
import styles from './grid.module.css'
import { Spinner } from '@/shared/ui/spinner/spinner'

export interface GridProps {
  items: ItemShort[]
  focusKey: string
  wide?: boolean
  onReachEnd?: () => void
  loading?: boolean
  progressOf?: (item: ItemShort) => number | undefined
  subtitleOf?: (item: ItemShort) => string | undefined
  onPress?: (item: ItemShort) => void
  footer?: ReactNode
}

const COLUMNS = { poster: 6, wide: 4 }
const ROW_GAP = { caption: 44, bare: 28 }

export const Grid = observer(function Grid({
  items,
  focusKey,
  wide,
  onReachEnd,
  loading,
  progressOf,
  subtitleOf,
  onPress,
  footer,
}: GridProps) {
  const { page, hero } = usePage()
  const columns = wide ? COLUMNS.wide : COLUMNS.poster
  const card = gridCard(columns, !!wide, !hero)
  const cardVars = wide
    ? { '--wide-w': `${card.width}px`, '--wide-h': `${card.imageHeight}px` }
    : { '--card-w': `${card.width}px`, '--card-h': `${card.imageHeight}px` }
  const vm = useViewModel(
    ({ router, ui, images }) =>
      new GridViewModel(
        page,
        images,
        columns,
        card.height + (hero ? ROW_GAP.bare : ROW_GAP.caption),
        items,
        {
          onPress: onPress ?? ((item) => router.navigate(link.item(item.id), { state: { preview: item } })),
          onFocus: (item, node, note) => {
            page.reveal(node)
            ui.focusItem(item, note)
            if (item.type !== 'collection') ui.setBackdrop(widePosterUrl(item.id, item.posters))
          },
          onBlur: ui.blurItem,
          onReachEnd,
        },
      ),
  )
  const [navigation] = useState(() => gridNavigation(focusKey, vm.columns, () => vm.count))

  useEffect(() => vm.setItems(items), [vm, items])

  return (
    <FocusGroup
      focusKey={focusKey}
      nextFocusResolver={navigation}
      preferredChildFocusKey={itemFocusKey(focusKey, vm.firstVisible)}
      className={styles.grid}
    >
      <div className={styles.gridBody} ref={vm.setRoot} style={{ ...cardVars, height: vm.list.totalSize } as CSSProperties}>
        {vm.list.items.map((row) => {
          const first = row.index * vm.columns

          return (
            <div key={vm.list.slot(row.index)} className={styles.gridRow} style={{ top: row.start }}>
              {items.slice(first, first + vm.columns).map((item, column) => {
                const index = first + column

                return (
                  <GridCell
                    key={column}
                    vm={vm}
                    item={item}
                    index={index}
                    wide={wide}
                    caption={!hero}
                    focusKey={itemFocusKey(focusKey, index)}
                    progress={progressOf?.(item)}
                    subtitle={subtitleOf?.(item)}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
      {loading && (
        <div className={styles.gridLoading}>
          <Spinner />
        </div>
      )}
      {footer}
    </FocusGroup>
  )
})
