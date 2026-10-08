import { useEffect, useState } from 'react'
import { useServices, type Services } from '@/services/services'

export interface ViewModel {
  dispose?(): void
}

export function useViewModel<T extends ViewModel>(factory: (services: Services) => T): T {
  const services = useServices()
  const [vm] = useState(() => factory(services))
  useEffect(() => () => vm.dispose?.(), [vm])
  return vm
}

/** Composition rather than a base class: makeAutoObservable doesn't work on classes with a superclass. */
export class Scope {
  private readonly controller = new AbortController()
  private readonly finalizers: Array<() => void> = []

  get signal() {
    return this.controller.signal
  }

  defer(fn: () => void) {
    this.finalizers.push(fn)
  }

  dispose() {
    this.controller.abort()
    this.finalizers.splice(0).forEach((fn) => fn())
  }
}
