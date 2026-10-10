import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, type ApiService } from '@/services/api/api.service'
import type { DeviceCode, TokenResponse, User } from '@/services/api/api.types'
import { StorageService } from '@/services/storage/storage.service'
import { fakeApi, type FakeApi } from '@/test/fake-services'
import { AuthService } from './auth.service'

const device: DeviceCode = {
  code: 'dev-code',
  user_code: 'ABCD',
  verification_uri: 'https://kino.pub/device',
  interval: 5,
  expires_in: 600,
}
const token: TokenResponse = { access_token: 'acc', refresh_token: 'ref', expires_in: 3600 }
const user = { username: 'tester' } as User
const savedTokens = { access: 'saved-acc', refresh: 'saved-ref', expiresAt: 10 ** 13 }

function create(tokens: typeof savedTokens | null = null) {
  const storage = new StorageService()

  if (tokens) storage.set('tokens', tokens)

  const api: FakeApi = fakeApi()
  const auth = new AuthService(storage, api as unknown as ApiService)

  return { storage, api, auth }
}

describe('AuthService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  describe('construction', () => {
    it('hands the saved token to the api and registers itself as the refresh hook', () => {
      const { api, auth } = create(savedTokens)

      expect(api.setToken).toHaveBeenCalledWith('saved-acc')
      expect(api.onUnauthorized).toBe(auth.refresh)
      expect(auth.status).toBe('checking')
    })

    it('clears the api token when nothing is saved', () => {
      const { api } = create()

      expect(api.setToken).toHaveBeenCalledWith(null)
    })
  })

  describe('pairing', () => {
    it('starts pairing when there are no tokens and shows the device code', async () => {
      const { api, auth } = create()

      api.requestDeviceCode.mockResolvedValue(device)
      await auth.init()

      expect(auth.status).toBe('pairing')
      expect(auth.device).toEqual(device)
      expect(auth.pairingError).toBe('')
      expect(api.requestDeviceCode).toHaveBeenCalledTimes(1)
      expect(api.pollDeviceToken).not.toHaveBeenCalled()
    })

    it('reports an error when the device code cannot be fetched', async () => {
      const { api, auth } = create()

      api.requestDeviceCode.mockRejectedValue(new ApiError(0, 'Сервер не отвечает'))
      await auth.init()

      expect(auth.status).toBe('pairing')
      expect(auth.device).toBeNull()
      expect(auth.pairingError).toBe('Сервер не отвечает')
    })

    it('polls at the device interval and keeps polling on 400 (code not entered yet)', async () => {
      const { api, auth } = create()

      api.requestDeviceCode.mockResolvedValue(device)
      api.pollDeviceToken.mockRejectedValue(new ApiError(400, 'authorization_pending'))
      await auth.init()

      await vi.advanceTimersByTimeAsync(4999)
      expect(api.pollDeviceToken).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1)
      expect(api.pollDeviceToken).toHaveBeenCalledTimes(1)
      expect(api.pollDeviceToken).toHaveBeenCalledWith('dev-code', expect.any(AbortSignal))

      await vi.advanceTimersByTimeAsync(5000)
      expect(api.pollDeviceToken).toHaveBeenCalledTimes(2)
      expect(auth.pairingError).toBe('')
      expect(auth.status).toBe('pairing')
    })

    it('never polls faster than every 3 seconds', async () => {
      const { api, auth } = create()

      api.requestDeviceCode.mockResolvedValue({ ...device, interval: 1 })
      api.pollDeviceToken.mockRejectedValue(new ApiError(400, 'pending'))
      await auth.init()

      await vi.advanceTimersByTimeAsync(2999)
      expect(api.pollDeviceToken).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1)
      expect(api.pollDeviceToken).toHaveBeenCalledTimes(1)
    })

    it('shows other API errors but keeps polling', async () => {
      const { api, auth } = create()

      api.requestDeviceCode.mockResolvedValue(device)
      api.pollDeviceToken.mockRejectedValue(new ApiError(403, 'access_denied'))
      await auth.init()

      await vi.advanceTimersByTimeAsync(5000)
      expect(auth.pairingError).toBe('access_denied')

      await vi.advanceTimersByTimeAsync(5000)
      expect(api.pollDeviceToken).toHaveBeenCalledTimes(2)
    })

    it('keeps polling silently through network errors', async () => {
      const { api, auth } = create()

      api.requestDeviceCode.mockResolvedValue(device)
      api.pollDeviceToken.mockRejectedValue(new ApiError(0, 'Сервер не отвечает'))
      await auth.init()

      await vi.advanceTimersByTimeAsync(10_000)
      expect(api.pollDeviceToken).toHaveBeenCalledTimes(2)
      expect(auth.pairingError).toBe('')
    })

    it('saves the tokens, loads the user and notifies the device once the poll succeeds', async () => {
      const { storage, api, auth } = create()

      api.requestDeviceCode.mockResolvedValue(device)
      api.pollDeviceToken.mockResolvedValue(token)
      api.user.mockResolvedValue(user)
      await auth.init()
      api.setToken.mockClear()

      await vi.advanceTimersByTimeAsync(5000)
      await vi.advanceTimersByTimeAsync(0)

      expect(api.setToken).toHaveBeenCalledWith('acc')
      expect(storage.get('tokens', null)).toMatchObject({ access: 'acc', refresh: 'ref' })
      expect(storage.get<{ expiresAt: number }>('tokens', { expiresAt: 0 }).expiresAt).toBe(Date.now() + 3600 * 1000)
      expect(auth.user).toEqual(user)
      expect(auth.status).toBe('ready')
      expect(auth.pairingError).toBe('')
      expect(api.notifyDevice).toHaveBeenCalledWith('Кинопаб TV', 'LG webOS', expect.any(String))

      await vi.advanceTimersByTimeAsync(20_000)
      expect(api.pollDeviceToken).toHaveBeenCalledTimes(1)
    })

    it('requests a fresh code once the old one expires', async () => {
      const { api, auth } = create()

      api.requestDeviceCode.mockResolvedValue({ ...device, interval: 5, expires_in: 12 })
      api.pollDeviceToken.mockRejectedValue(new ApiError(400, 'pending'))
      await auth.init()

      await vi.advanceTimersByTimeAsync(10_000)
      expect(api.pollDeviceToken).toHaveBeenCalledTimes(2)
      expect(api.requestDeviceCode).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(5000)
      expect(api.pollDeviceToken).toHaveBeenCalledTimes(2)
      expect(api.requestDeviceCode).toHaveBeenCalledTimes(2)
      expect(auth.status).toBe('pairing')

      await vi.advanceTimersByTimeAsync(5000)
      expect(api.pollDeviceToken).toHaveBeenCalledTimes(3)
    })

    it('restarting pairing aborts the previous poll loop', async () => {
      const { api, auth } = create()

      api.requestDeviceCode.mockResolvedValue(device)
      api.pollDeviceToken.mockRejectedValue(new ApiError(400, 'pending'))
      await auth.init()

      const firstSignal = api.requestDeviceCode.mock.calls[0][0] as AbortSignal

      await auth.startPairing()
      expect(firstSignal.aborted).toBe(true)

      await vi.advanceTimersByTimeAsync(5000)
      expect(api.pollDeviceToken).toHaveBeenCalledTimes(1)
    })
  })

  describe('init with saved tokens', () => {
    it('loads the user and notifies the device', async () => {
      const { api, auth } = create(savedTokens)

      api.user.mockResolvedValue(user)
      await auth.init()

      expect(auth.status).toBe('ready')
      expect(auth.user).toEqual(user)
      expect(api.notifyDevice).toHaveBeenCalledTimes(1)
      expect(api.requestDeviceCode).not.toHaveBeenCalled()
    })

    it('logs out and starts pairing when the saved token is rejected', async () => {
      const { storage, api, auth } = create(savedTokens)

      api.user.mockRejectedValue(new ApiError(401, 'unauthorized'))
      api.requestDeviceCode.mockResolvedValue(device)
      await auth.init()

      expect(auth.status).toBe('pairing')
      expect(auth.user).toBeNull()
      expect(storage.get('tokens', null)).toBeNull()
      expect(api.setToken).toHaveBeenLastCalledWith(null)
      expect(api.requestDeviceCode).toHaveBeenCalledTimes(1)
      expect(api.notifyDevice).not.toHaveBeenCalled()
    })

    it('proceeds as ready with the saved token when offline', async () => {
      const { storage, api, auth } = create(savedTokens)

      api.user.mockRejectedValue(new ApiError(0, 'Сервер не отвечает'))
      await auth.init()

      expect(auth.status).toBe('ready')
      expect(auth.user).toBeNull()
      expect(storage.get('tokens', null)).toEqual(savedTokens)
      expect(api.requestDeviceCode).not.toHaveBeenCalled()
    })

    it('treats other server errors as offline too', async () => {
      const { api, auth } = create(savedTokens)

      api.user.mockRejectedValue(new ApiError(500, 'boom'))
      await auth.init()

      expect(auth.status).toBe('ready')
    })

    it('does not fail init when the device notification fails', async () => {
      const { api, auth } = create(savedTokens)

      api.user.mockResolvedValue(user)
      api.notifyDevice.mockRejectedValue(new ApiError(500, 'boom'))

      await expect(auth.init()).resolves.toBeUndefined()
      await vi.advanceTimersByTimeAsync(0)
      expect(auth.status).toBe('ready')
    })
  })

  describe('refresh', () => {
    it('exchanges the refresh token and saves the new pair', async () => {
      const { storage, api, auth } = create(savedTokens)

      api.refreshToken.mockResolvedValue(token)

      await expect(auth.refresh()).resolves.toBe(true)
      expect(api.refreshToken).toHaveBeenCalledWith('saved-ref')
      expect(api.setToken).toHaveBeenLastCalledWith('acc')
      expect(storage.get('tokens', null)).toMatchObject({ access: 'acc', refresh: 'ref' })
    })

    it('dedupes concurrent refreshes into one request', async () => {
      const { api, auth } = create(savedTokens)
      let resolve!: (value: TokenResponse) => void

      api.refreshToken.mockReturnValue(
        new Promise<TokenResponse>((r) => {
          resolve = r
        }),
      )

      const first = auth.refresh()
      const second = auth.refresh()

      expect(second).toBe(first)
      expect(api.refreshToken).toHaveBeenCalledTimes(1)

      resolve(token)
      await expect(first).resolves.toBe(true)

      api.refreshToken.mockResolvedValue(token)
      await auth.refresh()
      expect(api.refreshToken).toHaveBeenCalledTimes(2)
    })

    it('returns false without calling the api when there is no refresh token', async () => {
      const { api, auth } = create()

      await expect(auth.refresh()).resolves.toBe(false)
      expect(api.refreshToken).not.toHaveBeenCalled()
    })

    it('logs out when the server rejects the refresh token', async () => {
      const { storage, api, auth } = create(savedTokens)

      api.refreshToken.mockRejectedValue(new ApiError(400, 'invalid_grant'))
      api.requestDeviceCode.mockResolvedValue(device)

      await expect(auth.refresh()).resolves.toBe(false)
      expect(storage.get('tokens', null)).toBeNull()
      expect(api.setToken).toHaveBeenLastCalledWith(null)
      expect(auth.status).toBe('pairing')
    })

    it('keeps the tokens when the refresh failed for network reasons', async () => {
      const { storage, api, auth } = create(savedTokens)

      api.refreshToken.mockRejectedValue(new ApiError(0, 'Сервер не отвечает'))

      await expect(auth.refresh()).resolves.toBe(false)
      expect(storage.get('tokens', null)).toEqual(savedTokens)
      expect(api.requestDeviceCode).not.toHaveBeenCalled()
      expect(auth.status).toBe('checking')
    })
  })

  describe('logout', () => {
    it('clears user, tokens and storage, then starts pairing', async () => {
      const { storage, api, auth } = create(savedTokens)

      api.user.mockResolvedValue(user)
      api.requestDeviceCode.mockResolvedValue(device)
      await auth.init()

      auth.logout()
      await vi.advanceTimersByTimeAsync(0)

      expect(auth.user).toBeNull()
      expect(localStorage.getItem('kp:tokens')).toBeNull()
      expect(api.setToken).toHaveBeenLastCalledWith(null)
      expect(auth.status).toBe('pairing')
      expect(auth.device).toEqual(device)
      expect(storage.get('tokens', null)).toBeNull()
    })
  })
})
