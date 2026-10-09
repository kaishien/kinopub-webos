import { makeAutoObservable } from 'mobx'
import { InfiniteQuery, Query } from 'mobx-tanstack-query'
import type { Country, Genre, ItemShort, ItemsPage } from '@/services/api/api.types'
import type { Services } from '@/services/services'
import { Scope } from '@/shared/view-model/use-view-model'
import { DEFAULT_SORT, FILTER_ANY, QUALITY_OPTIONS, SORT_OPTIONS, yearOptions, type FilterKind, type FilterOption } from './filters'
import { FRESH_TYPES, findSection, type CatalogSection } from './sections'

interface FilterValues {
  sort: string
  genre?: number
  quality?: number
  year?: string
  country?: number
}

type FilterValue = string | number | undefined

export class CatalogScreenViewModel {
  private readonly scope = new Scope()
  readonly section: CatalogSection
  filter: FilterValues
  /** Type tab in the «Новинки» section; other sections don't use it. */
  freshType: string
  sheet: FilterKind | null = null
  readonly genres: Query<Genre[]>
  readonly countries: Query<Country[]>
  readonly items: InfiniteQuery<ItemsPage, Error, number>
  private readonly years = yearOptions()
  private readonly remember: (key: string, value: unknown) => void

  constructor(
    services: Services,
    readonly sectionId: string,
    initial: { sort?: string; genre?: number },
    locationKey: string,
  ) {
    const { api, queryClient, focusMemory } = services

    this.section = findSection(sectionId)
    this.filter = focusMemory.state<FilterValues>(locationKey, 'filter') ?? { sort: initial.sort ?? DEFAULT_SORT, genre: initial.genre }
    this.freshType = focusMemory.state<string>(locationKey, 'freshType') ?? FRESH_TYPES[0].id
    this.remember = (key, value) => focusMemory.saveState(locationKey, key, value)
    makeAutoObservable<this, 'scope' | 'years' | 'remember'>(
      this,
      { scope: false, section: false, sectionId: false, genres: false, countries: false, items: false, years: false, remember: false },
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
    this.countries = new Query<Country[]>({
      queryClient,
      abortSignal: this.scope.signal,
      queryKey: ['countries'],
      queryFn: ({ signal }) => api.countries(signal),
      staleTime: Infinity,
      enabled: !fresh,
    })
    this.items = new InfiniteQuery<ItemsPage, Error, number>(queryClient, () => ({
      abortSignal: this.scope.signal,
      queryKey: fresh ? ['fresh', this.freshType] : ['catalog', sectionId, { ...this.filter }],
      queryFn: ({ signal, pageParam }) =>
        fresh
          ? api.fresh(this.freshType, pageParam, signal)
          : api.items(
              {
                type,
                sort: this.filter.sort,
                genre: genre ?? this.filter.genre,
                quality: quality ?? this.filter.quality,
                year: this.filter.year,
                country: this.filter.country,
                page: pageParam,
              },
              signal,
            ),
      initialPageParam: 1,
      getNextPageParam: (last) => (last.pagination && last.pagination.current < last.pagination.total ? last.pagination.current + 1 : null),
    }))
  }

  get title() {
    return this.section.title
  }

  /** Filters this section offers: a section fixed to a genre or quality doesn't offer that filter again. */
  get kinds(): FilterKind[] {
    if (this.section.fresh) return []

    const kinds: FilterKind[] = ['sort']

    if (!this.section.genre && (this.genres.data?.length ?? 0) > 0) kinds.push('genre')
    if (!this.section.quality) kinds.push('quality')

    kinds.push('year')
    if ((this.countries.data?.length ?? 0) > 0) kinds.push('country')

    return kinds
  }

  get list(): ItemShort[] {
    return this.items.data?.pages.flatMap((p) => p.items) ?? []
  }

  get error() {
    return this.items.error?.message ?? null
  }

  options(kind: FilterKind): FilterOption<FilterValue>[] {
    switch (kind) {
      case 'sort':
        return SORT_OPTIONS
      case 'genre':
        return [{ value: undefined, title: 'Все' }, ...(this.genres.data ?? []).map((genre) => ({ value: genre.id, title: genre.title }))]
      case 'quality':
        return QUALITY_OPTIONS
      case 'year':
        return this.years
      case 'country':
        return [
          { value: undefined, title: 'Все' },
          ...(this.countries.data ?? []).map((country) => ({ value: country.id, title: country.title })),
        ]
    }
  }

  valueFor(kind: FilterKind): FilterValue {
    return this.filter[kind]
  }

  isNarrowed(kind: FilterKind) {
    return kind !== 'sort' && this.filter[kind] !== undefined
  }

  activeIndex(kind: FilterKind) {
    const index = this.options(kind).findIndex((option) => option.value === this.filter[kind])

    return index < 0 ? 0 : index
  }

  titleOf(kind: FilterKind) {
    if (kind !== 'sort' && !this.isNarrowed(kind)) return FILTER_ANY[kind]

    return this.options(kind)[this.activeIndex(kind)]?.title ?? 'Все'
  }

  openSheet(kind: FilterKind) {
    this.sheet = kind
  }

  closeSheet() {
    this.sheet = null
  }

  select(kind: FilterKind, value: FilterValue) {
    this.filter = { ...this.filter, [kind]: value ?? (kind === 'sort' ? DEFAULT_SORT : undefined) }
    this.remember('filter', this.filter)
    this.closeSheet()
  }

  setFreshType(type: string) {
    this.freshType = type
    this.remember('freshType', type)
  }

  loadMore() {
    if (this.items.hasNextPage && !this.items.isFetchingNextPage) void this.items.fetchNextPage()
  }

  dispose() {
    this.scope.dispose()
  }
}
