import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation'
import { observer } from 'mobx-react-lite'
import { useEffect, useState, type ReactNode } from 'react'
import { useServices } from '@/services/services'
import { cx } from '@/shared/lib/cx'
import { useViewModel } from '@/shared/view-model/use-view-model'
import { FocusGroup } from '@/shared/ui/focus'
import { HERO_HEIGHT, SCREEN_HEIGHT } from '@/shared/ui/card'
import { PageHero } from './page-hero/page-hero'
import { PageContext, type PageContextValue } from '@/shared/ui/page-context'
import { PageViewModel } from './page.view-model'
import styles from './page.module.css'

export interface PageProps {
  children: ReactNode
  focusKey: string
  className?: string
  top?: number
  initialFocusKey?: string
  ready?: boolean
  hero?: boolean
  title?: string
}

const FOCUS_DELAY_MS = 30
const PAGE_AREA = 'page'
/** With the hero, the focused row sits right below it; rows above scroll out of view. */
const HERO_TOP = 24
const VERTICAL: Array<'up' | 'down'> = ['up', 'down']

/** Scrolls via transform instead of native scrolling: no scrollbars and no jank on the TV. */
export const Page = observer(function Page({
  children,
  focusKey,
  className,
  top,
  initialFocusKey,
  ready = true,
  hero = false,
  title,
}: PageProps) {
  const { router, focusMemory, ui } = useServices()
  // Capture the history key on mount: location changes before the screen unmounts.
  const [locationKey] = useState(() => router.location?.key ?? 'root')
  const vm = useViewModel(
    () =>
      new PageViewModel(
        top ?? (hero ? HERO_TOP : 120),
        focusMemory.offset(locationKey, PAGE_AREA),
        hero ? SCREEN_HEIGHT - HERO_HEIGHT : SCREEN_HEIGHT,
        hero,
      ),
  )
  const [context] = useState<PageContextValue>(() => ({ page: vm, locationKey, hero }))

  useEffect(() => {
    // Place initial focus only once: a filter change makes the screen not ready again, but the user already has focus.
    if (!ready || vm.initialFocusPlaced) return

    const remembered = focusMemory.restore(locationKey)
    const timer = window.setTimeout(() => {
      const target = [remembered, initialFocusKey].find((key) => key && doesFocusableExist(key))

      setFocus(target ?? focusKey)
      vm.markInitialFocusPlaced()
    }, FOCUS_DELAY_MS)

    return () => clearTimeout(timer)
    // Re-run only when the screen becomes ready, not on every initialFocusKey change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, locationKey])

  useEffect(() => {
    ui.setPageFocusKey(focusKey)
    ui.clearFocusedItem()
  }, [ui, focusKey])

  useEffect(
    () => () => {
      const current = getCurrentFocusKey()

      if (current) focusMemory.save(locationKey, current)

      focusMemory.saveOffset(locationKey, PAGE_AREA, vm.offset)
    },
    [focusMemory, locationKey, vm],
  )

  return (
    <PageContext.Provider value={context}>
      {/* Vertical focus boundary: otherwise focus escaped from the top edge into the rail. */}
      <FocusGroup
        focusKey={focusKey}
        isFocusBoundary
        focusBoundaryDirections={VERTICAL}
        className={cx(styles.page, hero && styles.pageWithHero, className)}
      >
        {hero && <PageHero title={title} />}
        <div className={styles.pageViewport}>
          <div className={cx(styles.pageScroll, vm.gliding && styles.isGliding)} style={{ transform: `translateY(-${vm.offset}px)` }}>
            <div className={styles.pageStack} ref={vm.setStack}>
              {children}
            </div>
          </div>
        </div>
      </FocusGroup>
    </PageContext.Provider>
  )
})

export { usePage, useReveal } from '@/shared/ui/page-context'
