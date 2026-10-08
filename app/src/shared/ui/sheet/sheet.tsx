import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation'
import { useEffect, type ReactNode } from 'react'
import { useServices } from '@/services/services'
import { RemoteKey, RemoteService } from '@/services/remote/remote.service'
import { FocusGroup } from '@/shared/ui/focus/focus-group'
import styles from './sheet.module.css'

export interface SheetProps {
  title: string
  children: ReactNode
  onClose: () => void
  focusKey?: string
  initialFocusKey?: string
  returnFocusKey?: string
}

export function Sheet({ title, children, onClose, focusKey = 'SHEET', initialFocusKey, returnFocusKey }: SheetProps) {
  const { remote } = useServices()
  useEffect(
    () =>
      remote.push((event) => {
        // The sheet slides in from the right, so Left closes it like Back.
        if (!RemoteService.isBack(event) && event.keyCode !== RemoteKey.Left) return false
        onClose()
        return true
      }),
    [remote, onClose],
  )
  useEffect(() => {
    // Focusables register asynchronously, so set focus on the next frame once they exist.
    const frame = requestAnimationFrame(() => {
      if (initialFocusKey && doesFocusableExist(initialFocusKey)) setFocus(initialFocusKey)
      else setFocus(focusKey)
    })
    return () => {
      cancelAnimationFrame(frame)
      if (returnFocusKey) setFocus(returnFocusKey)
    }
    // Run only on open and close.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className={styles.sheet}>
      <FocusGroup focusKey={focusKey} className={styles.sheetPanel} isFocusBoundary>
        <h2>{title}</h2>
        <div className={styles.sheetList}>{children}</div>
      </FocusGroup>
    </div>
  )
}
