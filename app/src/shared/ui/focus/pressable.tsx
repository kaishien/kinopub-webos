import { useFocusable } from '@noriginmedia/norigin-spatial-navigation'
import { memo, type CSSProperties, type ReactNode } from 'react'
import { cx } from '@/shared/lib/cx'

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

/** The Magic Remote pointer takes focus on hover. */
export const Pressable = memo(function Pressable({
  children,
  className,
  style,
  focusKey,
  focusable = true,
  onPress,
  onFocus,
  onBlur,
  onArrow,
}: PressableProps) {
  const { ref, focused, focusSelf } = useFocusable<object, HTMLDivElement>({
    focusKey,
    focusable,
    onEnterPress: onPress,
    onArrowPress: onArrow ? (direction) => onArrow(direction) : undefined,
    onFocus: onFocus ? (layout) => onFocus({ node: layout.node as HTMLElement | null }) : undefined,
    onBlur: onBlur ? () => onBlur() : undefined,
  })

  return (
    <div ref={ref} className={cx(className, focused && 'is-focused')} style={style} onMouseEnter={focusSelf} onClick={onPress}>
      {children}
    </div>
  )
})
