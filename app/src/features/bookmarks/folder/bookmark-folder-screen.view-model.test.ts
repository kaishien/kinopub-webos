import { describe, expect, it, vi } from 'vitest'
import type { ItemShort } from '@/services/api/api.types'
import { fakeServices, flush } from '@/test/fake-services'
import { BookmarkFolderScreenViewModel } from './bookmark-folder-screen.view-model'

const item = (id: number): ItemShort => ({
  id,
  type: 'movie',
  subtype: '',
  title: `Item ${id}`,
  year: 2024,
  posters: { small: '', medium: '', big: '' },
})
const folder = { id: 3, title: 'Избранное', views: 0, count: 3, created: 0, updated: 0 }
const page = (ids: number[], current: number, total: number) => ({
  folder,
  items: ids.map(item),
  pagination: { current, total, perpage: ids.length, total_items: 0 },
})

describe('BookmarkFolderScreenViewModel', () => {
  it('takes the title from the first page and flattens items across pages', async () => {
    const services = fakeServices()

    services.api.bookmarkFolderItems.mockImplementation((_id: number, pageNo: number) =>
      Promise.resolve(pageNo === 2 ? page([3], 2, 2) : page([1, 2], 1, 2)),
    )
    const vm = new BookmarkFolderScreenViewModel(services, 3)

    expect(vm.title).toBeUndefined()
    await vi.waitFor(() => expect(vm.list).toHaveLength(2))
    expect(services.api.bookmarkFolderItems).toHaveBeenCalledWith(3, 1, expect.any(AbortSignal))
    expect(vm.title).toBe('Избранное')

    vm.loadMore()
    await vi.waitFor(() => expect(vm.list.map((i) => i.id)).toEqual([1, 2, 3]))
    vm.loadMore()
    await flush()
    expect(services.api.bookmarkFolderItems).toHaveBeenCalledTimes(2)
    vm.dispose()
  })
})
