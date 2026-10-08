import type { ReactNode } from 'react'
import { cx } from '@/shared/lib/cx'
import styles from './badge.module.css'

export interface BadgeProps {
  children: ReactNode
  tone?: 'default' | 'amber'
  className?: string
}

export function Badge({ children, tone = 'default', className }: BadgeProps) {
  return <span className={cx(styles.badge, tone === 'amber' && styles.amber, className)}>{children}</span>
}
