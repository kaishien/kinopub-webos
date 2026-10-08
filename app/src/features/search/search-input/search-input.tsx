import { setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation'
import { useRef } from 'react'
import { cx } from '@/shared/lib/cx'
import styles from './search-input.module.css'

export const SEARCH_INPUT_FOCUS_KEY = 'SEARCH-input'

export interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  resultsFocusKey?: string
}

export function SearchInput({ value, onChange, resultsFocusKey }: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { ref, focused } = useFocusable<object, HTMLDivElement>({
    focusKey: SEARCH_INPUT_FOCUS_KEY,
    onEnterPress: () => inputRef.current?.focus(),
  })

  return (
    <div ref={ref} className={cx(styles.searchInputWrap, focused && 'is-focused')}>
      <input
        ref={inputRef}
        className={styles.searchInput}
        value={value}
        placeholder="Название фильма или сериала"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== 'ArrowDown') return

          inputRef.current?.blur()
          if (resultsFocusKey) setFocus(resultsFocusKey)
        }}
      />
    </div>
  )
}
