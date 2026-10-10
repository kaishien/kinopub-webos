import { describe, expect, it, vi } from 'vitest'
import type { BookmarkFolder } from '@/services/api/api.types'
import type { RouterService } from '@/services/router/router.service'
import type { Services } from '@/services/services'
import { fakeServices, type FakeServices } from '@/test/fake-services'
import { BookmarksScreenViewModel } from './bookmarks-screen.view-model'

/** FakeServices is not assignable to Services (see src/test/fake-services.ts); view-models only use what the fake provides. */
const svc = (s: FakeServices) => s as unknown as Services

/** RouterService methods are MobX-bound (non-configurable) so they cannot be spied; a class instance (not a plain object) survives makeAutoObservable untouched. */
class StubRouter {
  constructor(readonly navigate: ReturnType<typeof vi.fn>) {}
}

const folder = (id: number, title: string): BookmarkFolder => ({ id, title, views: 0, count: 2, created: 0, updated: 0 })

describe('BookmarksScreenViewModel', () => {
  it('loads the folders and opens one with its title in the navigation state', async () => {
    // RouterService.navigate is a MobX-bound action (non-configurable), so a stub replaces spying.
    const navigate = vi.fn()
    const services = fakeServices({ router: new StubRouter(navigate) as unknown as RouterService })

    services.api.bookmarkFolders.mockResolvedValue([folder(1, 'Избранное'), folder(2, 'Позже')])
    const vm = new BookmarksScreenViewModel(svc(services))

    await vi.waitFor(() => expect(vm.folders.data).toHaveLength(2))
    expect(services.api.bookmarkFolders).toHaveBeenCalledWith(expect.any(AbortSignal))

    vm.open(vm.folders.data![1])
    expect(navigate).toHaveBeenCalledWith('/bookmarks/2', { state: { title: 'Позже' } })
    vm.dispose()
  })

  it('always refetches on mount since the folders are stale immediately', async () => {
    const services = fakeServices()

    services.api.bookmarkFolders.mockResolvedValue([folder(1, 'A')])
    const first = new BookmarksScreenViewModel(svc(services))

    await vi.waitFor(() => expect(first.folders.data).toHaveLength(1))
    first.dispose()

    const second = new BookmarksScreenViewModel(svc(services))

    await vi.waitFor(() => expect(services.api.bookmarkFolders).toHaveBeenCalledTimes(2))
    second.dispose()
  })
})
