import { observer } from 'mobx-react-lite'
import { FocusGroup } from '@/shared/ui/focus/focus-group'
import { Pressable } from '@/shared/ui/focus/pressable'
import { useReveal } from '@/shared/ui/page/page'
import type { ChannelsScreenViewModel } from '@/features/channels/channels-screen.view-model'
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
