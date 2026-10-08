import { makeAutoObservable } from 'mobx'
import { InfiniteQuery, Query } from 'mobx-tanstack-query'
import type { Genre, ItemShort, ItemsPage } from '@/services/api/api.types'
import type { Services } from '@/services/services'
import { Scope } from '@/shared/view-model/use-view-model'
import { FRESH_TYPES, findSection, type CatalogSection } from './sections'

export interface SortOption {
  id: string
  title: string
}

export const SORT_OPTIONS: SortOption[] = [
  { id: 'updated-', title: 'По обновлению' },
  { id: 'created-', title: 'Новые' },
  { id: 'views-', title: 'Популярные' },
  { id: 'rating-', title: 'По рейтингу' },
  { id: 'year-', title: 'По году' },
]

export type CatalogSheet = 'sort' | 'genre' | null

export class CatalogScreenViewModel {
  private readonly scope = new Scope()
  readonly section: CatalogSection
  sort: string
  genre: number | undefined
  freshType: string
  sheet: CatalogSheet = null
  readonly genres: Query<Genre[]>
  readonly items: InfiniteQuery<ItemsPage, Error, number>

  constructor(
    services: Services,
    readonly sectionId: string,
    initial: { sort?: string; genre?: number },
  ) {
    const { api, queryClient } = services

    this.section = findSection(sectionId)
    this.sort = initial.sort ?? 'updated-'
    this.genre = initial.genre
    this.freshType = FRESH_TYPES[0].id
    makeAutoObservable<this, 'scope'>(
      this,
      { scope: false, section: false, sectionId: false, genres: false, items: false },
      { autoBind: true },
    )

    const { type, genre, fresh, quality } = this.section

    this.genres = new Query<Genre[]>({
      queryClient,
      abortSignal: this.scope.signal,
      queryKey: ['genres', type ?? ''],
      queryFn: ({ signal }) => api.genres(type === '3d' ? undefined : type, signal),
      staleTime: Infinity,
      enabled: !genre && !fresh,
    })

    this.items = new InfiniteQuery<ItemsPage, Error, number>(queryClient, () => ({
      abortSignal: this.scope.signal,
      queryKey: fresh ? ['fresh', this.freshType] : ['catalog', sectionId, this.sort, this.genre ?? 0],
      queryFn: ({ signal, pageParam }) =>
        fresh
          ? api.fresh(this.freshType, pageParam, signal)
          : api.items({ type, quality, sort: this.sort, genre: genre ?? this.genre, page: pageParam }, signal),
      initialPageParam: 1,
      getNextPageParam: (last) => (last.pagination && last.pagination.current < last.pagination.total ? last.pagination.current + 1 : null),
    }))
  }

  get title() {
    return this.section.title
  }

  get hasSort() {
    return !this.section.fresh
  }

  get hasGenres() {
    return !this.section.fresh && !this.section.genre && (this.genres.data?.length ?? 0) > 0
  }

  get list(): ItemShort[] {
    return this.items.data?.pages.flatMap((p) => p.items) ?? []
  }

  get error() {
    return this.items.error?.message ?? null
  }

  get sortTitle() {
    return SORT_OPTIONS.find((option) => option.id === this.sort)?.title ?? SORT_OPTIONS[0].title
  }

  get genreTitle() {
    return this.genres.data?.find((genre) => genre.id === this.genre)?.title ?? 'Все'
  }

  openSheet(sheet: Exclude<CatalogSheet, null>) {
    this.sheet = sheet
  }

  closeSheet() {
    this.sheet = null
  }

  setSort(sort: string) {
    this.sort = sort
    this.closeSheet()
  }

  setGenre(genre: number | undefined) {
    this.genre = genre
    this.closeSheet()
  }

  setFreshType(type: string) {
    this.freshType = type
  }

  loadMore() {
    if (this.items.hasNextPage && !this.items.isFetchingNextPage) void this.items.fetchNextPage()
  }

  dispose() {
    this.scope.dispose()
  }
}
