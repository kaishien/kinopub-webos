import { memo } from 'react'
import type { PersonRole } from '@/services/api/api.types'
import { useServices } from '@/services/services'
import { link } from '@/app/routes'
import { Button } from '@/shared/ui/button/button'
import { FocusGroup } from '@/shared/ui/focus/focus-group'
import styles from './people.module.css'

export interface PersonEntry {
  role: PersonRole
  name: string
}

export const People = memo(function People({ people }: { people: PersonEntry[] }) {
  const { router } = useServices()

  return (
    <section className={styles.people}>
      <h2 className={styles.title}>Режиссёр и актёры</h2>
      <FocusGroup focusKey="ITEM-people" className={styles.list} reveal>
        {people.map((person) => (
          <Button
            key={`${person.role}-${person.name}`}
            size="sm"
            trailing={person.role === 'director' ? <span className={styles.role}>режиссёр</span> : undefined}
            onPress={() => void router.navigate(link.person(person.role, person.name))}
          >
            {person.name}
          </Button>
        ))}
      </FocusGroup>
    </section>
  )
})
