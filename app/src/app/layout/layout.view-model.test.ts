import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import type { Location } from 'react-router'
import type { RouterService } from '@/services/router/router.service'
import { fakeServices, type FakeServices } from '@/test/fake-services'
import { LayoutViewModel } from './layout.view-model'

const back = () => new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
const other = () => new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true })

describe('LayoutViewModel', () => {
  let services: FakeServices
  let routerBack: MockInstance<RouterService['back']>
  let routerReset: MockInstance<RouterService['reset']>
  let close: MockInstance<() => void>
  /** `pathname` is computed from the router's location, so tests move by setting it. */
  const go = (pathname: string) => {
    services.router.location = { pathname } as Location
  }

  beforeEach(() => {
    vi.useFakeTimers()
    services = fakeServices()
    routerBack = vi.spyOn(services.router, 'back').mockReturnValue(false)
    routerReset = vi.spyOn(services.router, 'reset').mockResolvedValue(undefined)
    close = vi.spyOn(window, 'close').mockImplementation(() => {})
  })

  it('is fullscreen on the player and channel routes only', () => {
    const vm = new LayoutViewModel(services)

    expect(vm.isFullscreen).toBe(false)
    go('/item/1/play/2')
    expect(vm.isFullscreen).toBe(true)
    go('/channels/5')
    expect(vm.isFullscreen).toBe(true)
    go('/channels')
    expect(vm.isFullscreen).toBe(false)
    go('/item/1')
    expect(vm.isFullscreen).toBe(false)
    expect(vm.authStatus).toBe('checking')
    vm.dispose()
  })

  it('lets non-back keys through', () => {
    const vm = new LayoutViewModel(services)
    const event = other()

    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(routerBack).not.toHaveBeenCalled()
    vm.dispose()
  })

  it('goes back in history first', () => {
    const vm = new LayoutViewModel(services)
    const event = back()

    routerBack.mockReturnValue(true)
    window.dispatchEvent(event)
    expect(routerBack).toHaveBeenCalledTimes(1)
    expect(routerReset).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
    vm.dispose()
  })

  it('returns home from a root screen that is not home', () => {
    const vm = new LayoutViewModel(services)

    go('/search')
    window.dispatchEvent(back())
    expect(routerReset).toHaveBeenCalledWith('/')
    expect(services.ui.toast).toBe('')
    expect(close).not.toHaveBeenCalled()
    vm.dispose()
  })

  it('needs two back presses within the window to exit from home', () => {
    const vm = new LayoutViewModel(services)

    window.dispatchEvent(back())
    expect(services.ui.toast).toBe('Нажмите «назад» ещё раз, чтобы выйти')
    expect(close).not.toHaveBeenCalled()

    window.dispatchEvent(back())
    expect(close).toHaveBeenCalledTimes(1)
    vm.dispose()
  })

  it('disarms the exit after the timeout', () => {
    const vm = new LayoutViewModel(services)

    window.dispatchEvent(back())
    vi.advanceTimersByTime(2500)
    window.dispatchEvent(back())
    expect(close).not.toHaveBeenCalled()
    window.dispatchEvent(back())
    expect(close).toHaveBeenCalledTimes(1)
    vm.dispose()
  })

  it('stops handling keys after dispose', () => {
    const vm = new LayoutViewModel(services)

    vm.dispose()
    const event = back()

    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(services.ui.toast).toBe('')
  })
})
