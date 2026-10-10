import { describe, expect, it } from 'vitest'
import type { Video } from '@/services/api/api.types'
import type { EpisodeSeason } from '@/features/player/player-screen.view-model'
import { EpisodesPanelViewModel } from './episodes-panel.view-model'

function video(id: number, watched = 0): Video {
  return {
    id,
    number: id % 100,
    snumber: Math.floor(id / 100),
    thumbnail: '',
    title: `Episode ${id}`,
    tracks: 1,
    duration: 1200,
    ac3: 0,
    audios: [],
    subtitles: [],
    files: [],
    watched,
    watching: { status: watched === 1 ? 1 : 0, time: 0 },
  }
}

const seasons: EpisodeSeason[] = [
  { number: 1, videos: [video(101, 1), video(102, 1), video(103, 1)] },
  { number: 2, videos: [video(201, 1), video(202), video(203)] },
  { number: 3, videos: [video(301), video(302)] },
]

describe('EpisodesPanelViewModel', () => {
  it('opens on the season of the playing episode', () => {
    const vm = new EpisodesPanelViewModel(seasons, 202)

    expect(vm.seasonIndex).toBe(1)
    expect(vm.season?.number).toBe(2)
    expect(vm.videos.map((v) => v.id)).toEqual([201, 202, 203])
  })

  it('falls back to the first season when the playing episode is unknown', () => {
    expect(new EpisodesPanelViewModel(seasons, 999).seasonIndex).toBe(0)
    expect(new EpisodesPanelViewModel(seasons, undefined).seasonIndex).toBe(0)
  })

  it('prefers the playing episode in its own season', () => {
    const vm = new EpisodesPanelViewModel(seasons, 203)

    expect(vm.preferredIndex).toBe(2)
  })

  it('prefers the first unwatched episode in another season', () => {
    const vm = new EpisodesPanelViewModel(seasons, 101)

    vm.selectSeason(1)

    expect(vm.season?.number).toBe(2)
    expect(vm.preferredIndex).toBe(1)
  })

  it('prefers the first episode when the whole season is watched', () => {
    const vm = new EpisodesPanelViewModel(seasons, 202)

    vm.selectSeason(0)

    expect(vm.preferredIndex).toBe(0)
  })

  it('switching seasons changes the listed episodes', () => {
    const vm = new EpisodesPanelViewModel(seasons, 101)

    vm.selectSeason(2)

    expect(vm.videos.map((v) => v.id)).toEqual([301, 302])
  })

  it('has no season or videos for an empty list', () => {
    const vm = new EpisodesPanelViewModel([], 1)

    expect(vm.season).toBeUndefined()
    expect(vm.videos).toEqual([])
    expect(vm.preferredIndex).toBe(0)
  })
})
