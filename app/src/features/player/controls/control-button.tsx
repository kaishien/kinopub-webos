import type { ReactNode } from 'react'
import { cx } from '@/shared/lib/cx'
import { Pressable } from '@/shared/ui/focus/pressable'
import styles from './control-button.module.css'

export interface ControlButtonProps {
  icon: ReactNode
  label: string
  value?: string
  focusKey?: string
  primary?: boolean
  onPress: () => void
}

export function ControlButton({ icon, label, value, focusKey, primary, onPress }: ControlButtonProps) {
  return (
    <Pressable focusKey={focusKey} className={cx(styles.control, primary && styles.controlPrimary)} onPress={onPress}>
      <span className={styles.controlCircle}>{icon}</span>
      <span className={styles.controlLabel}>{label}</span>
      {value && <span className={styles.controlValue}>{value}</span>}
    </Pressable>
  )
}
