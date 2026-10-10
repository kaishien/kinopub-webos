import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ItemShort } from '@/services/api/api.types'
import { fakeServices, type FakeServices } from '@/test/fake-services'
import { TrailerPreviewViewModel } from './trailer-preview.view-model'

const DWELL_MS = 1500
const card: ItemShort = { id: 1, type: 'movie', subtype: '', title: 'Card', year: 2020, posters: { small: '', medium: '', big: '' } }

describe('TrailerPreviewViewModel', () => {
  let services: FakeServices

  beforeEach(() => {
    vi.useFakeTimers()
    services = fakeServices()
  })

  it('starts the trailer only after the page settles', () => {
    const vm = new TrailerPreviewViewModel(services)

    services.ui.setTrailer('https://cdn/trailer.mp4')
    vi.advanceTimersByTime(DWELL_MS - 1)
    expect(vm.src).toBe('')
    vi.advanceTimersByTime(1)
    expect(vm.src).toBe('https://cdn/trailer.mp4')
    expect(vm.playing).toBe(false)
    vm.onPlaying()
    expect(vm.playing).toBe(true)
    vm.dispose()
  })

  it('does not start when a quick Back clears the trailer within the dwell', () => {
    const vm = new TrailerPreviewViewModel(services)

    services.ui.setTrailer('https://cdn/trailer.mp4')
    vi.advanceTimersByTime(1000)
    services.ui.clearTrailer()
    vi.advanceTimersByTime(DWELL_MS)
    expect(vm.src).toBe('')
    vm.dispose()
  })

  it('stops while a card has focus and resumes once focus leaves', () => {
    const vm = new TrailerPreviewViewModel(services)

    services.ui.setTrailer('https://cdn/trailer.mp4')
    vi.advanceTimersByTime(DWELL_MS)
    vm.onPlaying()
    expect(vm.src).toBe('https://cdn/trailer.mp4')

    services.ui.focusItem(card)
    expect(vm.src).toBe('')
    expect(vm.playing).toBe(false)

    services.ui.clearFocusedItem()
    expect(vm.src).toBe('')
    vi.advanceTimersByTime(DWELL_MS)
    expect(vm.src).toBe('https://cdn/trailer.mp4')
    vm.dispose()
  })

  it('respects the trailerPreview setting', () => {
    services.settings.set('trailerPreview', false)
    const vm = new TrailerPreviewViewModel(services)

    services.ui.setTrailer('https://cdn/trailer.mp4')
    vi.advanceTimersByTime(DWELL_MS)
    expect(vm.src).toBe('')

    services.settings.set('trailerPreview', true)
    vi.advanceTimersByTime(DWELL_MS)
    expect(vm.src).toBe('https://cdn/trailer.mp4')

    services.settings.set('trailerPreview', false)
    expect(vm.src).toBe('')
    vm.dispose()
  })

  it('clear() resets playback and dispose stops reacting', () => {
    const vm = new TrailerPreviewViewModel(services)

    services.ui.setTrailer('https://cdn/trailer.mp4')
    vi.advanceTimersByTime(DWELL_MS)
    vm.onPlaying()
    vm.clear()
    expect(vm.src).toBe('')
    expect(vm.playing).toBe(false)

    vm.dispose()
    services.ui.setTrailer('https://cdn/other.mp4')
    vi.advanceTimersByTime(DWELL_MS)
    expect(vm.src).toBe('')
  })
})
