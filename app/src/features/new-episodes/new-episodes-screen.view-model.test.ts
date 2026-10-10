import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/services/api/api.service'
import type { ItemShort } from '@/services/api/api.types'
import type { Services } from '@/services/services'
import { fakeServices, type FakeServices } from '@/test/fake-services'
import { NewEpisodesScreenViewModel } from './new-episodes-screen.view-model'

/** FakeServices is not assignable to Services (see src/test/fake-services.ts); view-models only use what the fake provides. */
const svc = (s: FakeServices) => s as unknown as Services

const item = (id: number, fresh?: number): ItemShort => ({
  id,
  type: 'serial',
  subtype: '',
  title: `Item ${id}`,
  year: 2024,
  posters: { small: '', medium: '', big: '' },
  new: fresh,
})

describe('NewEpisodesScreenViewModel', () => {
  it('keeps only subscribed serials with unwatched episodes', async () => {
    const services = fakeServices()

    services.api.watchingSerials.mockResolvedValue([item(1, 2), item(2, 0), item(3), item(4, 1)])
    const vm = new NewEpisodesScreenViewModel(svc(services))

    expect(vm.isEmpty).toBe(false)
    await vi.waitFor(() => expect(vm.list.map((i) => i.id)).toEqual([1, 4]))
    expect(services.api.watchingSerials).toHaveBeenCalledWith(1, expect.any(AbortSignal))
    expect(vm.isEmpty).toBe(false)

    services.api.watchingSerials.mockResolvedValue([item(2, 0)])
    vm.retry()
    await vi.waitFor(() => expect(vm.isEmpty).toBe(true))
    vm.dispose()
  })

  it('exposes the error and builds subtitles with the right plural', async () => {
    const services = fakeServices()

    services.api.watchingSerials.mockRejectedValue(new ApiError(500, 'Сбой'))
    const vm = new NewEpisodesScreenViewModel(svc(services))

    await vi.waitFor(() => expect(vm.error).toBe('Сбой'))
    vm.dispose()

    expect(NewEpisodesScreenViewModel.subtitle(item(1, 1))).toBe('1 новая серия')
    expect(NewEpisodesScreenViewModel.subtitle(item(1, 4))).toBe('4 новые серии')
    expect(NewEpisodesScreenViewModel.subtitle(item(1, 5))).toBe('5 новых серий')
    expect(NewEpisodesScreenViewModel.subtitle(item(1))).toBe('0 новых серий')
  })
})
