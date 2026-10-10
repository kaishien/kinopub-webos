import { observer } from 'mobx-react-lite'
import { formatClock } from '@/shared/lib/format'
import { Pressable } from '@/shared/ui/focus'
import type { PlayerScreenViewModel } from '../player-screen.view-model'
import styles from './progress-bar.module.css'

interface ProgressBarProps {
  vm: PlayerScreenViewModel
  focusKey: string
}

/** The only HUD piece that reads `time`, so timeupdate (several times a second) re-renders just this bar, not the whole screen. */
export const ProgressBar = observer(function ProgressBar({ vm, focusKey }: ProgressBarProps) {
  return (
    <Pressable focusKey={focusKey} className={styles.progress} onPress={vm.togglePlay} onArrow={vm.onBarArrow}>
      <div className={styles.bar}>
        <div className={styles.barFill} style={{ width: `${vm.progress}%` }} />
        <div className={styles.barKnob} style={{ left: `${vm.progress}%` }}>
          <span className={styles.barTip}>{formatClock(vm.shownTime)}</span>
        </div>
      </div>
      <span className={styles.remaining}>{formatClock(vm.remaining)}</span>
    </Pressable>
  )
})
