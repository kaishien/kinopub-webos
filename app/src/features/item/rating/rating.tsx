import { IconStar } from '@/shared/ui/icons'
import styles from './rating.module.css'

export function Rating({ value, source }: { value: number; source: string }) {
  return (
    <span className={styles.rating}>
      <IconStar />
      {value.toFixed(1)}
      <span className={styles.ratingSource}>{source}</span>
    </span>
  )
}
