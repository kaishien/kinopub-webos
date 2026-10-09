import { setFocus } from '@noriginmedia/norigin-spatial-navigation'
import { observer } from 'mobx-react-lite'
import { useEffect } from 'react'
import { Button } from '@/shared/ui/button/button'
import { FocusGroup } from '@/shared/ui/focus/focus-group'
import type { FocusLayout } from '@/shared/ui/focus/pressable'
import { useViewModel } from '@/shared/view-model/use-view-model'
import type { PlayerScreenViewModel } from '@/features/player/player-screen.view-model'
import { EpisodeRow, episodeKey } from './episode-row/episode-row'
import { EpisodesPanelViewModel } from './episodes-panel.view-model'
import styles from './episodes-panel.module.css'

const seasonKey = (index: number) => `EPISODES-season-${index}`

export function revealCentered({ node }: FocusLayout) {
  node?.scrollIntoView({ block: 'center' })
}

export const EpisodesPanel = observer(function EpisodesPanel({ player }: { player: PlayerScreenViewModel }) {
  const vm = useViewModel(() => new EpisodesPanelViewModel(player.episodeSeasons, player.video?.id))
  const preferred = vm.videos[vm.preferredIndex]
  const withSeasons = vm.seasons.length > 1

  // Rows register with navigation asynchronously, so focus on the next frame.
  useEffect(() => {
    if (!preferred) return

    const frame = requestAnimationFrame(() => setFocus(episodeKey(preferred.id)))

    return () => cancelAnimationFrame(frame)
    // Only on open: later the focus follows the user between seasons.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vm])

  return (
    <div className={styles.episodesPanel}>
      <FocusGroup focusKey="EPISODES" className={styles.episodesPanelBody} isFocusBoundary>
        {withSeasons && (
          <FocusGroup
            focusKey="EPISODES-seasons"
            className={styles.episodesPanelSeasons}
            preferredChildFocusKey={seasonKey(vm.seasonIndex)}
          >
            {vm.seasons.map((season, index) => (
              <Button
                key={season.number}
                variant="list"
                focusKey={seasonKey(index)}
                active={index === vm.seasonIndex}
                onFocus={(layout) => {
                  revealCentered(layout)
                  vm.selectSeason(index)
                }}
                onPress={() => setFocus(episodeKey((vm.videos[vm.preferredIndex] ?? vm.videos[0]).id))}
              >
                Сезон {season.number}
              </Button>
            ))}
          </FocusGroup>
        )}

        <div className={styles.episodesPanelMain}>
          <h2>{vm.season?.number ? `Сезон ${vm.season.number}` : 'Части'}</h2>
          <FocusGroup
            key={vm.seasonIndex}
            focusKey="EPISODES-list"
            className={styles.episodesPanelList}
            preferredChildFocusKey={preferred && episodeKey(preferred.id)}
          >
            {vm.videos.map((video) => (
              <EpisodeRow
                key={video.id}
                video={video}
                current={video.id === vm.currentId}
                onPress={() => player.playEpisode(video)}
                onFocus={revealCentered}
              />
            ))}
          </FocusGroup>
        </div>
      </FocusGroup>
    </div>
  )
})
