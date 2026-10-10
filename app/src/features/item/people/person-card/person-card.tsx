import { memo, type CSSProperties, type SyntheticEvent } from 'react'
import { Pressable } from '@/shared/ui/focus'
import { useRowItemFocus } from '@/shared/ui/row'
import type { PersonEntry } from '../people'
import styles from './person-card.module.css'

const showLoaded = (event: SyntheticEvent<HTMLImageElement>) => event.currentTarget.classList.add(styles.isLoaded)
// A broken photo is hidden, leaving the initials underneath.
const hideBroken = (event: SyntheticEvent<HTMLImageElement>) => {
  event.currentTarget.style.display = 'none'
}

export interface PersonCardProps {
  index: number
  focusKey: string
  person: PersonEntry
  onPress: (person: PersonEntry) => void
}

export const PersonCard = memo(function PersonCard({ index, focusKey, person, onPress }: PersonCardProps) {
  const notify = useRowItemFocus()
  const style = { '--avatar-hue': hueOf(person.name) } as CSSProperties

  return (
    <Pressable className={styles.person} focusKey={focusKey} onPress={() => onPress(person)} onFocus={() => notify(index)}>
      <div className={styles.personAvatar} style={style}>
        <span className={styles.personInitials}>{initialsOf(person.name)}</span>
        {person.photo && <img src={person.photo} alt="" loading="lazy" decoding="async" onLoad={showLoaded} onError={hideBroken} />}
      </div>
      <div className={styles.personName}>{person.name}</div>
      {person.role === 'director' && <div className={styles.personRole}>Режиссёр</div>}
    </Pressable>
  )
})

function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)

  return (words[0]?.[0] ?? '') + (words.length > 1 ? words[words.length - 1][0] : '')
}

/** A stable muted color per person, so a row of initials doesn't look like one grey block. */
function hueOf(name: string): number {
  let hash = 0

  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360

  return hash
}
