import { describe, expect, it, vi } from 'vitest'
import type { BookmarkFolder } from '@/services/api/api.types'
import { fakeServices } from '@/test/fake-services'
import { BookmarksScreenViewModel } from './bookmarks-screen.view-model'

const folder = (id: number, title: string): BookmarkFolder => ({ id, title, views: 0, count: 2, created: 0, updated: 0 })

describe('BookmarksScreenViewModel', () => {
  it('loads the folders and opens one with its title in the navigation state', async () => {
    const services = fakeServices()
    const navigate = vi.spyOn(services.router, 'navigate')

    services.api.bookmarkFolders.mockResolvedValue([folder(1, 'Избранное'), folder(2, 'Позже')])
    const vm = new BookmarksScreenViewModel(services)

    await vi.waitFor(() => expect(vm.folders.data).toHaveLength(2))
    expect(services.api.bookmarkFolders).toHaveBeenCalledWith(expect.any(AbortSignal))

    vm.open(vm.folders.data![1])
    expect(navigate).toHaveBeenCalledWith('/bookmarks/2', { state: { title: 'Позже' } })
    vm.dispose()
  })

  it('always refetches on mount since the folders are stale immediately', async () => {
    const services = fakeServices()

    services.api.bookmarkFolders.mockResolvedValue([folder(1, 'A')])
    const first = new BookmarksScreenViewModel(services)

    await vi.waitFor(() => expect(first.folders.data).toHaveLength(1))
    first.dispose()

    const second = new BookmarksScreenViewModel(services)

    await vi.waitFor(() => expect(services.api.bookmarkFolders).toHaveBeenCalledTimes(2))
    second.dispose()
  })
})
