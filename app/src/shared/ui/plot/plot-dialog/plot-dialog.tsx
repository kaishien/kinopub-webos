import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { RemoteKey, RemoteService } from '@/services/remote/remote.service'
import { useServices } from '@/services/services'
import styles from './plot-dialog.module.css'

const SCROLL_STEP = 160

export interface PlotDialogProps {
  title: string
  text: string
  onClose: () => void
}

/**
 * Holds every key while open: focus stays on the plot underneath, so the page must not react to arrows.
 * Rendered into body: the page is shifted by the rail and moved with transforms, which would carry the dialog along.
 */
export function PlotDialog({ title, text, onClose }: PlotDialogProps) {
  const { remote } = useServices()
  const body = useRef<HTMLDivElement>(null)

  useEffect(
    () =>
      remote.push((event) => {
        if (RemoteService.isBack(event) || event.keyCode === RemoteKey.Enter) onClose()
        else if (event.keyCode === RemoteKey.Up) body.current?.scrollBy({ top: -SCROLL_STEP, behavior: 'smooth' })
        else if (event.keyCode === RemoteKey.Down) body.current?.scrollBy({ top: SCROLL_STEP, behavior: 'smooth' })

        return true
      }),
    [remote, onClose],
  )

  return createPortal(
    <div className={styles.plotDialog} onClick={onClose}>
      <div className={styles.plotDialogPanel}>
        <h2>{title}</h2>
        <div ref={body} className={styles.plotDialogBody}>
          {text}
        </div>
        <div className={styles.plotDialogHint}>OK или «Назад» — закрыть</div>
      </div>
    </div>,
    document.body,
  )
}
