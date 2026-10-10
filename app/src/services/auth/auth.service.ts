import { makeAutoObservable, runInAction } from 'mobx'
import { ApiError, type ApiService } from '@/services/api/api.service'
import type { DeviceCode, User } from '@/services/api/api.types'
import type { StorageService } from '@/services/storage/storage.service'

interface Tokens {
  access: string
  refresh: string
  expiresAt: number
}

export type AuthStatus = 'checking' | 'pairing' | 'ready'

const STORAGE_KEY = 'tokens'
const DEVICE_TITLE = 'Кинопаб TV'

export class AuthService {
  status: AuthStatus = 'checking'
  user: User | null = null
  device: DeviceCode | null = null
  pairingError = ''

  private tokens: Tokens | null
  private pollTimer: number | null = null
  private pairingController: AbortController | null = null
  private refreshing: Promise<boolean> | null = null

  constructor(
    private readonly storage: StorageService,
    private readonly api: ApiService,
  ) {
    this.tokens = storage.get<Tokens | null>(STORAGE_KEY, null)
    makeAutoObservable<this, 'tokens' | 'pollTimer' | 'pairingController' | 'refreshing'>(
      this,
      { tokens: false, pollTimer: false, pairingController: false, refreshing: false },
      { autoBind: true },
    )
    api.setToken(this.tokens?.access ?? null)
    api.onUnauthorized = this.refresh
  }

  async init() {
    if (!this.tokens) {
      await this.startPairing()

      return
    }

    try {
      const user = await this.api.user()

      runInAction(() => {
        this.user = user
        this.status = 'ready'
      })
      this.api.notifyDevice(DEVICE_TITLE, 'LG webOS', browserVersion()).catch(() => {})
    } catch (error) {
      if (error instanceof ApiError && error.isAuth) {
        this.logout()

        return
      }

      // Offline: proceed with the saved token, screens will show their own errors.
      runInAction(() => {
        this.status = 'ready'
      })
    }
  }

  /** `message` is shown over the new code: a terminal poll error means the old code is dead, not that pairing is over. */
  async startPairing(message = '') {
    this.stopPairing()
    this.status = 'pairing'
    this.pairingError = message
    this.device = null
    const controller = new AbortController()

    this.pairingController = controller
    try {
      const device = await this.api.requestDeviceCode(controller.signal)

      if (controller.signal.aborted) return

      runInAction(() => {
        this.device = device
      })
      this.schedulePoll(device, controller)
    } catch (error) {
      if (controller.signal.aborted) return

      runInAction(() => {
        this.pairingError = error instanceof Error ? error.message : 'Не удалось получить код'
      })
    }
  }

  private schedulePoll(device: DeviceCode, controller: AbortController) {
    const interval = Math.max(3, device.interval || 5) * 1000
    const deadline = Date.now() + (device.expires_in || 600) * 1000
    const poll = async () => {
      if (controller.signal.aborted) return
      if (Date.now() > deadline) {
        this.startPairing()

        return
      }

      try {
        const token = await this.api.pollDeviceToken(device.code, controller.signal)

        this.setTokens(token)
        this.stopPairing()
        await this.init()

        return
      } catch (error) {
        // 400 means the user hasn't entered the code yet; keep polling. Anything else (expired, denied, blocked)
        // is final for this code: polling it further only spams the API, so ask for a new one.
        if (error instanceof ApiError && error.status !== 400 && !error.isNetwork) {
          void this.startPairing(error.message)

          return
        }
      }

      this.pollTimer = window.setTimeout(poll, interval)
    }

    this.pollTimer = window.setTimeout(poll, interval)
  }

  private stopPairing() {
    if (this.pollTimer) clearTimeout(this.pollTimer)

    this.pollTimer = null
    this.pairingController?.abort()
    this.pairingController = null
  }

  private setTokens(token: { access_token: string; refresh_token: string; expires_in: number }) {
    this.tokens = { access: token.access_token, refresh: token.refresh_token, expiresAt: Date.now() + token.expires_in * 1000 }
    this.api.setToken(token.access_token)
    this.storage.set(STORAGE_KEY, this.tokens)
  }

  refresh(): Promise<boolean> {
    if (this.refreshing) return this.refreshing

    this.refreshing = (async () => {
      const refreshToken = this.tokens?.refresh

      if (!refreshToken) return false

      try {
        this.setTokens(await this.api.refreshToken(refreshToken))

        return true
      } catch (error) {
        if (error instanceof ApiError && !error.isNetwork) this.logout()

        return false
      } finally {
        this.refreshing = null
      }
    })()

    return this.refreshing
  }

  logout() {
    this.tokens = null
    this.user = null
    this.api.setToken(null)
    this.storage.remove(STORAGE_KEY)
    void this.startPairing()
  }
}

function browserVersion() {
  return navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0] ?? 'webOS'
}
