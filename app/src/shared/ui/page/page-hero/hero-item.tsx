import type { ItemShort } from '@/services/api/api.types'
import { formatRating, qualityBadge, splitTitle } from '@/shared/lib/format'
import { IconStar } from '@/shared/ui/icons/icons'
import { Badge } from '@/shared/ui/badge/badge'
import styles from './page-hero.module.css'

export function HeroItem({ item, note }: { item: ItemShort; note?: string }) {
  const { ru, original } = splitTitle(item.title)
  const isCollection = item.type === 'collection'
  const quality = qualityBadge(item.quality)
  const kp = formatRating(item.kinopoisk_rating)
  const imdb = formatRating(item.imdb_rating)
  const genres = item.genres
    ?.slice(0, 3)
    .map((genre) => genre.title)
    .join(', ')

  return (
    <>
      <h1 className={styles.pageHeroTitle}>{ru}</h1>
      {original && <div className={styles.pageHeroOriginal}>{original}</div>}
      <div className={styles.pageHeroMeta}>
        {note && <span className={styles.pageHeroNote}>{note}</span>}
        {!isCollection && item.year > 0 && <span>{item.year}</span>}
        {kp && (
          <span className={styles.pageHeroRating}>
            <IconStar /> {kp} КП
          </span>
        )}
        {imdb && (
          <span className={styles.pageHeroRating}>
            <IconStar /> {imdb} IMDb
          </span>
        )}
        {quality && <Badge>{quality}</Badge>}
        {genres && <span className={styles.pageHeroGenres}>{genres}</span>}
      </div>
      {item.plot && <p className={styles.pageHeroPlot}>{item.plot}</p>}
    </>
  )
}
