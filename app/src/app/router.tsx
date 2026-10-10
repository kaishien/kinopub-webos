import { createMemoryRouter, type RouteObject } from 'react-router'
import { BookmarkFolderScreen, BookmarksScreen } from '@/features/bookmarks'
import { CatalogScreen } from '@/features/catalog'
import { ChannelPlayerScreen, ChannelsScreen } from '@/features/channels'
import { CollectionScreen, CollectionsScreen } from '@/features/collections'
import { HistoryScreen } from '@/features/history'
import { HomeScreen } from '@/features/home'
import { ItemScreen } from '@/features/item'
import { PersonScreen } from '@/features/person'
import { PlayerScreen } from '@/features/player'
import { SearchScreen } from '@/features/search'
import { SettingsScreen } from '@/features/settings'
import { NewEpisodesScreen } from '@/features/new-episodes'
import { WatchingScreen } from '@/features/watching'
import { Layout } from './layout/layout'
import { routes } from './routes'

const routeObjects: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: HomeScreen },
      { path: routes.search, Component: SearchScreen },
      { path: routes.watching, Component: WatchingScreen },
      { path: routes.newEpisodes, Component: NewEpisodesScreen },
      { path: routes.catalog, Component: CatalogScreen },
      { path: routes.bookmarks, Component: BookmarksScreen },
      { path: routes.bookmarkFolder, Component: BookmarkFolderScreen },
      { path: routes.history, Component: HistoryScreen },
      { path: routes.collections, Component: CollectionsScreen },
      { path: routes.collection, Component: CollectionScreen },
      { path: routes.channels, Component: ChannelsScreen },
      { path: routes.channel, Component: ChannelPlayerScreen },
      { path: routes.settings, Component: SettingsScreen },
      { path: routes.item, Component: ItemScreen },
      { path: routes.player, Component: PlayerScreen },
      { path: routes.person, Component: PersonScreen },
    ],
  },
]

// Memory router: webOS runs the app from file:// and there is no address bar.
export function createAppRouter() {
  return createMemoryRouter(routeObjects, { initialEntries: [routes.home] })
}
