import type { ReactNode } from 'react'
import { cx } from '@/shared/lib/cx'
import { Pressable, type PressableProps } from '@/shared/ui/focus/pressable'
import { IconCheck } from '@/shared/ui/icons/icons'
import styles from './button.module.css'

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  children: ReactNode
  icon?: ReactNode
  trailing?: ReactNode
  primary?: boolean
  active?: boolean
  size?: 'md' | 'sm'
  variant?: 'pill' | 'list'
}

export function Button({ children, icon, trailing, primary, active, size = 'md', variant = 'pill', className, ...rest }: ButtonProps) {
  const list = variant === 'list'

  return (
    <Pressable
      {...rest}
      className={cx(
        styles.btn,
        primary && styles.btnPrimary,
        active && styles.isActive,
        size === 'sm' && styles.btnSm,
        list && styles.list,
        className,
      )}
    >
      {icon}
      <span className={styles.btnText}>{children}</span>
      {trailing}
      {list && (
        <span className={styles.mark}>
          <IconCheck />
        </span>
      )}
    </Pressable>
  )
}
