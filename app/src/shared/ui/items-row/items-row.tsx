import { memo, useCallback } from 'react'
import type { ItemShort } from '@/services/api/api.types'
import { useServices } from '@/services/services'
import { link } from '@/app/routes'
import { widePosterUrl } from '@/shared/lib/format'
import { Card } from '@/shared/ui/card/card'
import { POSTER, POSTER_BARE } from '@/shared/ui/card/card-metrics'
import { MoreCard } from '@/shared/ui/card/more-card/more-card'
import { usePage } from '@/shared/ui/page/page'
import { Row, useRowItemFocus } from '@/shared/ui/row/row'

export interface ItemsRowProps {
  title: string
  items: ItemShort[]
  focusKey: string
  moreLink?: string
  progressOf?: (item: ItemShort) => number | undefined
  subtitleOf?: (item: ItemShort) => string | undefined
}

export const ItemsRow = memo(function ItemsRow({ title, items, focusKey, moreLink, progressOf, subtitleOf }: ItemsRowProps) {
  const { hero } = usePage()
  const count = items.length + (moreLink ? 1 : 0)
  const renderItem = useCallback(
    (index: number, cellFocusKey: string) => {
      const item = items[index]

      if (!item) return <RowMoreCard index={index} to={moreLink!} focusKey={cellFocusKey} />

      return (
        <RowCard
          index={index}
          item={item}
          focusKey={cellFocusKey}
          caption={!hero}
          progress={progressOf?.(item)}
          subtitle={subtitleOf?.(item)}
        />
      )
    },
    [items, moreLink, hero, progressOf, subtitleOf],
  )
  const imageOf = useCallback((index: number) => items[index]?.posters.medium, [items])

  return (
    <Row title={title} focusKey={focusKey} count={count} item={hero ? POSTER_BARE : POSTER} renderItem={renderItem} imageOf={imageOf} />
  )
})

const RowCard = memo(function RowCard({
  index,
  item,
  focusKey,
  caption,
  progress,
  subtitle,
}: {
  index: number
  item: ItemShort
  focusKey: string
  caption: boolean
  progress?: number
  subtitle?: string
}) {
  const { router, ui } = useServices()
  const notify = useRowItemFocus()

  return (
    <Card
      item={item}
      focusKey={focusKey}
      caption={caption}
      progress={progress}
      subtitle={subtitle}
      onPress={(it) => router.navigate(link.item(it.id), { state: { preview: it } })}
      onFocus={(it) => {
        notify(index)
        ui.focusItem(it, subtitle)
        ui.setBackdrop(widePosterUrl(it.id, it.posters))
      }}
      onBlur={ui.blurItem}
    />
  )
})

function RowMoreCard({ index, to, focusKey }: { index: number; to: string; focusKey: string }) {
  const { router } = useServices()
  const notify = useRowItemFocus()

  return <MoreCard focusKey={focusKey} onPress={() => router.navigate(to)} onFocus={() => notify(index)} />
}
