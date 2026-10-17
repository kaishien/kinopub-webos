import { makeAutoObservable } from 'mobx'
import type { Item, ItemShort } from '@/services/api/api.types'
import type { StorageService } from '@/services/storage/storage.service'

/** One title this TV played: where it stopped, or that it was watched to the end. */
export interface LocalHistoryEntry {
  /** Enough of the item for the hero, the cards and the button, without its videos and seasons. */
  item: ItemShort
  videoId: number
  /** Season and episode number; season 0 for a movie's parts. */
  season: number
  episode: number
  episodeTitle: string
  time: number
  duration: number
  /** Watched to the end with nothing left to continue: stays in history, but the home button skips it. */
  finished: boolean
  updatedAt: number
}

export type LocalHistoryRecord = Omit<LocalHistoryEntry, 'updatedAt' | 'finished'> & { finished?: boolean }

const STORAGE_KEY = 'local-history'
const LIMIT = 20

/**
 * What this TV watched, newest first, one entry per title. Kept on the device: the account's history and
 * watching list mix in everyone who shares the account.
 */
export class LocalHistoryService {
  entries: LocalHistoryEntry[]

  constructor(private readonly storage: StorageService) {
    this.entries = storage.get<LocalHistoryEntry[]>(STORAGE_KEY, [])
    makeAutoObservable<this, 'storage'>(this, { storage: false }, { autoBind: true })
  }

  /** The newest title not yet watched to the end: what the home screen offers to continue. */
  get resumable(): LocalHistoryEntry | null {
    return this.entries.find((entry) => !entry.finished) ?? null
  }

  remember(record: LocalHistoryRecord) {
    const entry: LocalHistoryEntry = { finished: false, ...record, item: shortItem(record.item), updatedAt: Date.now() }

    this.entries = [entry, ...this.entries.filter((e) => e.item.id !== entry.item.id)].slice(0, LIMIT)
    this.storage.set(STORAGE_KEY, this.entries)
  }
}

function shortItem(item: ItemShort | Item): ItemShort {
  const { videos: _videos, seasons: _seasons, trailer: _trailer, ...short } = item as Item

  return short
}
