import { afterEach, vi } from 'vitest'
import { configure } from 'mobx'
import { disposeFakeServices } from './fake-services'

// The app runs with enforceActions off (see app.tsx); tests need the same, or view-model writes from timers warn.
// safeDescriptors off lets vi.spyOn replace autoBound actions such as router.navigate.
configure({ enforceActions: 'never', safeDescriptors: false })

afterEach(() => {
  disposeFakeServices()
  localStorage.clear()
  vi.useRealTimers()
})
