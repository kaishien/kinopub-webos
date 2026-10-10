import { setFocus } from '@noriginmedia/norigin-spatial-navigation'
import { observer } from 'mobx-react-lite'
import type { ReactNode } from 'react'
import { useServices } from '@/services/services'
import { FocusGroup, Pressable, type FocusLayout } from '@/shared/ui/focus'
import { cx } from '@/shared/lib/cx'
import {
  Icon3d,
  IconAnime,
  IconBall,
  IconBell,
  IconBookmark,
  IconDoc,
  IconDocs,
  IconEye,
  IconFilm,
  IconHistory,
  IconHome,
  IconMusic,
  IconNew,
  IconSearch,
  IconSeries,
  IconSettings,
  IconShow,
  IconStack,
  IconTv,
  IconUhd,
} from '@/shared/ui/icons'
import { link } from '@/app/routes'
import styles from './rail.module.css'

interface RailItem {
  id: string
  to: string
  label: string
  icon: ReactNode
  match: string
}

interface RailSection {
  title?: string
  items: RailItem[]
}

const catalog = (id: string, label: string, icon: ReactNode): RailItem => ({
  id,
  label,
  icon,
  to: link.catalog(id),
  match: `/catalog/${id}`,
})

const SECTIONS: RailSection[] = [
  {
    items: [
      { id: 'search', to: link.search(), label: 'Поиск', icon: <IconSearch />, match: '/search' },
      { id: 'home', to: link.home(), label: 'Главная', icon: <IconHome />, match: '/' },
    ],
  },
  {
    title: 'Библиотека',
    items: [
      catalog('fresh', 'Новинки', <IconNew />),
      catalog('movie', 'Фильмы', <IconFilm />),
      catalog('serial', 'Сериалы', <IconSeries />),
      catalog('anime', 'Аниме', <IconAnime />),
      catalog('concert', 'Концерты', <IconMusic />),
      catalog('documovie', 'Докуфильмы', <IconDoc />),
      catalog('docuserial', 'Докусериалы', <IconDocs />),
      catalog('tvshow', 'ТВ-шоу', <IconShow />),
      catalog('sport', 'Спорт', <IconBall />),
      catalog('4k', '4K', <IconUhd />),
      catalog('3d', '3D', <Icon3d />),
    ],
  },
  {
    title: 'Моё',
    items: [
      { id: 'watching', to: link.watching(), label: 'Я смотрю', icon: <IconEye />, match: '/watching' },
      { id: 'new-episodes', to: link.newEpisodes(), label: 'Новые эпизоды', icon: <IconBell />, match: '/new-episodes' },
      { id: 'bookmarks', to: link.bookmarks(), label: 'Закладки', icon: <IconBookmark />, match: '/bookmarks' },
      { id: 'history', to: link.history(), label: 'История', icon: <IconHistory />, match: '/history' },
      { id: 'collections', to: link.collections(), label: 'Подборки', icon: <IconStack />, match: '/collections' },
      { id: 'channels', to: link.channels(), label: 'Каналы', icon: <IconTv />, match: '/channels' },
    ],
  },
  {
    items: [{ id: 'settings', to: link.settings(), label: 'Настройки', icon: <IconSettings />, match: '/settings' }],
  },
]

export const RAIL_FOCUS_KEY = 'RAIL'

function reveal({ node }: FocusLayout) {
  node?.scrollIntoView({ block: 'nearest' })
}

export const Rail = observer(function Rail() {
  const { router, ui } = useServices()
  const pathname = router.pathname
  // Content starts under the expanded rail, so geometric navigation can't reach it: move focus explicitly.
  const leaveToContent = (direction: string) => {
    if (direction !== 'right') return true
    if (ui.pageFocusKey) setFocus(ui.pageFocusKey)

    return false
  }

  return (
    <FocusGroup focusKey={RAIL_FOCUS_KEY} className={styles.rail} preferredChildFocusKey="RAIL-home">
      <div className={styles.railLogo}>К</div>
      <nav className={styles.railItems}>
        {SECTIONS.map((section, index) => (
          <div key={section.title ?? index} className={styles.railSection}>
            {section.title && <div className={styles.railSectionTitle}>{section.title}</div>}
            {section.items.map((item) => (
              <Pressable
                key={item.id}
                focusKey={`RAIL-${item.id}`}
                className={cx(styles.railItem, isActive(pathname, item.match) && styles.isActive)}
                onPress={() => router.reset(item.to)}
                onArrow={leaveToContent}
                onFocus={reveal}
              >
                <span className={styles.railIcon}>{item.icon}</span>
                <span className={styles.railLabel}>{item.label}</span>
              </Pressable>
            ))}
          </div>
        ))}
      </nav>
    </FocusGroup>
  )
})

function isActive(pathname: string, match: string) {
  return match === '/' ? pathname === '/' : pathname.startsWith(match)
}
