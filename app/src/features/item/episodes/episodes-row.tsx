import { memo, useCallback } from 'react'
import type { Video } from '@/services/api/api.types'
import { episodeLabel, formatDuration } from '@/shared/lib/format'
import { WIDE } from '@/shared/ui/card/card-metrics'
import { Pressable } from '@/shared/ui/focus/pressable'
import { IconCheck } from '@/shared/ui/icons/icons'
import { Row, useRowItemFocus } from '@/shared/ui/row/row'
import styles from './episodes-row.module.css'
import { Badge } from '@/shared/ui/badge/badge'

export interface EpisodesRowProps {
  videos: Video[]
  season: number
  onPlay: (video: Video, season: number) => void
  focusKey?: string
  title?: string
  /** The episode playing right now: the row opens on it and marks it. */
  currentId?: number
}

export const EpisodesRow = memo(function EpisodesRow({ videos, season, onPlay, focusKey, title, currentId }: EpisodesRowProps) {
  const renderItem = useCallback(
    (index: number, itemKey: string) => (
      <EpisodeCard
        index={index}
        focusKey={itemKey}
        video={videos[index]}
        season={season}
        current={videos[index].id === currentId}
        onPlay={onPlay}
      />
    ),
    [videos, season, currentId, onPlay],
  )
  const imageOf = useCallback((index: number) => videos[index]?.thumbnail, [videos])
  const currentIndex = currentId === undefined ? -1 : videos.findIndex((video) => video.id === currentId)

  return (
    <Row
      focusKey={focusKey ?? `ROW-episodes-${season}`}
      title={title}
      count={videos.length}
      item={WIDE}
      renderItem={renderItem}
      imageOf={imageOf}
      initialIndex={currentIndex < 0 ? undefined : currentIndex}
    />
  )
})

const EpisodeCard = memo(function EpisodeCard({
  index,
  focusKey,
  video,
  season,
  current,
  onPlay,
}: {
  index: number
  focusKey: string
  video: Video
  season: number
  current: boolean
  onPlay: (video: Video, season: number) => void
}) {
  const notify = useRowItemFocus()
  const watched = video.watched === 1
  const time = watched ? 0 : (video.watching?.time ?? 0)
  const progress = watched ? 1 : video.duration ? time / video.duration : 0

  return (
    <Pressable className={styles.episode} focusKey={focusKey} onPress={() => onPlay(video, season)} onFocus={() => notify(index)}>
      <div className={styles.episodeImg}>
        {video.thumbnail && <img src={video.thumbnail} alt="" decoding="async" />}
        <Badge className={styles.episodeNum}>{episodeLabel(season, video.number)}</Badge>
        {current && (
          <Badge tone="amber" className={styles.episodeNow}>
            Сейчас
          </Badge>
        )}
        {watched && !current && (
          <span className={styles.episodeWatched}>
            <IconCheck />
          </span>
        )}
        {!current && progress > 0 && progress < 1 && (
          <div className={styles.episodeProgress}>
            <div style={{ width: `${progress * 100}%` }} />
          </div>
        )}
      </div>
      <div className={styles.episodeTitle}>{video.title || `Серия ${video.number}`}</div>
      <div className={styles.episodeSub}>
        {formatDuration(video.duration)}
        {time > 60 ? ` · осталось ${formatDuration(video.duration - time)}` : ''}
      </div>
    </Pressable>
  )
})
