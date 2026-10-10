import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/services/api/api.service'
import type { ItemShort } from '@/services/api/api.types'
import type { Services } from '@/services/services'
import { fakeServices, type FakeServices } from '@/test/fake-services'
import { WatchingScreenViewModel } from './watching-screen.view-model'

/** FakeServices is not assignable to Services (see src/test/fake-services.ts); view-models only use what the fake provides. */
const svc = (s: FakeServices) => s as unknown as Services

const item = (id: number, extra: Partial<ItemShort> = {}): ItemShort => ({
  id,
  type: 'serial',
  subtype: '',
  title: `Item ${id}`,
  year: 2024,
  posters: { small: '', medium: '', big: '' },
  ...extra,
})

describe('WatchingScreenViewModel', () => {
  it('loads serials and movies and is empty only when both come back empty', async () => {
    const services = fakeServices()

    services.api.watchingSerials.mockResolvedValue([])
    services.api.watchingMovies.mockResolvedValue([])
    const vm = new WatchingScreenViewModel(svc(services))

    expect(vm.isLoading).toBe(true)
    await vi.waitFor(() => expect(vm.isEmpty).toBe(true))
    expect(vm.isLoading).toBe(false)
    expect(services.api.watchingSerials).toHaveBeenCalledWith(0, expect.any(AbortSignal))
    expect(services.api.watchingMovies).toHaveBeenCalledWith(expect.any(AbortSignal))

    services.api.watchingMovies.mockResolvedValue([item(1, { type: 'movie' })])
    vm.retry()
    await vi.waitFor(() => expect(vm.movies.data).toHaveLength(1))
    expect(vm.isEmpty).toBe(false)
    expect(services.api.watchingSerials).toHaveBeenCalledTimes(2)
    vm.dispose()
  })

  it('reports the first error of either list', async () => {
    const services = fakeServices()

    services.api.watchingSerials.mockResolvedValue([])
    services.api.watchingMovies.mockRejectedValue(new ApiError(500, 'Ошибка фильмов'))
    const vm = new WatchingScreenViewModel(svc(services))

    await vi.waitFor(() => expect(vm.error).toBe('Ошибка фильмов'))
    expect(vm.isEmpty).toBe(false)
    vm.dispose()
  })

  it('derives progress and subtitles from the counters', () => {
    expect(WatchingScreenViewModel.progress(item(1, { total: 10, watched: 4 }))).toBe(0.4)
    expect(WatchingScreenViewModel.progress(item(1, { total: 10 }))).toBe(0)
    expect(WatchingScreenViewModel.progress(item(1))).toBeUndefined()

    expect(WatchingScreenViewModel.subtitle(item(1, { new: 1, total: 10, watched: 9 }))).toBe('1 новая серия')
    expect(WatchingScreenViewModel.subtitle(item(1, { new: 3 }))).toBe('3 новые серии')
    expect(WatchingScreenViewModel.subtitle(item(1, { new: 11 }))).toBe('11 новых серий')
    expect(WatchingScreenViewModel.subtitle(item(1, { total: 10, watched: 4 }))).toBe('4 из 10')
    expect(WatchingScreenViewModel.subtitle(item(1, { total: 10 }))).toBe('0 из 10')
    expect(WatchingScreenViewModel.subtitle(item(1))).toBeUndefined()
  })
})
