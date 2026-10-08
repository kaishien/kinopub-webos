import { observer } from 'mobx-react-lite'
import { useServices } from '@/services/services'
import { HeroItem } from './hero-item'
import styles from './page-hero.module.css'

/** One text block instead of per-card captions: only it re-renders while scrolling. */
export const PageHero = observer(function PageHero({ title }: { title?: string }) {
  const { ui } = useServices()
  const focused = ui.focused

  return (
    <div className={styles.pageHero}>
      {focused ? <HeroItem item={focused.item} note={focused.note} /> : title && <h1 className={styles.pageHeroTitle}>{title}</h1>}
    </div>
  )
})
