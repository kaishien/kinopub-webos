import { afterEach, vi } from 'vitest'
import { configure } from 'mobx'

// The app runs with enforceActions off (see app.tsx); tests need the same, or view-model writes from timers warn.
configure({ enforceActions: 'never' })

afterEach(() => {
  localStorage.clear()
  vi.useRealTimers()
})
