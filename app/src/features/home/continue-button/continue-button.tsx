import type { LocalHistoryEntry } from '@/services/local-history/local-history.service'
import { useServices } from '@/services/services'
import { episodeLabel, splitTitle, widePosterUrl } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { IconPlay } from '@/shared/ui/icons'
import { useReveal } from '@/shared/ui/page'
import styles from './continue-button.module.css'
import { progressNote } from './progress-note'

interface ContinueButtonProps {
  last: LocalHistoryEntry
  focusKey: string
  onPress: () => void
}

/** Resumes what this TV played last; focused, it fills the hero like a card would. */
export function ContinueButton({ last, focusKey, onPress }: ContinueButtonProps) {
  const { ui } = useServices()
  const reveal = useReveal()
  const episode = last.season ? episodeLabel(last.season, last.episode) : ''

  return (
    <div className={styles.continue}>
      <Button
        primary
        focusKey={focusKey}
        icon={<IconPlay />}
        onPress={onPress}
        onFocus={({ node }) => {
          reveal(node)
          ui.focusItem(last.item, progressNote(last, episode))
          ui.setBackdrop(widePosterUrl(last.item.id, last.item.posters))
        }}
        onBlur={ui.blurItem}
      >
        {`Продолжить «${splitTitle(last.item.title).ru}»${episode ? ` · ${episode}` : ''}`}
      </Button>
    </div>
  )
}
