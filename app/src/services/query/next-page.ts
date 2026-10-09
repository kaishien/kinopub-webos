import type { Pagination } from '@/services/api/api.types'

/** `getNextPageParam` for every paginated Kinopub endpoint: pages are 1-based and `pagination` may be absent. */
export function nextPage(last: { pagination?: Pagination }): number | null {
  const { pagination } = last

  return pagination && pagination.current < pagination.total ? pagination.current + 1 : null
}
