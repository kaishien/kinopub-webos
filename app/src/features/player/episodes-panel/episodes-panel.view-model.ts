import { makeAutoObservable } from 'mobx'
import type { Video } from '@/services/api/api.types'
import type { EpisodeSeason } from '../player-screen.view-model'

export class EpisodesPanelViewModel {
  seasonIndex: number

  constructor(
    readonly seasons: EpisodeSeason[],
    readonly currentId: number | undefined,
  ) {
    const playing = seasons.findIndex((season) => season.videos.some((video) => video.id === currentId))

    this.seasonIndex = Math.max(0, playing)
    makeAutoObservable(this, { seasons: false, currentId: false }, { autoBind: true })
  }

  get season(): EpisodeSeason | undefined {
    return this.seasons[this.seasonIndex]
  }

  get videos(): Video[] {
    return this.season?.videos ?? []
  }

  /** Where focus lands in the list: the playing episode, or the first unwatched one in another season. */
  get preferredIndex() {
    const playing = this.videos.findIndex((video) => video.id === this.currentId)

    if (playing >= 0) return playing

    return Math.max(
      0,
      this.videos.findIndex((video) => video.watched !== 1),
    )
  }

  selectSeason(index: number) {
    this.seasonIndex = index
  }
}
