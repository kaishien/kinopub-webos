import { memo } from 'react'
import type { ItemShort } from '@/services/api/api.types'
import { qualityBadge, splitTitle } from '@/shared/lib/format'
import { cx } from '@/shared/lib/cx'
import { Pressable, type FocusLayout } from '@/shared/ui/focus/pressable'
import styles from './card.module.css'
import { Badge } from '@/shared/ui/badge/badge'

export interface CardProps {
  item: ItemShort
  wide?: boolean
  focusKey?: string
  /** 0..1 */
  progress?: number
  subtitle?: string
  /** Off on hero screens: rasterizing caption text for each new row was the main cause of dropped frames on the TV. */
  caption?: boolean
  onPress: (item: ItemShort) => void
  onFocus?: (item: ItemShort, layout: FocusLayout) => void
  onBlur?: (item: ItemShort) => void
}

/** Always the light `medium` poster (~30 KB); wide frames weigh megabytes and are only for the backdrop. */
export const Card = memo(function Card({ item, wide, focusKey, progress, subtitle, caption = true, onPress, onFocus, onBlur }: CardProps) {
  const quality = qualityBadge(item.quality)
  const fresh = (item.new ?? 0) > 0
  return (
    <Pressable
      focusKey={focusKey}
      className={cx(styles.card, wide ? styles.cardWide : styles.cardPoster)}
      onPress={() => onPress(item)}
      onFocus={onFocus ? (layout) => onFocus(item, layout) : undefined}
      onBlur={onBlur ? () => onBlur(item) : undefined}
    >
      <div className={styles.cardImg}>
        <img src={item.posters.medium} alt="" loading="lazy" decoding="async" />
        {quality && <Badge className={styles.cardQ}>{quality}</Badge>}
        {fresh && (
          <Badge tone="amber" className={styles.cardNew}>
            +{item.new}
          </Badge>
        )}
        {progress !== undefined && progress > 0 && (
          <div className={styles.cardProgress}>
            <div style={{ width: `${Math.min(100, progress * 100)}%` }} />
          </div>
        )}
      </div>
      {caption && <CardCaption item={item} subtitle={subtitle} />}
    </Pressable>
  )
})

function CardCaption({ item, subtitle }: { item: ItemShort; subtitle?: string }) {
  const sub = subtitle ?? (item.year ? String(item.year) : '')
  return (
    <>
      <div className={styles.cardTitle}>{splitTitle(item.title).ru}</div>
      {sub && <div className={styles.cardSub}>{sub}</div>}
    </>
  )
}
