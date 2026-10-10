import { memo } from 'react'
import type { ItemShort } from '@/services/api/api.types'
import { Card } from '@/shared/ui/card'
import type { FocusLayout } from '@/shared/ui/focus'
import type { GridViewModel } from '../grid.view-model'

export interface GridCellProps {
  vm: GridViewModel
  item: ItemShort
  index: number
  wide?: boolean
  caption: boolean
  focusKey: string
  progress?: number
  subtitle?: string
}

/** Props stay stable across grid re-renders, which is what makes memo effective. */
export const GridCell = memo(function GridCell({ vm, item, index, wide, caption, focusKey, progress, subtitle }: GridCellProps) {
  return (
    <Card
      item={item}
      wide={wide}
      caption={caption}
      focusKey={focusKey}
      progress={progress}
      subtitle={subtitle}
      onPress={vm.press}
      onFocus={(it, layout: FocusLayout) => vm.focus(it, index, layout.node, subtitle)}
      onBlur={vm.blur}
    />
  )
})
