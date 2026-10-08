import type { FocusableComponent, FocusableComponentLayout, LayoutAdapter } from '@noriginmedia/norigin-spatial-navigation'

/** A measurement stays valid within one frame: coordinates don't change during a single key press. */
const FRESH_MS = 16

const EMPTY = { left: 0, top: 0, width: 0, height: 0 }

/**
 * norigin measures every element on mount, and on the TV each layout read mid React commit forces a reflow
 * and drops a frame. Instead, read a single getBoundingClientRect only when navigation actually needs it.
 */
export const lazyLayoutAdapter: Partial<LayoutAdapter> = {
  measureLayout: (component: FocusableComponent) => Promise.resolve(lazyLayout(component.node)),
}

function lazyLayout(node: FocusableComponent['node']): FocusableComponentLayout {
  let rect: { left: number; top: number; width: number; height: number } = EMPTY
  let measuredAt = -Infinity
  const read = () => {
    const now = performance.now()

    if (now - measuredAt > FRESH_MS) {
      rect = node ? node.getBoundingClientRect() : EMPTY
      measuredAt = now
    }

    return rect
  }

  return {
    node,
    get left() {
      return read().left
    },
    get top() {
      return read().top
    },
    get width() {
      return read().width
    },
    get height() {
      return read().height
    },
    get right() {
      const { left, width } = read()

      return left + width
    },
    get bottom() {
      const { top, height } = read()

      return top + height
    },
    get x() {
      return read().left
    },
    get y() {
      return read().top
    },
  }
}
