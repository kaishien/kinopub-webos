import { setFocus } from '@noriginmedia/norigin-spatial-navigation'
import { observer } from 'mobx-react-lite'
import { useEffect } from 'react'
import { useLocation, useParams, useSearchParams } from 'react-router'
import type { QualityPreference } from '@/services/settings/settings.service'
import { episodeLabel, formatClock } from '@/shared/lib/format'
import { cx } from '@/shared/lib/cx'
import { Button } from '@/shared/ui/button/button'
import { FocusGroup } from '@/shared/ui/focus/focus-group'
import { Pressable } from '@/shared/ui/focus/pressable'
import { IconNext, IconPause, IconPlay, IconSound, IconSpark, IconSubs } from '@/shared/ui/icons/icons'
import { useViewModel } from '@/shared/view-model/use-view-model'
import { ControlButton } from './controls/control-button'
import { NEXT_UP_FOCUS_KEY, NextUpCard } from './next-up/next-up-card'
import { PlayerPanel } from './panel/player-panel'
import { PlayerScreenViewModel } from './player-screen.view-model'
import styles from './player-screen.module.css'
import { Spinner } from '@/shared/ui/spinner/spinner'

const FOCUS = { play: 'PLAYER-play', bar: 'PLAYER-bar', next: NEXT_UP_FOCUS_KEY, back: 'PLAYER-back', retry: 'PLAYER-retry' }

/** Quality and episode changes replace the route; keying by history entry recreates the player and its view-model. */
export function PlayerScreen() {
  const location = useLocation()
  return <PlayerContent key={location.key} />
}

const PlayerContent = observer(function PlayerContent() {
  const { id = '0', videoId = '0' } = useParams()
  const [search] = useSearchParams()
  const location = useLocation()
  const state = location.state as { trailer?: string; autoplayChain?: number } | null
  const vm = useViewModel(
    (services) =>
      new PlayerScreenViewModel(services, {
        itemId: Number(id),
        videoId: Number(videoId),
        startTime: Number(search.get('t')) || 0,
        quality: (search.get('q') as QualityPreference | null) ?? undefined,
        trailerUrl: state?.trailer,
        autoplayChain: state?.autoplayChain,
      }),
  )

  useEffect(() => {
    // The error screen must grab focus, otherwise it stays on the HUD buttons underneath.
    // Buttons register with navigation asynchronously, so focus on the next frame.
    if (vm.error) {
      const frame = requestAnimationFrame(() => setFocus(FOCUS.retry))
      return () => cancelAnimationFrame(frame)
    }
    if (vm.nextUp.visible) {
      const frame = requestAnimationFrame(() => setFocus(FOCUS.next))
      return () => cancelAnimationFrame(frame)
    }
    if (vm.panel) return
    if (vm.hudVisible) setFocus(vm.hudTarget === 'bar' ? FOCUS.bar : FOCUS.play)
  }, [vm.nextUp.visible, vm.hudVisible, vm.hudTarget, vm.hasSource, vm.error, vm.panel])

  return (
    <div className={cx(styles.player, (vm.hudVisible || vm.nextUp.visible) && styles.hudOpen)}>
      {vm.hasSource && (
        // Fallback needs a fresh element: the old one is bound to hls.js's MediaSource.
        <video key={vm.fallback ? 'file' : 'stream'} ref={vm.attach} src={vm.src} autoPlay playsInline crossOrigin="anonymous">
          {vm.subtitles.url && (
            <track kind="subtitles" src={vm.subtitles.url} srcLang={vm.subtitles.lang} label={vm.subtitles.label} default />
          )}
        </video>
      )}

      {vm.buffering && !vm.error && (
        <div className={styles.playerCenter}>
          <Spinner />
        </div>
      )}
      {vm.flash && (
        <div className={styles.playerCenter} key={vm.flash}>
          <div className={styles.playerFlash}>{vm.flash === 'play' ? <IconPlay /> : <IconPause />}</div>
        </div>
      )}

      {vm.error && (
        <div className={styles.playerError}>
          <h3>Не удалось запустить видео</h3>
          <p>{vm.error}</p>
          <FocusGroup focusKey="PLAYER-error" className={styles.playerErrorActions} preferredChildFocusKey={FOCUS.retry} isFocusBoundary>
            <Button primary focusKey={FOCUS.retry} onPress={vm.retry}>
              Повторить
            </Button>
            <Button focusKey={FOCUS.back} onPress={vm.exit}>
              Назад
            </Button>
          </FocusGroup>
        </div>
      )}

      <div className={cx(styles.playerHud, vm.hudVisible && styles.isVisible)}>
        <header className={styles.playerHead}>
          <div>
            <div className={styles.playerTitle}>{vm.title}</div>
            {vm.subtitle && <div className={styles.playerSubtitle}>{vm.subtitle}</div>}
          </div>
          {!vm.isTrailer && vm.qualityLabel && <div className={styles.playerChip}>{vm.qualityLabel}</div>}
        </header>

        <div className={styles.playerDock}>
          <Pressable
            focusKey={FOCUS.bar}
            className={styles.playerBarHit}
            onPress={vm.togglePlay}
            onArrow={(direction) => {
              if (direction === 'left' || direction === 'right') {
                vm.seekBy(direction === 'right' ? vm.seekStepValue : -vm.seekStepValue)
                return false
              }
              return direction === 'down'
            }}
          >
            <div className={styles.playerBar}>
              <div className={styles.playerBarFill} style={{ width: `${vm.progress}%` }} />
              <div className={styles.playerBarKnob} style={{ left: `${vm.progress}%` }}>
                {vm.seekPreview !== null && <span className={styles.playerBarTip}>{formatClock(vm.seekPreview)}</span>}
              </div>
            </div>
            <div className={styles.playerTimes}>
              <span>{formatClock(vm.shownTime)}</span>
              <span className={styles.playerTimesRemaining}>−{formatClock(vm.remaining)}</span>
            </div>
          </Pressable>

          <FocusGroup
            focusKey="PLAYER-controls"
            className={styles.playerControls}
            preferredChildFocusKey={FOCUS.play}
            isFocusBoundary
            focusBoundaryDirections={['left', 'right']}
          >
            <ControlButton
              primary
              focusKey={FOCUS.play}
              icon={vm.playing ? <IconPause /> : <IconPlay />}
              label={vm.playing ? 'Пауза' : 'Играть'}
              onPress={vm.togglePlay}
            />
            {vm.hasAudioChoice && (
              <ControlButton icon={<IconSound />} label="Звук" value={vm.audioLabel} onPress={() => vm.openPanel('audio')} />
            )}
            {vm.hasSubtitles && (
              <ControlButton icon={<IconSubs />} label="Субтитры" value={vm.subtitleLabel} onPress={() => vm.openPanel('subtitles')} />
            )}
            {vm.hasQualityChoice && (
              <ControlButton icon={<IconSpark />} label="Качество" value={vm.qualityLabel} onPress={() => vm.openPanel('quality')} />
            )}
            {vm.next && (
              <ControlButton
                icon={<IconNext />}
                label="Следующая"
                value={episodeLabel(vm.next.season, vm.next.video.number)}
                onPress={vm.playNext}
              />
            )}
          </FocusGroup>
        </div>
      </div>

      {vm.nextUp.visible && vm.next && <NextUpCard nextUp={vm.nextUp} next={vm.next} onExit={vm.exit} />}
      {vm.panel && <PlayerPanel vm={vm} />}
    </div>
  )
})
