import { observer } from 'mobx-react-lite'
import { useServices } from '@/services/services'
import { Button } from '@/shared/ui/button'
import { FocusGroup } from '@/shared/ui/focus'
import { IconRefresh } from '@/shared/ui/icons'
import styles from './pair-screen.module.css'

export const PairScreen = observer(function PairScreen() {
  const { auth } = useServices()
  const device = auth.device
  const site = device?.verification_uri?.replace(/^https?:\/\//, '') ?? 'kino.pub/device'

  return (
    <FocusGroup focusKey="PAIR" className={styles.pair} preferredChildFocusKey="PAIR-refresh">
      <div>
        <div className={styles.pairLogo}>К</div>
        <h1>Кинопаб</h1>
        <p className={styles.pairLead}>Чтобы начать, привяжите телевизор к аккаунту.</p>
        <ol className={styles.pairSteps}>
          <li>
            Откройте на телефоне или компьютере <b>{site}</b>
          </li>
          <li>Войдите в аккаунт Кинопаба</li>
          <li>Введите код с экрана</li>
        </ol>
        {auth.pairingError && <p className={styles.pairError}>{auth.pairingError}</p>}
        <Button icon={<IconRefresh />} onPress={auth.startPairing} focusKey="PAIR-refresh">
          Запросить новый код
        </Button>
      </div>
      <div className={styles.pairRight}>
        <div className={styles.pairCodeLabel}>Код устройства</div>
        <div className={styles.pairCode}>{device?.user_code ?? '· · · · ·'}</div>
        <div className={styles.pairHint}>Код действует 10 минут. Экран сам сменится после подтверждения.</div>
      </div>
    </FocusGroup>
  )
})
