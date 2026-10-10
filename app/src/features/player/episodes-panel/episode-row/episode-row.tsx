import { observer } from 'mobx-react-lite'
import type { Video } from '@/services/api/api.types'
import { cx } from '@/shared/lib/cx'
import { formatDuration } from '@/shared/lib/format'
import { Badge } from '@/shared/ui/badge'
import { Pressable, type FocusLayout } from '@/shared/ui/focus'
import { IconCheck } from '@/shared/ui/icons'
import styles from './episode-row.module.css'

export const episodeKey = (id: number) => `EPISODES-video-${id}`

export interface EpisodeRowProps {
  video: Video
  current: boolean
  onPress: () => void
  onFocus: (layout: FocusLayout) => void
}

export const EpisodeRow = observer(function EpisodeRow({ video, current, onPress, onFocus }: EpisodeRowProps) {
  const watched = video.watched === 1
  const time = watched ? 0 : (video.watching?.time ?? 0)
  const progress = video.duration ? time / video.duration : 0

  return (
    <Pressable
      focusKey={episodeKey(video.id)}
      className={cx(styles.episode, current && styles.isCurrent)}
      onPress={onPress}
      onFocus={onFocus}
    >
      <div className={styles.episodeThumb}>
        {video.thumbnail && <img src={video.thumbnail} alt="" loading="lazy" decoding="async" />}
        {!current && progress > 0 && progress < 1 && (
          <div className={styles.episodeProgress}>
            <div style={{ width: `${progress * 100}%` }} />
          </div>
        )}
      </div>
      <div className={styles.episodeInfo}>
        <div className={styles.episodeTitle}>
          {video.number}. {video.title || `Серия ${video.number}`}
        </div>
        <div className={styles.episodeMeta}>
          {formatDuration(video.duration)}
          {time > 60 ? ` · осталось ${formatDuration(video.duration - time)}` : ''}
        </div>
      </div>
      {current ? (
        <Badge tone="amber" className={styles.episodeState}>
          Сейчас
        </Badge>
      ) : (
        watched && (
          <span className={cx(styles.episodeState, styles.episodeWatched)}>
            <IconCheck />
          </span>
        )
      )}
    </Pressable>
  )
})
