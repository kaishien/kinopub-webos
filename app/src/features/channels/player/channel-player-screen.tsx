import { observer } from 'mobx-react-lite'
import { useParams } from 'react-router'
import { cx } from '@/shared/lib/cx'
import { useViewModel } from '@/shared/view-model/use-view-model'
import { ChannelPlayerScreenViewModel } from './channel-player-screen.view-model'
import styles from '@/features/player/player-screen.module.css'
import { Spinner } from '@/shared/ui/spinner/spinner'

/** Switching channels replaces the route; keying by channel recreates the screen and its view-model. */
export function ChannelPlayerScreen() {
  const { id = '0' } = useParams()

  return <ChannelPlayerContent key={id} channelId={Number(id)} />
}

const ChannelPlayerContent = observer(function ChannelPlayerContent({ channelId }: { channelId: number }) {
  const vm = useViewModel((services) => new ChannelPlayerScreenViewModel(services, channelId))
  const channel = vm.channel

  return (
    <div className={styles.player}>
      {channel && <video ref={vm.attach} autoPlay playsInline onPlaying={vm.onPlaying} onError={vm.onVideoError} />}
      {vm.loading && !vm.error && (
        <div className={styles.playerCenter}>
          <Spinner />
        </div>
      )}
      {vm.error && (
        <div className={styles.playerError}>
          <h3>{channel?.title}</h3>
          <p>{vm.error}</p>
        </div>
      )}
      <div className={cx(styles.playerHud, vm.hudVisible && styles.isVisible)}>
        <div className={styles.playerHead}>
          <div className={styles.playerTitle}>{channel?.title}</div>
          {channel?.current && <div className={styles.playerSubtitle}>{channel.current}</div>}
        </div>
        <div className={styles.playerDock}>
          <div className={styles.playerHint}>
            Канал {vm.index + 1} из {vm.list.length}. Вверх и вниз на пульте переключают каналы.
          </div>
        </div>
      </div>
    </div>
  )
})
