import { observer } from 'mobx-react-lite'
import { useServices } from '@/services/services'
import styles from './toast.module.css'

export const Toast = observer(function Toast() {
  const { ui } = useServices()

  if (!ui.toast) return null

  return <div className={styles.toast}>{ui.toast}</div>
})
