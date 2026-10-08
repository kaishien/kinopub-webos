import { createContext, useContext } from 'react'
import type { PageViewModel } from './page.view-model'

export interface PageContextValue {
  page: PageViewModel
  locationKey: string
  hero: boolean
}

export const PageContext = createContext<PageContextValue | null>(null)

export function usePage(): PageContextValue {
  const context = useContext(PageContext)
  if (!context) throw new Error('Компонент должен быть внутри Page')
  return context
}

export function useOptionalPage(): PageContextValue | null {
  return useContext(PageContext)
}

export const useReveal = () => usePage().page.reveal
