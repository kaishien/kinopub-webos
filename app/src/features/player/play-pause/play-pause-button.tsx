import { observer } from 'mobx-react-lite'
import { IconPause, IconPlay } from '@/shared/ui/icons'
import type { PlayerScreenViewModel } from '../player-screen.view-model'
import styles from './play-pause-button.module.css'

/**
 * For the Magic Remote pointer only: the remote's OK on the bar already toggles playback, and a focusable button
 * left of the bar would sit between the controls and the bar, where left/right seek.
 */
export const PlayPauseButton = observer(function PlayPauseButton({ vm }: { vm: PlayerScreenViewModel }) {
  return (
    <div className={styles.playPause} role="button" aria-label={vm.playing ? 'Пауза' : 'Смотреть'} onClick={vm.onPointerClick}>
      {vm.playing ? <IconPause /> : <IconPlay />}
    </div>
  )
})
