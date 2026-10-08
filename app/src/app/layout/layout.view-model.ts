import { makeAutoObservable } from 'mobx'
import { RemoteService } from '@/services/remote/remote.service'
import type { Services } from '@/services/services'
import { link } from '@/app/routes'

const EXIT_ARM_MS = 2500

const FULLSCREEN_PATTERN = /\/play\/|^\/channels\/\d+/

export class LayoutViewModel {
  private exitArmed = false
  private exitTimer: number | null = null
  private readonly unsubscribe: () => void

  constructor(private readonly services: Services) {
    makeAutoObservable<this, 'exitArmed' | 'exitTimer' | 'unsubscribe'>(
      this,
      { exitArmed: false, exitTimer: false, unsubscribe: false },
      { autoBind: true },
    )
    this.unsubscribe = services.remote.push(this.onKey)
  }

  get isFullscreen() {
    return FULLSCREEN_PATTERN.test(this.services.router.pathname)
  }

  get authStatus() {
    return this.services.auth.status
  }

  private onKey(event: KeyboardEvent): boolean {
    if (!RemoteService.isBack(event)) return false
    const { router, ui } = this.services
    if (router.back()) return true
    if (router.pathname !== link.home()) {
      void router.reset(link.home())
      return true
    }
    if (this.exitArmed) {
      window.close()
      return true
    }
    this.exitArmed = true
    ui.showToast('Нажмите «назад» ещё раз, чтобы выйти')
    this.exitTimer = window.setTimeout(() => {
      this.exitArmed = false
    }, EXIT_ARM_MS)
    return true
  }

  dispose() {
    this.unsubscribe()
    if (this.exitTimer) clearTimeout(this.exitTimer)
  }
}
