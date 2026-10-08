import { hashKey } from '@tanstack/query-core'
import { QueryClient } from 'mobx-tanstack-query'
import { ApiError } from '@/services/api/api.service'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: hashKey,
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: 'always',
        structuralSharing: false,
        retry: (failureCount, error) => {
          if (error instanceof ApiError && !error.isNetwork) return false

          return failureCount < 1
        },
      },
      mutations: { retry: false },
    },
  })
}

export type AppQueryClient = ReturnType<typeof createQueryClient>
