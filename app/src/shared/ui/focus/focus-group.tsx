import { FocusContext, useFocusable, type UseFocusableConfig } from '@noriginmedia/norigin-spatial-navigation'
import type { CSSProperties, ReactNode } from 'react'
import { cx } from '@/shared/lib/cx'
import { useOptionalPage } from '@/shared/ui/page/page-context'

export interface FocusGroupProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  focusKey?: string
  preferredChildFocusKey?: string
  isFocusBoundary?: boolean
  focusBoundaryDirections?: UseFocusableConfig['focusBoundaryDirections']
  onChildFocus?: () => void
  /** With a custom resolver, children aren't measured on every key press. */
  nextFocusResolver?: UseFocusableConfig['nextFocusResolver']
  reveal?: boolean
}

export function FocusGroup({
  children,
  className,
  style,
  focusKey,
  preferredChildFocusKey,
  isFocusBoundary,
  focusBoundaryDirections,
  onChildFocus,
  nextFocusResolver,
  reveal,
}: FocusGroupProps) {
  const page = useOptionalPage()?.page
  const {
    ref,
    focusKey: key,
    hasFocusedChild,
  } = useFocusable({
    focusKey,
    preferredChildFocusKey,
    isFocusBoundary,
    focusBoundaryDirections,
    trackChildren: true,
    saveLastFocusedChild: true,
    onFocus: reveal
      ? () => {
          page?.reveal(ref.current)
          onChildFocus?.()
        }
      : onChildFocus,
    nextFocusResolver,
    measureChildrenLayout: !nextFocusResolver,
  })

  return (
    <FocusContext.Provider value={key}>
      <div ref={ref} className={cx(className, hasFocusedChild && 'has-focus')} style={style}>
        {children}
      </div>
    </FocusContext.Provider>
  )
}
