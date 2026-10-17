import { useFocusable } from '@noriginmedia/norigin-spatial-navigation'
import { memo, type CSSProperties, type ReactNode } from 'react'
import { cx } from '@/shared/lib/cx'
import { useServices } from '@/services/services'

/** Node only: coordinates are read lazily and only navigation needs them. */
export interface FocusLayout {
  node: HTMLElement | null
}

export interface PressableProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  focusKey?: string
  focusable?: boolean
  onPress?: () => void
  onFocus?: (layout: FocusLayout) => void
  onBlur?: () => void
  /** Return false to block navigation in this direction. */
  onArrow?: (direction: string) => boolean
}

/**
 * norigin registers a focusable once, on mount, and ignores a later change of its key. A list that re-keys its rows
 * (an item removed, a virtualized cell reused) would keep Enter bound to the old row, so the node remounts per key.
 */
export const Pressable = memo(function Pressable(props: PressableProps) {
  return <PressableNode key={props.focusKey ?? ''} {...props} />
})

/** The Magic Remote pointer takes focus on hover; mousemove rather than mouseenter, which fires before the pointer is marked as in use. */
function PressableNode({ children, className, style, focusKey, focusable = true, onPress, onFocus, onBlur, onArrow }: PressableProps) {
  const { ui } = useServices()
  const { ref, focused, focusSelf } = useFocusable<object, HTMLDivElement>({
    focusKey,
    focusable,
    onEnterPress: onPress,
    onArrowPress: onArrow ? (direction) => onArrow(direction) : undefined,
    onFocus: onFocus ? (layout) => onFocus({ node: layout.node as HTMLElement | null }) : undefined,
    onBlur: onBlur ? () => onBlur() : undefined,
  })

  return (
    <div
      ref={ref}
      data-pressable
      className={cx(className, focused && 'is-focused')}
      style={style}
      onMouseMove={() => ui.pointer && !focused && focusSelf()}
      onClick={onPress}
    >
      {children}
    </div>
  )
}
