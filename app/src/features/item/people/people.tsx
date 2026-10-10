import { memo, useCallback } from 'react'
import type { PersonRole } from '@/services/api/api.types'
import { useServices } from '@/services/services'
import { link } from '@/app/routes'
import { Row } from '@/shared/ui/row'
import { PersonCard } from './person-card/person-card'
import { PERSON_CARD } from './person-card/person-card-metrics'

export interface PersonEntry {
  role: PersonRole
  name: string
  /** From Wikidata; absent until it loads or when nobody matched. */
  photo?: string
}

export const People = memo(function People({ people }: { people: PersonEntry[] }) {
  const { router } = useServices()
  const open = useCallback((person: PersonEntry) => void router.navigate(link.person(person.role, person.name)), [router])
  const renderItem = useCallback(
    (index: number, focusKey: string) => <PersonCard index={index} focusKey={focusKey} person={people[index]} onPress={open} />,
    [people, open],
  )

  return <Row title="Режиссёр и актёры" focusKey="ITEM-people" count={people.length} item={PERSON_CARD} renderItem={renderItem} />
})
