import { observer } from 'mobx-react-lite'
import { useLocation, useParams } from 'react-router'
import type { ItemShort } from '@/services/api/api.types'
import { qualityBadge } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button/button'
import { FocusGroup } from '@/shared/ui/focus/focus-group'
import { IconBookmark, IconBookmarkFilled, IconCheck, IconEye, IconFilm, IconPlay } from '@/shared/ui/icons/icons'
import { ItemsRow } from '@/shared/ui/items-row/items-row'
import { Page } from '@/shared/ui/page/page'
import { Plot } from '@/shared/ui/plot/plot'
import { Status } from '@/shared/ui/status/status'
import { useViewModel } from '@/shared/view-model/use-view-model'
import { BookmarksSheet } from './bookmarks-sheet/bookmarks-sheet'
import { EpisodesRow } from './episodes/episodes-row'
import { ItemScreenViewModel } from './item-screen.view-model'
import { People } from './people/people'
import { Rating } from './rating/rating'
import styles from './item-screen.module.css'
import { Badge } from '@/shared/ui/badge/badge'

/** «Similar» navigates item to item on the same route: keying by history entry recreates the screen and its view-model. */
export function ItemScreen() {
  const location = useLocation()

  return <ItemContent key={location.key} />
}

const ItemContent = observer(function ItemContent() {
  const { id = '0' } = useParams()
  const location = useLocation()
  const preview = (location.state as { preview?: ItemShort } | null)?.preview
  const vm = useViewModel((services) => new ItemScreenViewModel(services, Number(id), preview))
  const item = vm.data

  if (!item && vm.item.error) {
    return (
      <Page focusKey="PAGE-item" initialFocusKey="ITEM-retry">
        <Status error={vm.item.error.message} onRetry={() => vm.item.refetch()} retryFocusKey="ITEM-retry" />
      </Page>
    )
  }

  return (
    <Page focusKey="PAGE-item" className={styles.item} top={60} initialFocusKey="ITEM-play" ready={!!item}>
      <header className={styles.itemHead}>
        <h1 className={styles.itemTitle}>{vm.title.ru}</h1>
        {vm.title.original && <div className={styles.itemTitleOriginal}>{vm.title.original}</div>}
        {item && (
          <div className={styles.itemMeta}>
            {item.year > 0 && <b>{item.year}</b>}
            {item.kinopoisk_rating ? <Rating value={item.kinopoisk_rating} source="КП" /> : null}
            {item.imdb_rating ? <Rating value={item.imdb_rating} source="IMDb" /> : null}
            {qualityBadge(item.quality) && <Badge>{qualityBadge(item.quality)}</Badge>}
            {vm.metaLine.map((part) => (
              <span key={part}>{part}</span>
            ))}
          </div>
        )}
        {item?.plot && <Plot key={item.id} text={item.plot} title={vm.title.ru} focusKey="ITEM-plot" />}
      </header>

      <FocusGroup reveal focusKey="ITEM-actions" className={styles.itemActions}>
        {vm.next && (
          <Button primary focusKey="ITEM-play" icon={<IconPlay />} onPress={() => vm.play(vm.next!)}>
            {vm.playLabel}
          </Button>
        )}
        {vm.next && vm.next.resumeFrom > 0 && !vm.isSerial && (
          <Button icon={<IconPlay />} onPress={() => vm.play(vm.next!, true)}>
            С начала
          </Button>
        )}
        {item?.trailer?.url && (
          <Button icon={<IconFilm />} onPress={vm.playTrailer}>
            Трейлер
          </Button>
        )}
        <Button icon={vm.inFolders.length ? <IconBookmarkFilled /> : <IconBookmark />} onPress={vm.openBookmarks}>
          В закладки
        </Button>
        {vm.isSerial && (
          <Button icon={<IconEye />} active={!!item?.in_watchlist} onPress={() => vm.toggleWatchlist.mutate()}>
            {item?.in_watchlist ? 'Я смотрю' : 'Буду смотреть'}
          </Button>
        )}
        {!vm.isSerial && item?.videos?.length ? (
          <Button icon={<IconCheck />} active={vm.movieWatched} onPress={vm.markMovieWatched}>
            {vm.movieWatched ? 'Просмотрено' : 'Отметить просмотренным'}
          </Button>
        ) : null}
      </FocusGroup>

      {vm.isSerial && (
        <FocusGroup reveal focusKey="ITEM-seasons" className={styles.itemSeasons}>
          {vm.seasons.map((season, index) => (
            <Button
              key={season.id}
              size="sm"
              active={index === vm.seasonIndex}
              onPress={() => vm.selectSeason(index)}
              onFocus={() => vm.selectSeason(index)}
            >
              {season.title || `Сезон ${season.number}`}
            </Button>
          ))}
        </FocusGroup>
      )}
      {vm.episodes && (
        <EpisodesRow key={vm.episodes.season} videos={vm.episodes.videos} season={vm.episodes.season} onPlay={vm.playEpisode} />
      )}

      {(vm.similar.data?.length ?? 0) > 0 && (
        // Keyed by item: with one key per screen, navigation unmounts the focused card and norigin restores focus
        // onto the same-named card of the next screen's row, which then sets the backdrop to the wrong film.
        <ItemsRow title="Похожее" items={vm.similar.data!} focusKey={`ROW-similar-${vm.id}`} />
      )}
      {vm.people.length > 0 && <People people={vm.people} />}
      <div className={styles.itemBottomSpace} />

      {vm.bookmarksOpen && <BookmarksSheet vm={vm} />}
    </Page>
  )
})
