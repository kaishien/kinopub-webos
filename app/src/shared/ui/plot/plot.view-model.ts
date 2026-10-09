import { makeAutoObservable } from 'mobx'

export class PlotViewModel {
  /** Only a clamped plot is focusable: there is nothing more to read otherwise. */
  truncated = false
  open = false

  private node: HTMLElement | null = null
  private readonly observer = new ResizeObserver(() => this.measure())

  constructor() {
    makeAutoObservable<this, 'node' | 'observer'>(this, { node: false, observer: false }, { autoBind: true })
  }

  setNode(node: HTMLElement | null) {
    if (this.node) this.observer.unobserve(this.node)

    this.node = node
    if (node) this.observer.observe(node)

    this.measure()
  }

  // Fonts load after the first layout and change the line count, hence the observer rather than a single check.
  measure() {
    const node = this.node

    this.truncated = !!node && node.scrollHeight > node.clientHeight + 1
  }

  show() {
    if (this.truncated) this.open = true
  }

  hide() {
    this.open = false
  }

  dispose() {
    this.observer.disconnect()
  }
}
