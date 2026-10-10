import { observer } from 'mobx-react-lite'
import { FocusGroup, Pressable } from '@/shared/ui/focus'
import { useReveal } from '@/shared/ui/page'
import type { ChannelsScreenViewModel } from '../channels-screen.view-model'
import styles from './channels-grid.module.css'

export const ChannelsGrid = observer(function ChannelsGrid({ vm }: { vm: ChannelsScreenViewModel }) {
  const reveal = useReveal()

  return (
    <FocusGroup focusKey="GRID-channels" className={styles.channels}>
      {(vm.channels.data ?? []).map((channel, index) => (
        <Pressable
          key={channel.id}
          focusKey={`CH-${index}`}
          className={styles.channel}
          onPress={() => vm.open(channel)}
          onFocus={(layout) => reveal(layout.node)}
        >
          <img src={channel.logos.m || channel.logos.s} alt="" loading="lazy" />
          <div className={styles.channelName}>{channel.title}</div>
        </Pressable>
      ))}
    </FocusGroup>
  )
})
