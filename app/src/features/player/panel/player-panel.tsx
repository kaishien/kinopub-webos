import { setFocus } from '@noriginmedia/norigin-spatial-navigation'
import { observer } from 'mobx-react-lite'
import { useEffect } from 'react'
import { FocusGroup } from '@/shared/ui/focus/focus-group'
import { SheetOption } from '@/shared/ui/sheet/sheet-option/sheet-option'
import type { PlayerScreenViewModel } from '@/features/player/player-screen.view-model'
import styles from './player-panel.module.css'

const optionKey = (column: string, index: number) => `PANEL-${column}-${index}`

/** Audio and subtitles side by side, like Netflix; quality alone. Choosing a track keeps the panel open. */
export const PlayerPanel = observer(function PlayerPanel({ vm }: { vm: PlayerScreenViewModel }) {
  const columns = vm.panelColumns
  const first = columns[0]
  const firstActive = Math.max(0, first?.options.findIndex((option) => option.active) ?? 0)

  useEffect(() => {
    if (!first) return

    const frame = requestAnimationFrame(() => setFocus(optionKey(first.key, firstActive)))

    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vm.panel])

  return (
    <div className={styles.playerPanel}>
      <FocusGroup focusKey="PANEL" className={styles.playerPanelColumns} isFocusBoundary>
        {columns.map((column) => (
          <FocusGroup key={column.key} focusKey={`PANEL-${column.key}`} className={styles.playerPanelColumn}>
            <h2>{column.title}</h2>
            <div className={styles.playerPanelList}>
              {column.options.map((option, index) => (
                <SheetOption key={option.key} focusKey={optionKey(column.key, index)} active={option.active} onPress={option.select}>
                  {option.title}
                </SheetOption>
              ))}
            </div>
          </FocusGroup>
        ))}
      </FocusGroup>
    </div>
  )
})
