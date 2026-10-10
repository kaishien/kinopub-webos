import { observer } from 'mobx-react-lite'
import type { CSSProperties, SyntheticEvent } from 'react'
import type { Video } from '@/services/api/api.types'
import { cx } from '@/shared/lib/cx'
import { episodeLabel } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { FocusGroup } from '@/shared/ui/focus'
import { IconNext, IconPlay } from '@/shared/ui/icons'
import { COUNTDOWN_S, type NextUp } from './next-up'
import styles from './next-up-card.module.css'

const FILL_STYLE = { '--countdown': `${COUNTDOWN_S}s` } as CSSProperties

const hideBroken = (event: SyntheticEvent<HTMLImageElement>) => {
  event.currentTarget.style.visibility = 'hidden'
}

export const NEXT_UP_FOCUS_KEY = 'PLAYER-next-play'

interface NextUpCardProps {
  nextUp: NextUp
  next: { video: Video; season: number }
  onExit: () => void
}

export const NextUpCard = observer(function NextUpCard({ nextUp, next, onExit }: NextUpCardProps) {
  const asking = nextUp.phase === 'still-watching'
  const counting = nextUp.countdown !== null
  const title = [episodeLabel(next.season, next.video.number), next.video.title].filter(Boolean).join(' · ')

  return (
    <FocusGroup focusKey="PLAYER-next" className={styles.nextUp} preferredChildFocusKey={NEXT_UP_FOCUS_KEY} isFocusBoundary>
      {next.video.thumbnail && (
        // Some episodes have no thumbnail on the server: hide the broken-image icon, keep the empty backdrop.
        <img className={styles.thumb} src={next.video.thumbnail} alt="" decoding="async" onError={hideBroken} />
      )}
      <div className={styles.body}>
        <div className={styles.label}>{asking ? 'Вы ещё смотрите?' : 'Следующая серия'}</div>
        <div className={styles.title}>{title}</div>
        <div className={styles.actions}>
          <Button
            primary
            focusKey={NEXT_UP_FOCUS_KEY}
            icon={asking ? <IconPlay /> : <IconNext />}
            className={cx(counting && styles.counting)}
            // Keying by countdown run restarts the animation without recreating the focused button.
            trailing={counting && <span key={nextUp.run} className={styles.fill} style={FILL_STYLE} />}
            onPress={nextUp.playNow}
          >
            {asking ? 'Продолжить' : counting ? `Смотреть через ${nextUp.countdown}` : 'Смотреть'}
          </Button>
          {nextUp.phase === 'credits' ? <Button onPress={nextUp.dismiss}>Смотреть титры</Button> : <Button onPress={onExit}>Выйти</Button>}
        </div>
      </div>
    </FocusGroup>
  )
})
