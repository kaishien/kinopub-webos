import type { ReactNode } from 'react'
import { ListItem } from '@/shared/ui/list/list'

export interface SettingProps {
  name: string
  description?: string
  value: ReactNode
  onPress: () => void
  onCycle?: (direction: 1 | -1) => void
  focusKey?: string
}

export function Setting({ name, description, value, onPress, onCycle, focusKey }: SettingProps) {
  return (
    <ListItem
      focusKey={focusKey}
      name={name}
      description={description}
      value={value}
      onPress={onPress}
      onArrow={(direction) => {
        if (!onCycle || (direction !== 'left' && direction !== 'right')) return true
        onCycle(direction === 'right' ? 1 : -1)
        return false
      }}
    />
  )
}
