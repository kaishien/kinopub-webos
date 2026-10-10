import type { ReactNode } from 'react'
import { Button } from '@/shared/ui/button'
import type { FocusLayout } from '@/shared/ui/focus'

export interface SheetOptionProps {
  children: ReactNode
  focusKey?: string
  active?: boolean
  onPress: () => void
  onArrow?: (direction: string) => boolean
}

function revealInList({ node }: FocusLayout) {
  node?.scrollIntoView({ block: 'nearest' })
}

export function SheetOption({ children, focusKey, active, onPress, onArrow }: SheetOptionProps) {
  return (
    <Button variant="list" focusKey={focusKey} active={active} onPress={onPress} onArrow={onArrow} onFocus={revealInList}>
      {children}
    </Button>
  )
}
