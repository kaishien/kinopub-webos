import { observer } from 'mobx-react-lite'
import { useServices } from '@/services/services'
import { cx } from '@/shared/lib/cx'
import { useViewModel } from '@/shared/view-model/use-view-model'
import { BackdropViewModel } from './backdrop.view-model'
import { TrailerPreviewViewModel } from './trailer-preview.view-model'
import styles from './backdrop.module.css'

// Frames are <img> so they composite as ready textures without re-rasterizing; the shade is a static layer rasterized once.
export const Backdrop = observer(function Backdrop() {
  const { ui } = useServices()
  const vm = useViewModel((services) => new BackdropViewModel(services.ui, services.images))
  const trailer = useViewModel((services) => new TrailerPreviewViewModel(services))

  return (
    <div className={cx(styles.backdrop, !ui.backdrop && styles.isEmpty)}>
      {vm.layers.map((src, index) =>
        src ? <img key={index} className={cx(styles.backdropLayer, index === vm.top && styles.isTop)} src={src} alt="" /> : null,
      )}
      {trailer.src && (
        // Mounted only while a preview is wanted, so the TV holds a decoder for nothing the rest of the time.
        <video
          className={cx(styles.backdropTrailer, trailer.playing && styles.isTop)}
          src={trailer.src}
          muted
          autoPlay
          playsInline
          onPlaying={trailer.onPlaying}
          onEnded={trailer.clear}
          onError={trailer.clear}
        />
      )}
      <div className={styles.backdropShade} />
    </div>
  )
})
