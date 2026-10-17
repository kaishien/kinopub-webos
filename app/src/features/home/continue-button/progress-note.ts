import type { LocalHistoryEntry } from '@/services/local-history/local-history.service'
import { formatClock } from '@/shared/lib/format'

/** The hero note under the title: episode, where it stopped and how long it is. */
export function progressNote(last: Pick<LocalHistoryEntry, 'time' | 'duration'>, episode: string): string {
  const where = last.time > 0 ? `${formatClock(last.time)} из ${formatClock(last.duration)}` : 'с начала'

  return episode ? `${episode} · ${where}` : where
}
