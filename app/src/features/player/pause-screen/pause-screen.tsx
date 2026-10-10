import { observer } from 'mobx-react-lite'
import type { PlayerScreenViewModel } from '../player-screen.view-model'
import styles from './pause-screen.module.css'

export const PauseScreen = observer(function PauseScreen({ vm }: { vm: PlayerScreenViewModel }) {
  return (
    <div className={styles.pauseScreen}>
      <div className={styles.pauseScreenBody}>
        <div className={styles.pauseScreenLabel}>Вы смотрите</div>
        <h1 className={styles.pauseScreenTitle}>{vm.title}</h1>
        {vm.subtitle && <div className={styles.pauseScreenEpisode}>{vm.subtitle}</div>}
        {vm.plot && <p className={styles.pauseScreenPlot}>{vm.plot}</p>}
      </div>
    </div>
  )
})
