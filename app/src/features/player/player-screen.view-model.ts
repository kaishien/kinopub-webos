import { makeAutoObservable, reaction, runInAction } from 'mobx'
import { Query } from 'mobx-tanstack-query'
import type { Item, Video, VideoFile, VideoQuality } from '@/services/api/api.types'
import { RemoteKey, RemoteService } from '@/services/remote/remote.service'
import type { Services } from '@/services/services'
import type { QualityPreference } from '@/services/settings/settings.service'
import { episodeLabel, splitTitle } from '@/shared/lib/format'
import { Scope } from '@/shared/view-model/use-view-model'
import { link } from '@/app/routes'
import { itemQueryKey, resumePoint } from '@/features/item/item-screen.view-model'
import { NextUp } from './next-up/next-up'
import { HlsStream, type StreamAudio, type StreamFailure } from './stream/hls-stream'
import { SubtitleTracks, type SubtitleKind } from './tracks/subtitle-tracks'
import { StallWatchdog, type StallKind } from './watchdog/stall-watchdog'

export type PlayerPanelKind = 'tracks' | 'quality' | 'episodes'
export type PlayerPanel = null | PlayerPanelKind
/** What gets focus when the HUD appears: the progress bar, or the button whose panel was just closed. */
export type HudTarget = 'bar' | PlayerPanelKind

export interface PlayerParams {
  itemId: number
  videoId: number
  startTime: number
  quality?: QualityPreference
  trailerUrl?: string
  autoplayChain?: number
}

export interface EpisodeSeason {
  number: number
  videos: Video[]
}

export interface PanelOption {
  key: string
  title: string
  active: boolean
  select: () => void
}

const QUALITY_ORDER: VideoQuality[] = ['2160p', '1080p', '720p', '480p']
const HUD_MS = 4000
const PANEL_MS = 30000
const MARK_INTERVAL_MS = 15000
const SEEK_STEP_MIN = 10
const SEEK_STEP_MAX = 120
const SEEK_COMMIT_MS = 500
const FLASH_MS = 700
const PAUSE_SCREEN_MS = 8000

const FAILED_MESSAGE =
  'Видео не воспроизводится: не помогли ни смена качества, ни обновление ссылок, ни запасной способ. Проверьте интернет и попробуйте ещё раз.'

export class PlayerScreenViewModel {
  private readonly scope = new Scope()
  readonly item: Query<Item>
  readonly stream: HlsStream
  readonly subtitles: SubtitleTracks
  readonly nextUp: NextUp

  playing = false
  buffering = true
  time: number
  duration = 0
  hudVisible = true
  hudTarget: HudTarget = 'bar'
  flash: 'play' | 'pause' | null = null
  panel: PlayerPanel = null
  /** Netflix-style «Вы смотрите» screen after a long pause. */
  pauseScreen = false
  error = ''
  seekPreview: number | null = null
  /** Fallback: the direct file in the TV's native player, which decodes what MSE can't (e.g. multichannel audio). */
  fallback = false

  private element: HTMLVideoElement | null = null
  private resumeAt: number | null = null
  private hudTimer: number | null = null
  private flashTimer: number | null = null
  private seekTimer: number | null = null
  private pauseTimer: number | null = null
  private seekStep = SEEK_STEP_MIN
  private lastMarkAt = 0
  private wantsToPlay = true
  private linksRefreshed = false
  /** Last real playback position: the element's currentTime resets after a stream restart. */
  private position: number
  /** The watched mark is a toggle: a second call would un-mark the episode. */
  private markedWatched = false
  private readonly watchdog: StallWatchdog

  constructor(
    private readonly services: Services,
    readonly params: PlayerParams,
  ) {
    const { api, queryClient, remote, settings, ui } = services

    this.time = params.startTime
    this.position = params.startTime
    this.resumeAt = params.startTime > 0 ? params.startTime : null
    this.stream = new HlsStream(params.quality ?? settings.values.quality)
    this.subtitles = new SubtitleTracks(ui)
    this.nextUp = new NextUp({
      hasNext: () => !!this.next,
      autoplay: () => settings.values.autoplayNext,
      chain: params.autoplayChain ?? 0,
      advance: (auto) => this.playNext(auto),
      pause: () => {
        this.wantsToPlay = false
        this.element?.pause()
      },
    })
    this.scope.defer(this.nextUp.dispose)
    this.item = new Query<Item>({
      queryClient,
      abortSignal: this.scope.signal,
      queryKey: itemQueryKey(params.itemId),
      queryFn: ({ signal }) => api.item(params.itemId, signal),
    })
    makeAutoObservable<
      this,
      | 'scope'
      | 'element'
      | 'resumeAt'
      | 'hudTimer'
      | 'flashTimer'
      | 'seekTimer'
      | 'pauseTimer'
      | 'seekStep'
      | 'lastMarkAt'
      | 'wantsToPlay'
      | 'linksRefreshed'
      | 'watchdog'
      | 'position'
      | 'markedWatched'
    >(
      this,
      {
        scope: false,
        params: false,
        item: false,
        stream: false,
        subtitles: false,
        element: false,
        resumeAt: false,
        hudTimer: false,
        flashTimer: false,
        seekTimer: false,
        pauseTimer: false,
        seekStep: false,
        lastMarkAt: false,
        wantsToPlay: false,
        linksRefreshed: false,
        watchdog: false,
        position: false,
        markedWatched: false,
        nextUp: false,
      },
      { autoBind: true },
    )
    this.scope.defer(remote.push(this.onKey))
    this.scope.defer(
      reaction(
        () => (this.usesManifest ? this.bestFile?.url.hls4 : undefined),
        (url) => {
          if (!url) return

          this.stream.load(url, this.resumeAt ?? -1)
          this.resumeAt = null
        },
        { fireImmediately: true },
      ),
    )
    this.scope.defer(
      reaction(
        () => this.stream.failure,
        (failure) => {
          if (failure) this.recover(failure)
        },
      ),
    )
    this.scope.defer(this.stream.dispose)
    this.scope.defer(reaction(() => this.stream.audios, this.applyRememberedAudio))
    this.scope.defer(reaction(() => this.stream.subtitles, this.onStreamSubtitles))
    this.watchdog = new StallWatchdog({
      element: () => this.element,
      active: () => this.wantsToPlay && !this.error && this.seekPreview === null,
      onStall: (kind) => this.recover(kind),
    })
    this.scope.defer(() => this.watchdog.dispose())
    this.showHud()
  }

  get isTrailer() {
    return !!this.params.trailerUrl
  }

  get usesManifest() {
    return !this.isTrailer && !this.fallback && this.services.settings.values.stream === 'hls4'
  }

  get video(): Video | undefined {
    const item = this.item.data

    if (!item) return undefined

    const all = item.seasons ? item.seasons.flatMap((s) => s.episodes) : (item.videos ?? [])

    return all.find((v) => v.id === this.params.videoId) ?? all[0]
  }

  get season(): number {
    const item = this.item.data

    if (!item?.seasons) return 0

    return item.seasons.find((s) => s.episodes.some((e) => e.id === this.video?.id))?.number ?? 0
  }

  get files(): VideoFile[] {
    return (this.video?.files ?? []).toSorted(
      (a, b) => QUALITY_ORDER.indexOf(a.quality as VideoQuality) - QUALITY_ORDER.indexOf(b.quality as VideoQuality),
    )
  }

  get bestFile(): VideoFile | undefined {
    return this.files[0]
  }

  get directFile(): VideoFile | undefined {
    const files = this.files

    if (!files.length) return undefined

    const preference = this.stream.quality

    if (preference === 'max' || preference === 'auto') return files[0]

    const wanted = QUALITY_ORDER.indexOf(preference)

    return files.find((f) => QUALITY_ORDER.indexOf(f.quality as VideoQuality) >= wanted) ?? files[files.length - 1]
  }

  get src(): string | undefined {
    if (this.params.trailerUrl) return this.params.trailerUrl
    if (this.usesManifest) return undefined

    const file = this.directFile

    if (!file) return ''
    if (this.fallback) return file.url.http || file.url.hls

    const kind = this.services.settings.values.stream

    return file.url[kind] || file.url.hls4 || file.url.http
  }

  get hasSource() {
    return this.usesManifest ? !!this.bestFile : !!this.src
  }

  get currentQuality(): VideoQuality | undefined {
    return this.usesManifest ? this.stream.variant?.quality : (this.directFile?.quality as VideoQuality | undefined)
  }

  get qualities(): VideoQuality[] {
    return this.usesManifest ? this.stream.qualities : this.files.map((f) => f.quality as VideoQuality)
  }

  get hasQualityChoice() {
    return this.qualities.length > 1
  }

  get hasAudioChoice() {
    return this.usesManifest && this.stream.audios.length > 1
  }

  get title() {
    const title = splitTitle(this.item.data?.title ?? '').ru

    return this.isTrailer ? `Трейлер: ${title}` : title
  }

  get plot(): string {
    return this.isTrailer ? '' : (this.item.data?.plot ?? '')
  }

  get subtitle(): string {
    const video = this.video

    if (!video || this.isTrailer) return ''

    const label = video.snumber || video.number > 0 ? episodeLabel(video.snumber, video.number) : ''

    return [label, video.title].filter(Boolean).join(' · ')
  }

  get next(): { video: Video; season: number } | null {
    const item = this.item.data
    const current = this.video

    if (!item || !current || this.isTrailer) return null

    const flat = item.seasons
      ? item.seasons.flatMap((s) => s.episodes.map((video) => ({ video, season: s.number })))
      : (item.videos ?? []).map((video) => ({ video, season: 0 }))
    const index = flat.findIndex((x) => x.video.id === current.id)

    return index >= 0 ? (flat[index + 1] ?? null) : null
  }

  /** All seasons for the episodes panel; a multi-part movie is one season numbered 0. */
  get episodeSeasons(): EpisodeSeason[] {
    const item = this.item.data

    if (!item || this.isTrailer) return []
    if (item.seasons) return item.seasons.map((season) => ({ number: season.number, videos: season.episodes }))

    return (item.videos?.length ?? 0) > 1 ? [{ number: 0, videos: item.videos! }] : []
  }

  get hasEpisodes() {
    return this.episodeSeasons.reduce((total, season) => total + season.videos.length, 0) > 1
  }

  get tracksLabel() {
    if (this.hasAudioChoice && this.hasSubtitles) return 'Аудио и субтитры'

    return this.hasAudioChoice ? 'Аудио' : 'Субтитры'
  }

  get hasTracks() {
    return this.hasAudioChoice || this.hasSubtitles
  }

  get shownTime() {
    return this.seekPreview ?? this.time
  }

  get progress() {
    return this.duration ? Math.min(100, (this.shownTime / this.duration) * 100) : 0
  }

  get remaining() {
    return Math.max(0, this.duration - this.shownTime)
  }

  get audioLabel() {
    return shortAudioName(this.stream.audio?.name ?? '')
  }

  get usesStreamSubtitles() {
    return this.usesManifest && this.stream.subtitles.length > 0
  }

  get subtitleList(): SubtitleKind[] {
    return this.usesStreamSubtitles ? this.stream.subtitles : (this.video?.subtitles ?? [])
  }

  get hasSubtitles() {
    return this.subtitleList.length > 0
  }

  get selectedSubtitle(): number {
    if (!this.usesStreamSubtitles) return this.subtitles.selected

    return this.stream.subtitles.findIndex((track) => track.id === this.stream.subtitleId)
  }

  get subtitleLabel() {
    return this.selectedSubtitle >= 0 ? 'Вкл' : 'Выкл'
  }

  get seekStepValue() {
    return this.seekStep
  }

  get audioOptions(): PanelOption[] {
    return this.stream.audios.map((audio) => ({
      key: String(audio.id),
      title: shortAudioName(audio.name),
      active: audio.id === this.stream.audio?.id,
      select: () => this.selectAudio(audio.id),
    }))
  }

  get subtitleOptions(): PanelOption[] {
    const list = this.subtitleList
    const selected = this.selectedSubtitle
    // A stream may have several tracks of the same language: number them so rows differ.
    const seen = new Map<string, number>()

    return [
      { key: 'off', title: 'Выключены', active: selected === -1, select: () => this.selectSubtitle(-1) },
      ...SubtitleTracks.order(list).map((index) => {
        const label = SubtitleTracks.label(list[index])
        const count = (seen.get(label) ?? 0) + 1

        seen.set(label, count)

        return {
          key: `${list[index].lang}-${index}`,
          title: count > 1 ? `${label} · ${count}` : label,
          active: index === selected,
          select: () => this.selectSubtitle(index),
        }
      }),
    ]
  }

  get qualityOptions(): PanelOption[] {
    const options: PanelOption[] = this.qualities.map((quality) => ({
      key: quality,
      title: quality === '2160p' ? '2160p · 4K' : quality,
      active: this.stream.quality !== 'auto' && quality === this.currentQuality,
      select: () => this.selectQuality(quality),
    }))

    if (this.usesManifest)
      options.unshift({ key: 'auto', title: 'Авто', active: this.stream.quality === 'auto', select: () => this.selectQuality('auto') })

    return options
  }

  /** Columns of the open option panel: audio and subtitles side by side, or quality alone. */
  get panelColumns(): { key: string; title: string; options: PanelOption[] }[] {
    if (this.panel === 'quality') return [{ key: 'quality', title: 'Качество', options: this.qualityOptions }]

    const columns = []

    if (this.hasAudioChoice) columns.push({ key: 'audio', title: 'Аудио', options: this.audioOptions })
    if (this.hasSubtitles) columns.push({ key: 'subtitles', title: 'Субтитры', options: this.subtitleOptions })

    return columns
  }

  get qualityLabel() {
    const current = this.currentQuality

    return this.usesManifest && this.stream.quality === 'auto' ? `Авто${current ? ` · ${current}` : ''}` : current
  }

  attach(element: HTMLVideoElement | null) {
    if (this.element === element) return
    if (this.element) this.unbind(this.element)

    this.element = element
    if (element) this.bind(element)
    if (this.usesManifest) this.stream.attach(element)
  }

  private bind(el: HTMLVideoElement) {
    el.addEventListener('timeupdate', this.onTimeUpdate)
    el.addEventListener('durationchange', this.onDurationChange)
    el.addEventListener('play', this.onPlay)
    el.addEventListener('pause', this.onPause)
    el.addEventListener('waiting', this.onWaiting)
    el.addEventListener('playing', this.onPlaying)
    el.addEventListener('ended', this.onEnded)
    el.addEventListener('error', this.onError)
    el.addEventListener('loadedmetadata', this.onLoaded)
    el.addEventListener('seeking', this.onSeeking)
  }

  private unbind(el: HTMLVideoElement) {
    el.removeEventListener('timeupdate', this.onTimeUpdate)
    el.removeEventListener('durationchange', this.onDurationChange)
    el.removeEventListener('play', this.onPlay)
    el.removeEventListener('pause', this.onPause)
    el.removeEventListener('waiting', this.onWaiting)
    el.removeEventListener('playing', this.onPlaying)
    el.removeEventListener('ended', this.onEnded)
    el.removeEventListener('error', this.onError)
    el.removeEventListener('loadedmetadata', this.onLoaded)
    el.removeEventListener('seeking', this.onSeeking)
  }

  private onTimeUpdate() {
    const el = this.element

    if (!el) return

    this.time = el.currentTime
    if (el.currentTime > 0.5) this.position = el.currentTime

    this.markTime(false)
    if (!this.isTrailer && this.seekPreview === null) {
      const wasVisible = this.nextUp.visible

      this.nextUp.onTime(el.currentTime, this.duration || el.duration || 0)
      if (this.nextUp.visible && !wasVisible) this.hideHud()
    }
  }

  /** Seeking moves the position too: if the stream stalls afterwards, resume from the new point. */
  private onSeeking() {
    if (this.element && this.element.currentTime > 0.5) this.position = this.element.currentTime
  }

  private onDurationChange() {
    if (this.element?.duration) this.duration = this.element.duration
  }

  private onPlay() {
    this.playing = true
    this.buffering = false
    this.cancelPauseScreen()
  }

  private onPause() {
    this.playing = false
    this.markTime(true)
    this.schedulePauseScreen()
  }

  private onWaiting() {
    this.buffering = true
  }

  private onPlaying() {
    this.buffering = false
  }

  private onError() {
    if (this.usesManifest) return // hls.js errors arrive via stream.failure
    // MEDIA_ERR_ABORTED (src change, load()) is not a real failure.
    if (this.element?.error?.code === MediaError.MEDIA_ERR_ABORTED) return

    this.recover('network')
  }

  private onLoaded() {
    const el = this.element

    if (!el) return
    if (this.resumeAt !== null && this.resumeAt > 0) {
      el.currentTime = this.resumeAt
      this.resumeAt = null
    }

    this.applyRememberedSubtitles()
    void el.play().catch(() => {})
  }

  private applyRememberedSubtitles() {
    if (!this.video || this.isTrailer || this.selectedSubtitle !== -1) return

    const remembered = this.services.trackMemory.get(this.params.itemId).subtitle
    const list = this.subtitleList
    let index = -1

    if (remembered) index = list.findIndex((track) => SubtitleTracks.key(track) === remembered)
    else if (remembered === undefined && this.services.settings.values.subtitlesByDefault)
      index = list.findIndex((track) => track.lang === 'rus' && !track.forced)
    if (index >= 0) this.applySubtitle(index)
  }

  private onStreamSubtitles() {
    if (!this.usesStreamSubtitles) return
    if (this.subtitles.selected >= 0) void this.subtitles.select([], -1)

    this.applyRememberedSubtitles()
  }

  private applySubtitle(index: number) {
    if (this.usesStreamSubtitles) this.stream.setSubtitle(this.stream.subtitles[index]?.id ?? -1)
    else void this.subtitles.select(this.video?.subtitles ?? [], index)
  }

  /** Track indices change between episodes, so match by name. */
  private applyRememberedAudio(audios: StreamAudio[]) {
    const remembered = this.isTrailer ? undefined : this.services.trackMemory.get(this.params.itemId).audio

    if (!remembered) return

    const match = audios.find((audio) => shortAudioName(audio.name) === remembered)

    if (match && match.id !== this.stream.audioId) this.stream.setAudio(match.id)
  }

  private onEnded() {
    this.markWatched()
    if (this.isTrailer || !this.nextUp.onEnded()) {
      this.services.router.back()

      return
    }

    this.hideHud()
  }

  private markWatched() {
    const video = this.video

    if (!video || this.isTrailer || this.markedWatched || video.watching.status === 1) return

    this.markedWatched = true
    void this.services.api.toggleWatched(this.params.itemId, video.number, this.season || undefined).catch(() => {})
  }

  togglePlay() {
    const el = this.element

    if (!el) return
    if (el.paused) void el.play().catch(() => {})
    else el.pause()

    this.wantsToPlay = !el.paused
    this.flash = el.paused ? 'pause' : 'play'
    if (this.flashTimer) clearTimeout(this.flashTimer)

    this.flashTimer = window.setTimeout(() => {
      this.flash = null
    }, FLASH_MS)
    this.showHud()
  }

  seekBy(delta: number) {
    const el = this.element

    if (!el) return

    this.showHud(HUD_MS, 'bar')
    const base = this.seekPreview ?? el.currentTime
    const limit = this.duration || el.duration || 0

    this.seekPreview = Math.max(0, Math.min(limit, base + delta))
    if (this.seekTimer) clearTimeout(this.seekTimer)

    this.seekTimer = window.setTimeout(this.commitSeek, SEEK_COMMIT_MS)
    this.seekStep = Math.min(SEEK_STEP_MAX, this.seekStep + 5)
  }

  private commitSeek() {
    const el = this.element

    if (el && this.seekPreview !== null) el.currentTime = this.seekPreview

    this.seekPreview = null
    this.seekStep = SEEK_STEP_MIN
  }

  openPanel(panel: PlayerPanelKind) {
    this.panel = panel
    this.showHud(PANEL_MS)
  }

  /** Focus returns to the button that opened the panel. */
  closePanel() {
    const panel = this.panel

    this.panel = null
    this.showHud(HUD_MS, panel ?? undefined)
  }

  playEpisode(video: Video) {
    if (video.id === this.video?.id) {
      this.closePanel()

      return
    }

    void this.services.router.replace(link.player(this.params.itemId, video.id, { t: resumePoint(video) }))
  }

  /** Direct files switch by changing the URL and seeking back; HLS4 switches level on the fly. */
  private switchStream(change: () => void) {
    if (!this.usesManifest) {
      this.resumeAt = this.element?.currentTime ?? this.time
      this.buffering = true
    }

    change()
  }

  selectAudio(id: number) {
    this.stream.setAudio(id)
    const audio = this.stream.audios.find((track) => track.id === id)

    if (audio && !this.isTrailer) this.services.trackMemory.rememberAudio(this.params.itemId, shortAudioName(audio.name))

    this.showHud(PANEL_MS)
  }

  selectSubtitle(index: number) {
    const track = this.subtitleList[index]

    this.applySubtitle(index)
    if (!this.isTrailer) this.services.trackMemory.rememberSubtitle(this.params.itemId, track ? SubtitleTracks.key(track) : null)

    this.showHud(PANEL_MS)
  }

  selectQuality(quality: QualityPreference) {
    this.error = ''
    this.switchStream(() => this.stream.setQuality(quality))
    this.closePanel()
  }

  /** Recovery ladder: starvation tries lower quality, then fresh links; decode failure goes straight to fallback; then the error. */
  private recover(reason: StallKind | StreamFailure) {
    if (this.error || this.isTrailer) return

    const at = this.position
    const network = reason === 'starved' || reason === 'network'

    if (reason === 'starved' && this.usesManifest) {
      const lower = this.stream.lowerQuality()

      if (lower) {
        this.services.ui.showToast(`Медленная сеть — переключаю на ${lower}`)
        this.watchdog.reset()

        return
      }
    }
    if (network && !this.linksRefreshed) {
      this.linksRefreshed = true
      void this.refreshLinks(at)

      return
    }
    if (!this.fallback && this.files.some((file) => file.url.http)) {
      this.services.ui.showToast('Переключаю на запасной способ воспроизведения')
      this.stream.dispose()
      this.resumeAt = at
      this.fallback = true
      this.buffering = true
      this.watchdog.reset()

      return
    }

    this.error = FAILED_MESSAGE
    this.buffering = false
    // Don't resume behind the error screen if the network comes back by itself; Retry continues.
    this.wantsToPlay = false
    this.element?.pause()
  }

  /** Kinopub links are signed and expire: refetch the item and resume from the same position. */
  private async refreshLinks(at: number) {
    this.buffering = true
    this.watchdog.reset()
    const before = this.usesManifest ? this.bestFile?.url.hls4 : this.src

    this.resumeAt = at
    await this.item.refetch()
    runInAction(() => {
      if (this.usesManifest) {
        const url = this.bestFile?.url.hls4

        // If the URL changed, the reaction restarts the stream; otherwise restart it here.
        if (url && url === before) this.stream.restart(url, at)

        this.resumeAt = null
      } else if (this.element && this.src === before && this.src) {
        this.element.load()
      }

      this.watchdog.reset()
    })
  }

  retry() {
    const at = this.position

    this.error = ''
    this.wantsToPlay = true
    this.linksRefreshed = false
    this.fallback = false
    this.resumeAt = at
    this.buffering = true
    this.watchdog.reset()
    void this.item.refetch().then(() =>
      runInAction(() => {
        const url = this.bestFile?.url.hls4

        if (this.usesManifest && url) this.stream.restart(url, at)
        else this.element?.load()

        this.watchdog.reset()
      }),
    )
  }

  playNext(auto = false) {
    const next = this.next

    if (!next) return
    if (this.nextUp.visible) this.markWatched()

    const autoplayChain = auto ? this.nextUp.nextChain : 0

    void this.services.router.replace(link.player(this.params.itemId, next.video.id), { state: { autoplayChain } })
  }

  exit() {
    this.services.router.back()
  }

  showHud(ms?: number, target?: HudTarget) {
    if (target) this.hudTarget = target
    else if (!this.hudVisible) this.hudTarget = 'bar'

    this.hudVisible = true
    if (this.hudTimer) clearTimeout(this.hudTimer)

    this.hudTimer = window.setTimeout(this.hideHud, ms ?? (this.panel ? PANEL_MS : HUD_MS))
  }

  private hideHud() {
    this.hudVisible = false
    this.panel = null
  }

  /** Restarted on every key press while paused, so the screen only appears when nobody is touching the remote. */
  private schedulePauseScreen() {
    if (this.pauseTimer) clearTimeout(this.pauseTimer)

    this.pauseTimer = window.setTimeout(() => {
      if (this.playing || this.panel || this.error || this.nextUp.visible || this.isTrailer) return

      this.pauseScreen = true
      this.hideHud()
    }, PAUSE_SCREEN_MS)
  }

  private cancelPauseScreen() {
    if (this.pauseTimer) clearTimeout(this.pauseTimer)

    this.pauseTimer = null
    this.pauseScreen = false
  }

  private markTime(force: boolean) {
    const video = this.video
    const el = this.element

    if (!video || !el || this.isTrailer) return
    if (!force && Date.now() - this.lastMarkAt < MARK_INTERVAL_MS) return

    this.lastMarkAt = Date.now()
    void this.services.api.markTime(this.params.itemId, el.currentTime, video.number, this.season || undefined).catch(() => {})
  }

  private onKey(event: KeyboardEvent): boolean {
    const back = RemoteService.isBack(event)

    this.nextUp.userActive()
    if (!this.playing) this.schedulePauseScreen()
    if (this.pauseScreen) {
      this.pauseScreen = false
      if (back) this.exit()
      else if (isPlayKey(event.keyCode)) this.togglePlay()
      else this.showHud()

      return true
    }
    if (this.error) {
      if (back) {
        this.exit()

        return true
      }

      return false
    }
    if (this.panel) {
      if (back) {
        this.closePanel()

        return true
      }

      return false
    }
    if (this.nextUp.visible) {
      if (!back) return false
      if (this.nextUp.phase === 'credits') this.nextUp.dismiss()
      else this.exit()

      return true
    }
    if (back) {
      this.exit()

      return true
    }

    switch (event.keyCode) {
      case RemoteKey.Enter:
        if (this.hudVisible) return false

        this.togglePlay()

        return true
      case RemoteKey.Play:
      case RemoteKey.Pause:
      case RemoteKey.PlayPause:
        this.togglePlay()

        return true
      case RemoteKey.Stop:
        this.exit()

        return true
      case RemoteKey.FastForward:
        this.seekBy(this.seekStep)

        return true
      case RemoteKey.Rewind:
        this.seekBy(-this.seekStep)

        return true
      case RemoteKey.Right:
      case RemoteKey.Left:
        if (this.hudVisible) {
          this.showHud() // keep the HUD alive; the focus library handles navigation, the bar handles seeking

          return false
        }

        this.seekBy(event.keyCode === RemoteKey.Right ? this.seekStep : -this.seekStep)

        return true
      case RemoteKey.Up:
      case RemoteKey.Down:
        if (this.hudVisible) {
          this.showHud()

          return false
        }

        this.showHud(HUD_MS, 'bar')

        return true
      default:
        this.showHud()

        return false
    }
  }

  dispose() {
    this.markTime(true)
    if (this.element) this.unbind(this.element)

    this.subtitles.dispose()
    if (this.hudTimer) clearTimeout(this.hudTimer)
    if (this.flashTimer) clearTimeout(this.flashTimer)
    if (this.seekTimer) clearTimeout(this.seekTimer)
    if (this.pauseTimer) clearTimeout(this.pauseTimer)

    this.scope.dispose()
    runInAction(() => {
      void this.services.queryClient.invalidateQueries({ queryKey: ['home', 'continue'] })
      void this.services.queryClient.invalidateQueries({ queryKey: itemQueryKey(this.params.itemId) })
    })
  }
}

function isPlayKey(code: number) {
  return code === RemoteKey.Enter || code === RemoteKey.Play || code === RemoteKey.Pause || code === RemoteKey.PlayPause
}

function shortAudioName(name: string) {
  return name.replace(/^\d+\.\s*/, '')
}
