import type { ReactNode } from 'react'
import styles from './empty.module.css'

export function Empty({ children }: { children: ReactNode }) {
  return <div className={styles.empty}>{children}</div>
}
