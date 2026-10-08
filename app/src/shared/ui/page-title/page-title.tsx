import type { ReactNode } from 'react'
import styles from './page-title.module.css'

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className={styles.title}>{children}</h1>
}
