import { cx } from '@/shared/lib/cx'
import { Pressable, type PressableProps } from '@/shared/ui/focus/pressable'
import card from '@/shared/ui/card/card.module.css'
import styles from './more-card.module.css'

export function MoreCard({ focusKey, onPress, onFocus }: Pick<PressableProps, 'focusKey' | 'onPress' | 'onFocus'>) {
  return (
    <Pressable focusKey={focusKey} className={cx(card.card, card.cardPoster)} onPress={onPress} onFocus={onFocus}>
      <div className={cx(card.cardImg, styles.label)}>Показать все</div>
    </Pressable>
  )
}
