import { observer } from 'mobx-react-lite'
import { cx } from '@/shared/lib/cx'
import { Pressable } from '@/shared/ui/focus'
import { IconChevronDown } from '@/shared/ui/icons'
import { useOptionalPage } from '@/shared/ui/page-context'
import { useViewModel } from '@/shared/view-model/use-view-model'
import { PlotDialog } from './plot-dialog/plot-dialog'
import { PlotViewModel } from './plot.view-model'
import styles from './plot.module.css'

export interface PlotProps {
  text: string
  /** Heading of the full-text dialog. */
  title: string
  focusKey?: string
  className?: string
}

/** A clamped description; when it doesn't fit, it becomes focusable and opens the full text. */
export const Plot = observer(function Plot({ text, title, focusKey, className }: PlotProps) {
  const vm = useViewModel(() => new PlotViewModel())
  const page = useOptionalPage()?.page

  return (
    <>
      <Pressable
        focusKey={focusKey}
        focusable={vm.truncated}
        className={cx(styles.plot, className)}
        onPress={vm.show}
        onFocus={({ node }) => page?.reveal(node)}
      >
        <p ref={vm.setNode} className={styles.plotText}>
          {text}
        </p>
        {vm.truncated && (
          <span className={styles.plotMore}>
            Подробнее <IconChevronDown />
          </span>
        )}
      </Pressable>
      {vm.open && <PlotDialog title={title} text={text} onClose={vm.hide} />}
    </>
  )
})
