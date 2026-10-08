import { createMemoryRouter, type RouteObject } from 'react-router'
import { BookmarksScreen } from '@/features/bookmarks/bookmarks-screen'
import { BookmarkFolderScreen } from '@/features/bookmarks/folder/bookmark-folder-screen'
import { CatalogScreen } from '@/features/catalog/catalog-screen'
import { ChannelPlayerScreen } from '@/features/channels/player/channel-player-screen'
import { ChannelsScreen } from '@/features/channels/channels-screen'
import { CollectionScreen } from '@/features/collections/collection/collection-screen'
import { CollectionsScreen } from '@/features/collections/collections-screen'
import { HistoryScreen } from '@/features/history/history-screen'
import { HomeScreen } from '@/features/home/home-screen'
import { ItemScreen } from '@/features/item/item-screen'
import { PersonScreen } from '@/features/person/person-screen'
import { PlayerScreen } from '@/features/player/player-screen'
import { SearchScreen } from '@/features/search/search-screen'
import { SettingsScreen } from '@/features/settings/settings-screen'
import { NewEpisodesScreen } from '@/features/new-episodes/new-episodes-screen'
import { WatchingScreen } from '@/features/watching/watching-screen'
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
