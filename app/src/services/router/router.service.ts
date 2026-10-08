import { makeAutoObservable, runInAction } from 'mobx'
import type { DataRouter, Location, NavigateOptions, To } from 'react-router'

export class RouterService {
  location: Location | null = null
  /** 0 is the root screen. The memory router doesn't expose the history index, so we track it. */
  depth = 0
  private router: DataRouter | null = null
  private unsubscribe: (() => void) | null = null

  constructor() {
    makeAutoObservable<this, 'router' | 'unsubscribe'>(this, { router: false, unsubscribe: false }, { autoBind: true })
  }

  attach(router: DataRouter) {
    this.detach()
    this.router = router
    this.location = router.state.location
    this.depth = 0
    this.unsubscribe = router.subscribe((state) => {
      runInAction(() => {
        if (state.historyAction === 'PUSH' && state.location.key !== this.location?.key) this.depth += 1
        else if (state.historyAction === 'POP' && state.location.key !== this.location?.key) this.depth = Math.max(0, this.depth - 1)
        this.location = state.location
      })
    })
  }

  detach() {
    this.unsubscribe?.()
    this.unsubscribe = null
    this.router = null
  }

  get pathname() {
    return this.location?.pathname ?? '/'
  }

  navigate(to: To, options?: NavigateOptions) {
    return this.router?.navigate(to, options)
  }

  replace(to: To, options?: Omit<NavigateOptions, 'replace'>) {
    return this.router?.navigate(to, { ...options, replace: true })
  }

  back(): boolean {
    if (this.depth <= 0) return false
    void this.router?.navigate(-1)
    return true
  }

  async reset(to: To) {
    if (this.depth > 0) {
      await this.router?.navigate(-this.depth)
      runInAction(() => {
        this.depth = 0
      })
    }
    await this.router?.navigate(to, { replace: true })
  }
}
