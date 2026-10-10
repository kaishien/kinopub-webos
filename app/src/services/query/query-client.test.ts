import { describe, expect, it } from 'vitest'
import { ApiError } from '@/services/api/api.service'
import { createQueryClient } from './query-client'

function retryOf(client: ReturnType<typeof createQueryClient>) {
  const retry = client.getDefaultOptions().queries?.retry

  if (typeof retry !== 'function') throw new Error('retry must be a predicate')

  return retry
}

describe('createQueryClient', () => {
  it('never retries API errors that came from the server', () => {
    const retry = retryOf(createQueryClient())

    expect(retry(0, new ApiError(500, 'boom'))).toBe(false)
    expect(retry(0, new ApiError(401, 'unauthorized'))).toBe(false)
    expect(retry(0, new ApiError(404, 'missing'))).toBe(false)
  })

  it('retries a network failure exactly once', () => {
    const retry = retryOf(createQueryClient())
    const network = new ApiError(0, 'offline')

    expect(retry(0, network)).toBe(true)
    expect(retry(1, network)).toBe(false)
  })

  it('retries unknown errors once as well', () => {
    const retry = retryOf(createQueryClient())

    expect(retry(0, new Error('unexpected'))).toBe(true)
    expect(retry(1, new Error('unexpected'))).toBe(false)
  })

  it('does not retry mutations and keeps data fresh for ten minutes', () => {
    const defaults = createQueryClient().getDefaultOptions()

    expect(defaults.mutations?.retry).toBe(false)
    expect(defaults.queries?.staleTime).toBe(10 * 60 * 1000)
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false)
  })
})
