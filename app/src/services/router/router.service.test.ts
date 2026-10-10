import { NavigationType, type DataRouter, type Location, type RouterState } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { RouterService } from './router.service'

function location(pathname: string, key: string): Location {
  return { pathname, search: '', hash: '', state: null, key }
}

function fakeRouter(initial: Location = location('/', 'root')) {
  let listener: ((state: RouterState) => void) | null = null
  const unsubscribe = vi.fn()
  const navigate = vi.fn(() => Promise.resolve())
  const router = {
    state: { location: initial },
    subscribe: vi.fn((fn: (state: RouterState) => void) => {
      listener = fn

      return unsubscribe
    }),
    navigate,
  } as unknown as DataRouter
  const emit = (historyAction: NavigationType, to: Location) => {
    listener?.({ historyAction, location: to } as RouterState)
  }

  return { router, navigate, unsubscribe, emit }
}

describe('RouterService', () => {
  it('starts at the root with the router location', () => {
    const service = new RouterService()
    const { router } = fakeRouter(location('/home', 'root'))

    service.attach(router)

    expect(service.depth).toBe(0)
    expect(service.pathname).toBe('/home')
  })

  it('defaults the pathname to / when unattached', () => {
    expect(new RouterService().pathname).toBe('/')
  })

  it('counts pushes and pops with a changed location key', () => {
    const service = new RouterService()
    const { router, emit } = fakeRouter()

    service.attach(router)
    emit(NavigationType.Push, location('/item/1', 'a'))
    emit(NavigationType.Push, location('/item/2', 'b'))

    expect(service.depth).toBe(2)
    expect(service.pathname).toBe('/item/2')

    emit(NavigationType.Pop, location('/item/1', 'a'))
    expect(service.depth).toBe(1)
  })

  it('ignores state updates that keep the same location key', () => {
    const service = new RouterService()
    const { router, emit } = fakeRouter()

    service.attach(router)
    emit(NavigationType.Push, location('/item/1', 'a'))
    emit(NavigationType.Push, location('/item/1', 'a'))
    emit(NavigationType.Pop, location('/item/1', 'a'))

    expect(service.depth).toBe(1)
  })

  it('never goes below the root depth', () => {
    const service = new RouterService()
    const { router, emit } = fakeRouter()

    service.attach(router)
    emit(NavigationType.Pop, location('/elsewhere', 'z'))

    expect(service.depth).toBe(0)
  })

  it('does not change depth on REPLACE', () => {
    const service = new RouterService()
    const { router, emit } = fakeRouter()

    service.attach(router)
    emit(NavigationType.Replace, location('/other', 'r'))

    expect(service.depth).toBe(0)
    expect(service.pathname).toBe('/other')
  })

  it('back() at the root returns false without navigating', () => {
    const service = new RouterService()
    const { router, navigate } = fakeRouter()

    service.attach(router)

    expect(service.back()).toBe(false)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('back() deeper in the stack navigates one step back', () => {
    const service = new RouterService()
    const { router, navigate, emit } = fakeRouter()

    service.attach(router)
    emit(NavigationType.Push, location('/item/1', 'a'))

    expect(service.back()).toBe(true)
    expect(navigate).toHaveBeenCalledWith(-1)
  })

  it('navigate and replace forward to the router', () => {
    const service = new RouterService()
    const { router, navigate } = fakeRouter()

    service.attach(router)
    service.navigate('/search', { state: { q: 'x' } })
    service.replace('/home')

    expect(navigate).toHaveBeenNthCalledWith(1, '/search', { state: { q: 'x' } })
    expect(navigate).toHaveBeenNthCalledWith(2, '/home', { replace: true })
  })

  it('reset() unwinds the whole stack and then replaces the root', async () => {
    const service = new RouterService()
    const { router, navigate, emit } = fakeRouter()

    service.attach(router)
    emit(NavigationType.Push, location('/a', 'a'))
    emit(NavigationType.Push, location('/b', 'b'))
    emit(NavigationType.Push, location('/c', 'c'))

    await service.reset('/home')

    expect(navigate.mock.calls).toEqual([[-3], ['/home', { replace: true }]])
    expect(service.depth).toBe(0)
  })

  it('reset() at the root only replaces', async () => {
    const service = new RouterService()
    const { router, navigate } = fakeRouter()

    service.attach(router)
    await service.reset('/home')

    expect(navigate.mock.calls).toEqual([['/home', { replace: true }]])
  })

  it('detaches from the previous router when re-attached and on detach()', () => {
    const service = new RouterService()
    const first = fakeRouter()
    const second = fakeRouter()

    service.attach(first.router)
    service.attach(second.router)
    expect(first.unsubscribe).toHaveBeenCalledTimes(1)

    service.detach()
    expect(second.unsubscribe).toHaveBeenCalledTimes(1)
    expect(service.navigate('/x')).toBeUndefined()
  })

  it('navigation is a no-op when unattached', () => {
    const service = new RouterService()

    expect(service.navigate('/x')).toBeUndefined()
    expect(service.back()).toBe(false)
  })
})
