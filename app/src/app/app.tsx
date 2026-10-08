import { init as initSpatialNavigation } from '@noriginmedia/norigin-spatial-navigation'
import { lazyLayoutAdapter } from '@/shared/lib/lazy-layout'
import { KEY_REPEAT_MS } from '@/shared/ui/motion'
import { configure } from 'mobx'
import { useState } from 'react'
import { RouterProvider } from 'react-router'
import { createServices, ServicesContext, type Services } from '@/services/services'
import { createAppRouter } from './router'
import './styles/global.css'

configure({ enforceActions: 'never' })

initSpatialNavigation({
  shouldFocusDOMNode: false,
  // Measure lazily with a single getBoundingClientRect: every layout read is expensive on the TV.
  layoutAdapter: lazyLayoutAdapter,
  throttle: KEY_REPEAT_MS,
  throttleKeypresses: true,
})

function bootstrap(): { services: Services; router: ReturnType<typeof createAppRouter> } {
  const services = createServices()
  const router = createAppRouter()

  services.router.attach(router)
  void services.auth.init()

  return { services, router }
}

export function App() {
  const [{ services, router }] = useState(bootstrap)

  return (
    <ServicesContext.Provider value={services}>
      <RouterProvider router={router} />
    </ServicesContext.Provider>
  )
}
