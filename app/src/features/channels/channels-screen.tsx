import { observer } from 'mobx-react-lite'
import { Page } from '@/shared/ui/page/page'
import { Status } from '@/shared/ui/status/status'
import { useViewModel } from '@/shared/view-model/use-view-model'
import { ChannelsGrid } from './channels-grid/channels-grid'
import { ChannelsScreenViewModel } from './channels-screen.view-model'
import { PageTitle } from '@/shared/ui/page-title/page-title'

export const ChannelsScreen = observer(function ChannelsScreen() {
  const vm = useViewModel((services) => new ChannelsScreenViewModel(services))
  return (
    <Page focusKey="PAGE-channels" initialFocusKey="CH-0" ready={!vm.channels.isLoading}>
      <PageTitle>Каналы</PageTitle>
      <Status loading={vm.channels.isLoading} error={vm.channels.error?.message} onRetry={() => vm.channels.refetch()} />
      <ChannelsGrid vm={vm} />
    </Page>
  )
})
