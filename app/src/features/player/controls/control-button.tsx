import type { ReactNode } from 'react'
import { Pressable } from '@/shared/ui/focus/pressable'
import styles from './control-button.module.css'

export interface ControlButtonProps {
  icon: ReactNode
  label: string
  value?: string
  focusKey?: string
  onPress: () => void
}

export function ControlButton({ icon, label, value, focusKey, onPress }: ControlButtonProps) {
  return (
    <Pressable focusKey={focusKey} className={styles.control} onPress={onPress}>
      {icon}
      <span>{label}</span>
      {value && <span className={styles.controlValue}>{value}</span>}
    </Pressable>
  )
}
