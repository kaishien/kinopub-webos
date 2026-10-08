import { setFocus } from '@noriginmedia/norigin-spatial-navigation'
import { observer } from 'mobx-react-lite'
import { useEffect } from 'react'
import { FocusGroup } from '@/shared/ui/focus/focus-group'
import { SheetOption } from '@/shared/ui/sheet/sheet-option/sheet-option'
import type { PlayerScreenViewModel } from '@/features/player/player-screen.view-model'
import styles from './player-panel.module.css'

const TITLES = { audio: 'Звук', subtitles: 'Субтитры', quality: 'Качество' } as const
const optionKey = (index: number) => `PANEL-${index}`

export const PlayerPanel = observer(function PlayerPanel({ vm }: { vm: PlayerScreenViewModel }) {
  const panel = vm.panel!
  // Options register with navigation asynchronously, so focus the selected one on the next frame.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setFocus(optionKey(vm.activePanelIndex)))
    return () => cancelAnimationFrame(frame)
  }, [panel, vm])

  const closeOnLeft = (direction: string) => {
    if (direction !== 'left') return true
    vm.closePanel()
    return false
  }
  return (
    <div className={styles.playerPanel}>
      <FocusGroup focusKey="PANEL" className={styles.playerPanelBody} isFocusBoundary preferredChildFocusKey={optionKey(0)}>
        <h2>{TITLES[panel]}</h2>
        <div className={styles.playerPanelList}>
          {vm.panelOptions.map((option, index) => (
            <SheetOption key={option.key} focusKey={optionKey(index)} active={option.active} onPress={option.select} onArrow={closeOnLeft}>
              {option.title}
            </SheetOption>
          ))}
        </div>
      </FocusGroup>
    </div>
  )
})
