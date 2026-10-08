import styles from './spinner.module.css'

export interface SpinnerProps {
  centered?: boolean | number
}

export function Spinner({ centered }: SpinnerProps) {
  const spinner = <div className={styles.spinner} />

  if (!centered) return spinner

  return (
    <div className={styles.area} style={typeof centered === 'number' ? { height: centered } : undefined}>
      {spinner}
    </div>
  )
}
