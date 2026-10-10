import { makeAutoObservable, reaction } from 'mobx'
import type { Item } from '@/services/api/api.types'
import type { Services } from '@/services/services'
import { itemQueryKey } from '@/features/item/item-screen.view-model'

/** Longer than the backdrop dwell: a trailer is a request plus a decoder, so only a deliberate stop should start one. */
const DWELL_MS = 1800
/** The item (with its trailer link) stays fresh this long, so walking back over a row doesn't refetch. */
const ITEM_FRESH_MS = 5 * 60 * 1000

/** Netflix-style preview: after focus settles on a card, its trailer plays muted under the hero text, once. */
export class TrailerPreviewViewModel {
  src = ''
  /** Set once the video has frames, so the fade-in starts from a picture rather than black. */
  playing = false
  private wanted = 0
  private timer: number | null = null
  private readonly controller = new AbortController()
  private readonly stop: () => void

  constructor(private readonly services: Services) {
    makeAutoObservable<this, 'services' | 'wanted' | 'timer' | 'controller' | 'stop'>(
      this,
      { services: false, wanted: false, timer: false, controller: false, stop: false },
      { autoBind: true },
    )
    this.stop = reaction(
      () => (services.settings.values.trailerPreview ? (services.ui.focused?.item.id ?? 0) : 0),
      (id) => this.schedule(id),
    )
  }

  private schedule(id: number) {
    this.wanted = id
    if (this.timer) clearTimeout(this.timer)

    this.clear()
    if (!id) return

    this.timer = window.setTimeout(() => void this.load(id), DWELL_MS)
  }

  private async load(id: number) {
    const { api, queryClient } = this.services
    const item = await queryClient
      .fetchQuery<Item>({
        queryKey: itemQueryKey(id),
        queryFn: ({ signal }) => api.item(id, signal),
        staleTime: ITEM_FRESH_MS,
      })
      .catch(() => null)
    const url = item?.trailer?.url

    if (this.controller.signal.aborted || id !== this.wanted || !url) return

    this.src = url
  }

  onPlaying() {
    this.playing = true
  }

  /** Ended or failed: the still frame behind takes over again. */
  clear() {
    this.src = ''
    this.playing = false
  }

  dispose() {
    this.stop()
    this.controller.abort()
    if (this.timer) clearTimeout(this.timer)
  }
}
