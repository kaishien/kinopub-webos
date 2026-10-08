import type { StorageService } from '@/services/storage/storage.service'

/** `audio` is the track name without its number; `subtitle` null means the viewer turned subtitles off explicitly. */
export interface TrackChoice {
  audio?: string
  subtitle?: string | null
}

const STORAGE_KEY = 'tracks'
const LIMIT = 300

export class TrackMemoryService {
  private readonly choices: Map<number, TrackChoice>

  constructor(private readonly storage: StorageService) {
    this.choices = new Map(storage.get<Array<[number, TrackChoice]>>(STORAGE_KEY, []))
  }

  get(itemId: number): TrackChoice {
    return this.choices.get(itemId) ?? {}
  }

  rememberAudio(itemId: number, audio: string) {
    this.update(itemId, { audio })
  }

  rememberSubtitle(itemId: number, subtitle: string | null) {
    this.update(itemId, { subtitle })
  }

  private update(itemId: number, change: TrackChoice) {
    const next = { ...this.choices.get(itemId), ...change }

    this.choices.delete(itemId)
    this.choices.set(itemId, next)
    while (this.choices.size > LIMIT) this.choices.delete(this.choices.keys().next().value!)
    this.storage.set(STORAGE_KEY, [...this.choices])
  }
}
