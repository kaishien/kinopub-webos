import { Button } from '@/shared/ui/button/button'
import { IconRefresh } from '@/shared/ui/icons/icons'
import { Spinner } from '@/shared/ui/spinner/spinner'
import styles from './status.module.css'

export interface StatusProps {
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  retryFocusKey?: string
  title?: string
}

export function Status({ loading, error, onRetry, retryFocusKey, title = 'Не загрузилось' }: StatusProps) {
  if (error) {
    return (
      <div className={styles.error}>
        <h3>{title}</h3>
        <p>{error}</p>
        {onRetry && (
          <Button icon={<IconRefresh />} onPress={onRetry} focusKey={retryFocusKey}>
            Повторить
          </Button>
        )}
      </div>
    )
  }
  if (loading) return <Spinner centered={400} />
  return null
}
