import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import type { RouterService } from '@/services/router/router.service'
import type { Services } from '@/services/services'
import { fakeServices, type FakeServices } from '@/test/fake-services'
import { LayoutViewModel } from './layout.view-model'

/** FakeServices is not assignable to Services (see src/test/fake-services.ts); view-models only use what the fake provides. */
const svc = (s: FakeServices) => s as unknown as Services

const back = () => new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
const other = () => new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true })

/**
 * RouterService methods are MobX-bound (non-configurable) so they cannot be spied. A class instance rather than
 * a plain object: the view-model's makeAutoObservable deep-clones plain objects reachable from `services`.
 */
class StubRouter {
  pathname = '/'
  back = vi.fn(() => false)
  reset = vi.fn(() => Promise.resolve())
}

describe('LayoutViewModel', () => {
  let services: FakeServices
  let router: StubRouter
  let close: MockInstance<() => void>

  beforeEach(() => {
    vi.useFakeTimers()
    router = new StubRouter()
    services = fakeServices({ router: router as unknown as RouterService })
    close = vi.spyOn(window, 'close').mockImplementation(() => {})
  })

  afterEach(() => {
    // Each fake RemoteService adds a window keydown listener; drop it so handlers don't leak between tests.
    services.remote.dispose()
  })

  it('is fullscreen on the player and channel routes only', () => {
    const vm = new LayoutViewModel(svc(services))

    expect(vm.isFullscreen).toBe(false)
    router.pathname = '/item/1/play/2'
    expect(vm.isFullscreen).toBe(true)
    router.pathname = '/channels/5'
    expect(vm.isFullscreen).toBe(true)
    router.pathname = '/channels'
    expect(vm.isFullscreen).toBe(false)
    router.pathname = '/item/1'
    expect(vm.isFullscreen).toBe(false)
    expect(vm.authStatus).toBe('checking')
    vm.dispose()
  })

  it('lets non-back keys through', () => {
    const vm = new LayoutViewModel(svc(services))
    const event = other()

    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(router.back).not.toHaveBeenCalled()
    vm.dispose()
  })

  it('goes back in history first', () => {
    const vm = new LayoutViewModel(svc(services))
    const event = back()

    router.back.mockReturnValue(true)
    window.dispatchEvent(event)
    expect(router.back).toHaveBeenCalledTimes(1)
    expect(router.reset).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
    vm.dispose()
  })

  it('returns home from a root screen that is not home', () => {
    const vm = new LayoutViewModel(svc(services))

    router.pathname = '/search'
    window.dispatchEvent(back())
    expect(router.reset).toHaveBeenCalledWith('/')
    expect(services.ui.toast).toBe('')
    expect(close).not.toHaveBeenCalled()
    vm.dispose()
  })

  it('needs two back presses within the window to exit from home', () => {
    const vm = new LayoutViewModel(svc(services))

    window.dispatchEvent(back())
    expect(services.ui.toast).toBe('Нажмите «назад» ещё раз, чтобы выйти')
    expect(close).not.toHaveBeenCalled()

    window.dispatchEvent(back())
    expect(close).toHaveBeenCalledTimes(1)
    vm.dispose()
  })

  it('disarms the exit after the timeout', () => {
    const vm = new LayoutViewModel(svc(services))

    window.dispatchEvent(back())
    vi.advanceTimersByTime(2500)
    window.dispatchEvent(back())
    expect(close).not.toHaveBeenCalled()
    window.dispatchEvent(back())
    expect(close).toHaveBeenCalledTimes(1)
    vm.dispose()
  })

  it('stops handling keys after dispose', () => {
    const vm = new LayoutViewModel(svc(services))

    vm.dispose()
    const event = back()

    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(services.ui.toast).toBe('')
  })
})
