import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Item, Video, VideoFile, VideoQuality } from '@/services/api/api.types'
import { RemoteKey } from '@/services/remote/remote.service'
import type { Settings } from '@/services/settings/settings.service'
import { fakeServices } from '@/test/fake-services'
import { PlayerScreenViewModel, type PlayerParams } from './player-screen.view-model'
import { FakeErrorTypes, FakeHls } from './stream/fake-hls'

vi.mock('hls.js', async () => (await import('./stream/fake-hls')).fakeHlsModule())

const ITEM_ID = 7
const HUD_MS = 4000
const PANEL_MS = 30000
const PAUSE_SCREEN_MS = 8000
const MARK_INTERVAL_MS = 15000
/** One watchdog tick to record the position plus the stall timeout. */
const STALL_MS = 13000
const FAILED_MESSAGE =
  'Видео не воспроизводится: не помогли ни смена качества, ни обновление ссылок, ни запасной способ. Проверьте интернет и попробуйте ещё раз.'

function file(quality: VideoQuality, tag: string, http = true): VideoFile {
  const base = `https://cdn.test/${tag}-${quality}`

  return {
    codec: 'h264',
    w: 0,
    h: 0,
    quality,
    quality_id: 0,
    file: '',
    url: { http: http ? `${base}.mp4` : '', hls: `${base}.m3u8`, hls2: '', hls4: `${base}/hls4.m3u8` },
  }
}

function video(id: number, snumber: number, number: number, extra: Partial<Video> = {}): Video {
  return {
    id,
    number,
    snumber,
    thumbnail: '',
    title: `Серия ${id}`,
    tracks: 1,
    duration: 2400,
    ac3: 0,
    audios: [],
    subtitles: [],
    files: [file('720p', String(id)), file('1080p', String(id)), file('480p', String(id))],
    watched: 0,
    watching: { status: 0, time: 0 },
    ...extra,
  }
}

const SERIAL: Item = {
  id: ITEM_ID,
  type: 'serial',
  subtype: '',
  title: 'Сериал / Serial',
  year: 2020,
  plot: 'Сюжет',
  posters: { small: '', medium: '', big: '' },
  seasons: [
    {
      id: 1,
      number: 1,
      title: '',
      watching: { status: 0 },
      episodes: [
        video(101, 1, 1, { watched: 1, watching: { status: 1, time: 2400 } }),
        video(102, 1, 2, { watching: { status: 0, time: 500 } }),
        video(103, 1, 3, {
          subtitles: [
            { lang: 'eng', forced: false, url: 'https://cdn.test/103-eng.srt', shift: 0, embed: false, file: '' },
            { lang: 'rus', forced: false, url: 'https://cdn.test/103-rus.srt', shift: 0, embed: false, file: '' },
          ],
        }),
      ],
    },
    { id: 2, number: 2, title: '', watching: { status: 0 }, episodes: [video(201, 2, 1)] },
  ],
}

const MOVIE: Item = { ...SERIAL, id: ITEM_ID, type: 'movie', title: 'Фильм', seasons: undefined, videos: [video(301, 0, 1)] }
const MULTIPART: Item = { ...MOVIE, videos: [video(301, 0, 1), video(302, 0, 2)] }

interface FakeVideoElement {
  currentTime: number
  duration: number
  paused: boolean
  ended: boolean
  error: { code: number } | null
  src: string
  buffered: TimeRanges
  play: ReturnType<typeof vi.fn>
  pause: ReturnType<typeof vi.fn>
  load: ReturnType<typeof vi.fn>
  addEventListener: (type: string, listener: EventListener) => void
  removeEventListener: (type: string, listener: EventListener) => void
  fire: (type: string) => void
  listenerCount: () => number
}

function fakeVideoElement(): FakeVideoElement {
  const listeners = new Map<string, Set<EventListener>>()
  const el: FakeVideoElement = {
    currentTime: 0,
    duration: 0,
    paused: true,
    ended: false,
    error: null,
    src: '',
    buffered: { length: 0, start: () => 0, end: () => 0 },
    play: vi.fn(() => {
      el.paused = false

      return Promise.resolve()
    }),
    pause: vi.fn(() => {
      el.paused = true
    }),
    load: vi.fn(),
    addEventListener: (type, listener) => {
      if (!listeners.has(type)) listeners.set(type, new Set())

      listeners.get(type)!.add(listener)
    },
    removeEventListener: (type, listener) => {
      listeners.get(type)?.delete(listener)
    },
    fire: (type) => {
      listeners.get(type)?.forEach((listener) => listener(new Event(type)))
    },
    listenerCount: () => [...listeners.values()].reduce((total, set) => total + set.size, 0),
  }

  return el
}

const key = (keyCode: number, name = '') => ({ keyCode, key: name, target: null }) as unknown as KeyboardEvent

interface SetupOptions {
  item?: Item
  settings?: Partial<Settings>
  /** Attach a fake video element before the item loads (the default); false leaves the screen detached. */
  attach?: boolean
}

/** Lets pending promises and tanstack's batched notifications settle under fake timers. */
async function settle() {
  for (let i = 0; i < 4; i++) await vi.advanceTimersByTimeAsync(0)
}

async function setup(params: Partial<PlayerParams> = {}, options: SetupOptions = {}) {
  const services = fakeServices()
  const router = {
    replace: vi.spyOn(services.router, 'replace').mockResolvedValue(undefined),
    back: vi.spyOn(services.router, 'back').mockReturnValue(true),
    navigate: vi.spyOn(services.router, 'navigate').mockResolvedValue(undefined),
  }

  for (const [name, value] of Object.entries(options.settings ?? {})) {
    services.settings.set(name as keyof Settings, value as never)
  }

  services.api.item.mockResolvedValue(options.item ?? SERIAL)
  const push = vi.spyOn(services.remote, 'push')
  const vm = new PlayerScreenViewModel(services, {
    itemId: ITEM_ID,
    videoId: 102,
    startTime: 0,
    ...params,
  })
  const onKey = push.mock.calls[0][0] as (event: KeyboardEvent) => boolean
  const el = fakeVideoElement()

  if (options.attach !== false) vm.attach(el as unknown as HTMLVideoElement)

  await settle()

  return { vm, services, router, el, onKey }
}

/** Starts the HLS stream as hls.js would: manifest parsed with the given ladder. */
async function manifestPlaying(params: Partial<PlayerParams> = {}, heights = [1080, 720, 480], options: SetupOptions = {}) {
  const ctx = await setup(params, options)

  FakeHls.last.parseManifest(heights)

  return { ...ctx, hls: FakeHls.last }
}

describe('PlayerScreenViewModel', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] })
    vi.stubGlobal('MediaError', { MEDIA_ERR_ABORTED: 1, MEDIA_ERR_NETWORK: 2, MEDIA_ERR_DECODE: 3, MEDIA_ERR_SRC_NOT_SUPPORTED: 4 })
    FakeHls.reset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('item and source', () => {
    it('loads the item and picks the requested episode', async () => {
      const { vm } = await setup()

      expect(vm.video?.id).toBe(102)
      expect(vm.season).toBe(1)
      expect(vm.title).toBe('Сериал')
      expect(vm.subtitle).toBe('S1 E2 · Серия 102')
      expect(vm.plot).toBe('Сюжет')
    })

    it('falls back to the first video when the id is unknown', async () => {
      const { vm } = await setup({ videoId: 999 })

      expect(vm.video?.id).toBe(101)
    })

    it('plays the HLS4 manifest of the best file through hls.js, resuming from the start time', async () => {
      const { vm } = await setup({ startTime: 500 })

      expect(vm.usesManifest).toBe(true)
      expect(vm.src).toBeUndefined()
      expect(vm.bestFile?.quality).toBe('1080p')
      expect(vm.hasSource).toBe(true)
      expect(FakeHls.last.loadSource).toHaveBeenCalledWith('https://cdn.test/102-1080p/hls4.m3u8')
      expect(FakeHls.last.config.startPosition).toBe(500)
    })

    it('waits for the element before starting the stream', async () => {
      const { vm, el } = await setup({}, { attach: false })

      expect(FakeHls.instances).toHaveLength(0)

      vm.attach(el as unknown as HTMLVideoElement)

      expect(FakeHls.instances).toHaveLength(1)
    })

    it('plays the direct file of the preferred quality when the stream kind is http', async () => {
      const { vm } = await setup({ quality: '720p' }, { settings: { stream: 'http' } })

      expect(vm.usesManifest).toBe(false)
      expect(vm.src).toBe('https://cdn.test/102-720p.mp4')
      expect(vm.currentQuality).toBe('720p')
      expect(vm.qualities).toEqual(['1080p', '720p', '480p'])
      expect(vm.hasQualityChoice).toBe(true)
      expect(vm.hasAudioChoice).toBe(false)
      expect(FakeHls.instances).toHaveLength(0)
    })

    it('direct mode picks the next lower quality when the exact one is missing and the best for max', async () => {
      const item: Item = { ...MOVIE, videos: [video(301, 0, 1, { files: [file('1080p', 'a'), file('480p', 'a')] })] }

      const lower = await setup({ videoId: 301, quality: '720p' }, { item, settings: { stream: 'http' } })

      expect(lower.vm.currentQuality).toBe('480p')

      const max = await setup({ videoId: 301, quality: 'max' }, { item, settings: { stream: 'http' } })

      expect(max.vm.currentQuality).toBe('1080p')
    })

    it('direct mode falls back to other links when the preferred kind is missing', async () => {
      const item: Item = { ...MOVIE, videos: [video(301, 0, 1, { files: [file('1080p', 'a', false)] })] }
      const { vm } = await setup({ videoId: 301 }, { item, settings: { stream: 'http' } })

      expect(vm.src).toBe('https://cdn.test/a-1080p/hls4.m3u8')
    })

    it('reports no source when the video has no files', async () => {
      const item: Item = { ...MOVIE, videos: [video(301, 0, 1, { files: [] })] }
      const { vm } = await setup({ videoId: 301 }, { item })

      expect(vm.hasSource).toBe(false)
      expect(vm.bestFile).toBeUndefined()
      expect(FakeHls.instances).toHaveLength(0)
    })

    it('trailer mode plays the given URL directly and knows nothing about episodes', async () => {
      const { vm, el, services, router } = await setup({ trailerUrl: 'https://cdn.test/trailer.mp4' })

      expect(vm.isTrailer).toBe(true)
      expect(vm.usesManifest).toBe(false)
      expect(vm.src).toBe('https://cdn.test/trailer.mp4')
      expect(vm.title).toBe('Трейлер: Сериал')
      expect(vm.plot).toBe('')
      expect(vm.subtitle).toBe('')
      expect(vm.next).toBeNull()
      expect(vm.episodeSeasons).toEqual([])
      expect(FakeHls.instances).toHaveLength(0)

      el.currentTime = 30
      el.fire('timeupdate')
      expect(services.api.markTime).not.toHaveBeenCalled()

      el.fire('ended')
      expect(services.api.toggleWatched).not.toHaveBeenCalled()
      expect(router.back).toHaveBeenCalledTimes(1)
    })

    it('lists seasons for the episodes panel, a multi-part movie as season 0 and nothing for a single file', async () => {
      const serial = await setup()

      expect(serial.vm.episodeSeasons.map((s) => [s.number, s.videos.length])).toEqual([
        [1, 3],
        [2, 1],
      ])
      expect(serial.vm.hasEpisodes).toBe(true)

      const multipart = await setup({ videoId: 301 }, { item: MULTIPART })

      expect(multipart.vm.episodeSeasons.map((s) => s.number)).toEqual([0])
      expect(multipart.vm.hasEpisodes).toBe(true)

      const movie = await setup({ videoId: 301 }, { item: MOVIE })

      expect(movie.vm.episodeSeasons).toEqual([])
      expect(movie.vm.hasEpisodes).toBe(false)
      expect(movie.vm.subtitle).toBe('Серия 1 · Серия 301')
    })
  })

  describe('resume', () => {
    it('seeks to the start time once metadata is loaded and starts playback', async () => {
      const { el } = await setup({ startTime: 500 }, { settings: { stream: 'http' } })

      el.fire('loadedmetadata')

      expect(el.currentTime).toBe(500)
      expect(el.play).toHaveBeenCalledTimes(1)

      el.currentTime = 600
      el.fire('loadedmetadata')

      expect(el.currentTime).toBe(600)
    })

    it('starts from the beginning without a start time', async () => {
      const { el } = await setup({}, { settings: { stream: 'http' } })

      el.fire('loadedmetadata')

      expect(el.currentTime).toBe(0)
      expect(el.play).toHaveBeenCalledTimes(1)
    })
  })

  describe('seeking', () => {
    it('previews the new position and commits it after a short pause', async () => {
      const { vm, el } = await setup()

      el.currentTime = 100
      el.duration = 2400
      vm.seekBy(10)

      expect(vm.seekPreview).toBe(110)
      expect(vm.shownTime).toBe(110)
      expect(el.currentTime).toBe(100)

      vi.advanceTimersByTime(499)
      expect(el.currentTime).toBe(100)

      vi.advanceTimersByTime(1)
      expect(el.currentTime).toBe(110)
      expect(vm.seekPreview).toBeNull()
    })

    it('accelerates while keys repeat and resets the step after the commit', async () => {
      const { vm, el } = await setup()

      el.currentTime = 100
      el.duration = 2400
      vm.onBarArrow('right')
      vm.onBarArrow('right')
      vm.onBarArrow('right')

      expect(vm.seekPreview).toBe(100 + 10 + 15 + 20)

      vi.advanceTimersByTime(500)
      vm.onBarArrow('left')

      expect(vm.seekPreview).toBe(145 - 10)
    })

    it('clamps to the start and the end', async () => {
      const { vm, el } = await setup()

      el.currentTime = 5
      el.duration = 2400
      vm.seekBy(-10)
      expect(vm.seekPreview).toBe(0)

      vi.advanceTimersByTime(500)
      el.currentTime = 2395
      vm.seekBy(10)
      expect(vm.seekPreview).toBe(2400)
    })

    it('onBarArrow seeks sideways, leaves the bar downwards and ignores up', async () => {
      const { vm, el } = await setup()

      el.currentTime = 100
      el.duration = 2400

      expect(vm.onBarArrow('left')).toBe(false)
      expect(vm.seekPreview).toBe(90)
      expect(vm.onBarArrow('down')).toBe(true)
      expect(vm.onBarArrow('up')).toBe(false)
    })

    it('brings the HUD back with the bar focused', async () => {
      const { vm, el } = await setup()

      el.duration = 2400
      vm.openTracks()
      vm.closePanel()
      vi.advanceTimersByTime(HUD_MS)
      expect(vm.hudVisible).toBe(false)

      vm.seekBy(10)

      expect(vm.hudVisible).toBe(true)
      expect(vm.hudTarget).toBe('bar')
    })

    it('progress and remaining follow the preview', async () => {
      const { vm, el } = await setup()

      el.duration = 2400
      el.fire('durationchange')
      el.currentTime = 600
      el.fire('timeupdate')

      expect(vm.progress).toBe(25)
      expect(vm.remaining).toBe(1800)

      vm.seekBy(600)

      expect(vm.progress).toBe(50)
      expect(vm.remaining).toBe(1200)
    })
  })

  describe('togglePlay', () => {
    it('plays a paused element and flashes the play icon briefly', async () => {
      const { vm, el } = await setup()

      vm.togglePlay()

      expect(el.play).toHaveBeenCalledTimes(1)
      expect(vm.flash).toBe('play')

      vi.advanceTimersByTime(699)
      expect(vm.flash).toBe('play')

      vi.advanceTimersByTime(1)
      expect(vm.flash).toBeNull()
    })

    it('pauses a playing element and flashes the pause icon', async () => {
      const { vm, el } = await setup()

      el.paused = false
      vm.togglePlay()

      expect(el.pause).toHaveBeenCalledTimes(1)
      expect(vm.flash).toBe('pause')
    })

    it('does nothing without an element', async () => {
      const { vm } = await setup({}, { attach: false })

      expect(() => vm.togglePlay()).not.toThrow()
      expect(vm.flash).toBeNull()
    })

    it('tracks play and pause events from the element', async () => {
      const { vm, el } = await setup()

      el.fire('play')
      expect(vm.playing).toBe(true)
      expect(vm.buffering).toBe(false)

      el.fire('waiting')
      expect(vm.buffering).toBe(true)

      el.fire('playing')
      expect(vm.buffering).toBe(false)

      el.fire('pause')
      expect(vm.playing).toBe(false)
    })
  })

  describe('HUD', () => {
    it('is visible at first and hides after a few seconds', async () => {
      const { vm } = await setup()

      expect(vm.hudVisible).toBe(true)

      vi.advanceTimersByTime(HUD_MS - 1)
      expect(vm.hudVisible).toBe(true)

      vi.advanceTimersByTime(1)
      expect(vm.hudVisible).toBe(false)
    })

    it('showHud restarts the timer', async () => {
      const { vm } = await setup()

      vi.advanceTimersByTime(HUD_MS - 1000)
      vm.showHud()
      vi.advanceTimersByTime(HUD_MS - 1000)

      expect(vm.hudVisible).toBe(true)

      vi.advanceTimersByTime(1000)
      expect(vm.hudVisible).toBe(false)
    })

    it('focuses the bar when the HUD reappears and keeps the target while it is visible', async () => {
      const { vm } = await setup()

      vm.showHud(HUD_MS, 'quality')
      expect(vm.hudTarget).toBe('quality')

      vm.showHud()
      expect(vm.hudTarget).toBe('quality')

      vi.advanceTimersByTime(HUD_MS)
      vm.showHud()

      expect(vm.hudVisible).toBe(true)
      expect(vm.hudTarget).toBe('bar')
    })

    it('stays up longer while a panel is open and closes the panel when it hides', async () => {
      const { vm } = await setup()

      vm.openQuality()

      expect(vm.panel).toBe('quality')
      expect(vm.hudVisible).toBe(true)

      vi.advanceTimersByTime(HUD_MS)
      expect(vm.hudVisible).toBe(true)

      vm.showHud()
      vi.advanceTimersByTime(PANEL_MS - 1)
      expect(vm.hudVisible).toBe(true)

      vi.advanceTimersByTime(1)
      expect(vm.hudVisible).toBe(false)
      expect(vm.panel).toBeNull()
    })

    it('closing a panel returns focus to its button and hides on the short timer', async () => {
      const { vm } = await setup()

      vm.openEpisodes()
      vm.closePanel()

      expect(vm.panel).toBeNull()
      expect(vm.hudTarget).toBe('episodes')

      vi.advanceTimersByTime(HUD_MS)
      expect(vm.hudVisible).toBe(false)
    })
  })

  describe('pause screen', () => {
    it('appears after a long pause and hides the HUD', async () => {
      const { vm, el } = await setup()

      el.fire('pause')
      vi.advanceTimersByTime(PAUSE_SCREEN_MS - 1)
      expect(vm.pauseScreen).toBe(false)

      vi.advanceTimersByTime(1)
      expect(vm.pauseScreen).toBe(true)
      expect(vm.hudVisible).toBe(false)
    })

    it('is cancelled by resuming playback', async () => {
      const { vm, el } = await setup()

      el.fire('pause')
      vi.advanceTimersByTime(PAUSE_SCREEN_MS / 2)
      el.fire('play')
      vi.advanceTimersByTime(PAUSE_SCREEN_MS)

      expect(vm.pauseScreen).toBe(false)
    })

    it('does not appear over an open panel or in trailer mode', async () => {
      const withPanel = await setup()

      withPanel.el.fire('pause')
      withPanel.vm.openTracks()
      vi.advanceTimersByTime(PAUSE_SCREEN_MS)
      expect(withPanel.vm.pauseScreen).toBe(false)

      const trailer = await setup({ trailerUrl: 'https://cdn.test/t.mp4' })

      trailer.el.fire('pause')
      vi.advanceTimersByTime(PAUSE_SCREEN_MS)
      expect(trailer.vm.pauseScreen).toBe(false)
    })

    it('restarts its timer on every key press while paused', async () => {
      const { vm, el, onKey } = await setup()

      el.fire('pause')
      vi.advanceTimersByTime(PAUSE_SCREEN_MS - 2000)
      onKey(key(RemoteKey.Red))
      vi.advanceTimersByTime(PAUSE_SCREEN_MS - 2000)
      expect(vm.pauseScreen).toBe(false)

      vi.advanceTimersByTime(2000)
      expect(vm.pauseScreen).toBe(true)
    })
  })

  describe('quality', () => {
    it('offers Auto plus the manifest ladder and switches levels on the fly', async () => {
      const { vm, hls } = await manifestPlaying()

      expect(vm.qualityOptions.map((o) => [o.key, o.title, o.active])).toEqual([
        ['auto', 'Авто', true],
        ['1080p', '1080p', false],
        ['720p', '720p', false],
        ['480p', '480p', false],
      ])
      expect(vm.qualityLabel).toBe('Авто · 1080p')

      vm.openQuality()
      vm.qualityOptions[2].select()

      expect(vm.stream.quality).toBe('720p')
      expect(hls.currentLevel).toBe(1)
      expect(vm.currentQuality).toBe('720p')
      expect(vm.qualityLabel).toBe('720p')
      expect(vm.qualityOptions.find((o) => o.active)?.key).toBe('720p')
      expect(vm.panel).toBeNull()
    })

    it('labels 4K and tracks the auto level hls.js picked', async () => {
      const { vm, hls } = await manifestPlaying({}, [2160, 1080])

      expect(vm.qualityOptions[1].title).toBe('2160p · 4K')

      hls.emit('hlsLevelSwitched', { level: 1 })
      expect(vm.qualityLabel).toBe('Авто · 1080p')
    })

    it('direct mode switches the file and resumes from the same position', async () => {
      const { vm, el } = await setup({ quality: '1080p' }, { settings: { stream: 'http' } })

      expect(vm.qualityOptions.map((o) => o.key)).toEqual(['1080p', '720p', '480p'])
      el.currentTime = 300
      vm.selectQuality('480p')

      expect(vm.src).toBe('https://cdn.test/102-480p.mp4')
      expect(vm.buffering).toBe(true)

      el.currentTime = 0
      el.fire('loadedmetadata')
      expect(el.currentTime).toBe(300)
    })
  })

  describe('tracks', () => {
    const AUDIOS = [
      { id: 0, name: '1. Дубляж', lang: 'rus' },
      { id: 1, name: '2. Original', lang: 'eng' },
    ]
    const SUBTITLES = [
      { id: 0, lang: 'rus', name: 'Russian' },
      { id: 1, lang: 'eng', name: 'English' },
      { id: 2, lang: 'rus', name: 'Russian 2' },
    ]

    it('builds the audio and subtitle columns from the stream', async () => {
      const { vm, hls } = await manifestPlaying()

      expect(vm.hasTracks).toBe(false)

      hls.updateAudioTracks(AUDIOS)
      hls.updateSubtitleTracks(SUBTITLES)

      expect(vm.hasAudioChoice).toBe(true)
      expect(vm.hasSubtitles).toBe(true)
      expect(vm.tracksLabel).toBe('Аудио и субтитры')
      expect(vm.audioLabel).toBe('Дубляж')
      expect(vm.subtitleLabel).toBe('Выкл')

      vm.openTracks()
      expect(vm.panelColumns.map((c) => c.key)).toEqual(['audio', 'subtitles'])
      expect(vm.panelColumns[0].options.map((o) => [o.title, o.active])).toEqual([
        ['Дубляж', true],
        ['Original', false],
      ])
      expect(vm.panelColumns[1].options.map((o) => o.title)).toEqual(['Выключены', 'Русский', 'Русский · 2', 'Английский'])
      expect(vm.panelColumns[1].options[0].active).toBe(true)

      vm.openQuality()
      expect(vm.panelColumns.map((c) => c.key)).toEqual(['quality'])
    })

    it('selecting audio switches the stream track and remembers the name for the item', async () => {
      const { vm, hls, services } = await manifestPlaying()

      hls.updateAudioTracks(AUDIOS)
      vm.audioOptions[1].select()

      expect(hls.audioTrack).toBe(1)
      expect(vm.audioLabel).toBe('Original')
      expect(services.trackMemory.get(ITEM_ID).audio).toBe('Original')
    })

    it('applies the remembered audio when the tracks arrive, matching by name', async () => {
      const { hls, services } = await manifestPlaying()

      services.trackMemory.rememberAudio(ITEM_ID, 'Original')
      hls.updateAudioTracks([
        { id: 3, name: '1. Дубляж', lang: 'rus' },
        { id: 4, name: '5. Original', lang: 'eng' },
      ])

      expect(hls.audioTrack).toBe(4)
    })

    it('selecting a stream subtitle switches the track and remembers its language key', async () => {
      const { vm, hls, services } = await manifestPlaying()

      hls.updateSubtitleTracks(SUBTITLES)
      vm.subtitleOptions[3].select()

      expect(hls.subtitleTrack).toBe(1)
      expect(hls.subtitleDisplay).toBe(true)
      expect(vm.selectedSubtitle).toBe(1)
      expect(vm.subtitleLabel).toBe('Вкл')
      expect(services.trackMemory.get(ITEM_ID).subtitle).toBe('eng')

      vm.subtitleOptions[0].select()

      expect(hls.subtitleTrack).toBe(-1)
      expect(services.trackMemory.get(ITEM_ID).subtitle).toBeNull()
    })

    it('applies the remembered subtitle when the stream tracks arrive', async () => {
      const { hls, services } = await manifestPlaying()

      services.trackMemory.rememberSubtitle(ITEM_ID, 'eng')
      hls.updateSubtitleTracks(SUBTITLES)

      expect(hls.subtitleTrack).toBe(1)
    })

    it('turns Russian subtitles on by default when the setting asks for it and nothing is remembered', async () => {
      const { hls } = await manifestPlaying({}, [1080], { settings: { subtitlesByDefault: true } })

      hls.updateSubtitleTracks([
        { id: 0, lang: 'rus', forced: true },
        { id: 1, lang: 'eng' },
        { id: 2, lang: 'rus' },
      ])

      expect(hls.subtitleTrack).toBe(2)
    })

    it('keeps subtitles off when the viewer turned them off before, despite the default setting', async () => {
      const { hls, services } = await manifestPlaying({}, [1080], { settings: { subtitlesByDefault: true } })

      services.trackMemory.rememberSubtitle(ITEM_ID, null)
      hls.updateSubtitleTracks([{ id: 0, lang: 'rus' }])

      expect(hls.subtitleTrack).toBe(-1)
    })

    it('uses the external subtitle files when the stream has none', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.resolve(new Response('WEBVTT\n\n'))),
      )
      URL.createObjectURL = vi.fn(() => 'blob:1')
      URL.revokeObjectURL = vi.fn()
      const { vm, services } = await setup({ videoId: 103 }, { settings: { stream: 'http' } })

      expect(vm.usesStreamSubtitles).toBe(false)
      expect(vm.subtitleOptions.map((o) => o.title)).toEqual(['Выключены', 'Русский', 'Английский'])

      vm.subtitleOptions[1].select()
      await settle()

      expect(vm.subtitles.selected).toBe(1)
      expect(vm.selectedSubtitle).toBe(1)
      expect(vm.subtitles.url).toBe('blob:1')
      expect(services.trackMemory.get(ITEM_ID).subtitle).toBe('rus')
    })
  })

  describe('next episode', () => {
    it('finds the next episode within and across seasons', async () => {
      expect((await setup({ videoId: 102 })).vm.next).toMatchObject({ video: { id: 103 }, season: 1 })
      expect((await setup({ videoId: 103 })).vm.next).toMatchObject({ video: { id: 201 }, season: 2 })
      expect((await setup({ videoId: 201 })).vm.next).toBeNull()
    })

    it('finds the next part of a multi-part movie and nothing for a single file', async () => {
      expect((await setup({ videoId: 301 }, { item: MULTIPART })).vm.next).toMatchObject({ video: { id: 302 }, season: 0 })
      expect((await setup({ videoId: 301 }, { item: MOVIE })).vm.next).toBeNull()
    })

    it('playNext replaces the route with the next episode and resets the autoplay chain on a manual choice', async () => {
      const { vm, router } = await setup({ videoId: 102, autoplayChain: 2 })

      vm.playNext()

      expect(router.replace).toHaveBeenCalledWith('/item/7/play/103', { state: { autoplayChain: 0 } })
    })

    it('playNext grows the autoplay chain when triggered automatically', async () => {
      const { vm, router } = await setup({ videoId: 102, autoplayChain: 2 })

      vm.playNext(true)

      expect(router.replace).toHaveBeenCalledWith('/item/7/play/103', { state: { autoplayChain: 3 } })
    })

    it('playNext does nothing on the last episode', async () => {
      const { vm, router } = await setup({ videoId: 201 })

      vm.playNext()

      expect(router.replace).not.toHaveBeenCalled()
    })

    it('shows the next-up card in the credits, hides the HUD and advances when the countdown ends', async () => {
      const { vm, el, router, services } = await setup({ videoId: 102 })

      el.duration = 2400
      el.fire('durationchange')
      el.currentTime = 2375
      el.fire('timeupdate')

      expect(vm.nextUp.phase).toBe('credits')
      expect(vm.hudVisible).toBe(false)

      vi.advanceTimersByTime(10000)

      expect(services.api.toggleWatched).toHaveBeenCalledWith(ITEM_ID, 2, 1)
      expect(router.replace).toHaveBeenCalledWith('/item/7/play/103', { state: { autoplayChain: 1 } })
    })

    it('does not touch the next-up card while a seek is being previewed', async () => {
      const { vm, el } = await setup({ videoId: 102 })

      el.duration = 2400
      el.fire('durationchange')
      el.currentTime = 2000
      vm.seekBy(375)
      el.currentTime = 2375
      el.fire('timeupdate')

      expect(vm.nextUp.phase).toBe('hidden')
    })

    it('playEpisode closes the panel for the playing episode and replaces the route for another', async () => {
      const { vm, router } = await setup({ videoId: 103 })

      vm.openEpisodes()
      vm.playEpisode(vm.video!)
      expect(vm.panel).toBeNull()
      expect(router.replace).not.toHaveBeenCalled()

      vm.playEpisode(SERIAL.seasons![0].episodes[1])
      expect(router.replace).toHaveBeenCalledWith('/item/7/play/102?t=500')
    })
  })

  describe('marking progress', () => {
    it('reports the position at most once per interval and immediately on pause', async () => {
      const { el, services } = await setup({ videoId: 102 })

      el.currentTime = 100
      el.fire('timeupdate')
      expect(services.api.markTime).toHaveBeenCalledTimes(1)
      expect(services.api.markTime).toHaveBeenCalledWith(ITEM_ID, 100, 2, 1)

      el.currentTime = 105
      el.fire('timeupdate')
      vi.advanceTimersByTime(MARK_INTERVAL_MS - 1000)
      el.fire('timeupdate')
      expect(services.api.markTime).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(1000)
      el.currentTime = 115
      el.fire('timeupdate')
      expect(services.api.markTime).toHaveBeenCalledTimes(2)

      el.currentTime = 116
      el.fire('pause')
      expect(services.api.markTime).toHaveBeenCalledTimes(3)
      expect(services.api.markTime).toHaveBeenLastCalledWith(ITEM_ID, 116, 2, 1)
    })

    it('sends no season for a movie', async () => {
      const { el, services } = await setup({ videoId: 301 }, { item: MOVIE })

      el.currentTime = 100
      el.fire('timeupdate')

      expect(services.api.markTime).toHaveBeenCalledWith(ITEM_ID, 100, 1, undefined)
    })

    it('marks the episode watched once when it ends and shows the next-up card', async () => {
      const { vm, el, services, router } = await setup({ videoId: 102 })

      el.fire('ended')

      expect(services.api.toggleWatched).toHaveBeenCalledTimes(1)
      expect(services.api.toggleWatched).toHaveBeenCalledWith(ITEM_ID, 2, 1)
      expect(vm.nextUp.phase).toBe('ended')
      expect(vm.hudVisible).toBe(false)
      expect(router.back).not.toHaveBeenCalled()

      el.fire('ended')
      vm.playNext()
      expect(services.api.toggleWatched).toHaveBeenCalledTimes(1)
    })

    it('leaves the player when the last episode ends', async () => {
      const { el, services, router } = await setup({ videoId: 201 })

      el.fire('ended')

      expect(services.api.toggleWatched).toHaveBeenCalledWith(ITEM_ID, 1, 2)
      expect(router.back).toHaveBeenCalledTimes(1)
    })

    it('does not toggle an episode that is already watched', async () => {
      const { el, services } = await setup({ videoId: 101 })

      el.fire('ended')

      expect(services.api.toggleWatched).not.toHaveBeenCalled()
    })
  })

  describe('recovery', () => {
    it('steps down the quality when the stream starves, then refreshes links, then falls back to the file, then gives up', async () => {
      const { vm, el, hls, services } = await manifestPlaying({ quality: 'max' }, [1080, 720, 480])

      expect(hls.currentLevel).toBe(0)
      el.currentTime = 250
      el.fire('timeupdate')

      vi.advanceTimersByTime(STALL_MS)
      expect(hls.currentLevel).toBe(1)

      vi.advanceTimersByTime(STALL_MS)
      expect(hls.currentLevel).toBe(2)

      vi.advanceTimersByTime(STALL_MS)
      expect(vm.buffering).toBe(true)
      expect(services.api.item).toHaveBeenCalledTimes(2)

      await settle()
      expect(hls.destroy).toHaveBeenCalledTimes(1)
      expect(FakeHls.instances).toHaveLength(2)
      expect(FakeHls.last.config.startPosition).toBe(250)
      expect(vm.usesManifest).toBe(true)

      vi.advanceTimersByTime(STALL_MS)
      expect(vm.fallback).toBe(true)
      expect(vm.usesManifest).toBe(false)
      expect(vm.src).toBe('https://cdn.test/102-480p.mp4')
      expect(FakeHls.last.destroy).toHaveBeenCalledTimes(1)
      expect(services.api.item).toHaveBeenCalledTimes(2)

      // The screen re-mounts the element for the new src.
      vm.attach(null)
      const direct = fakeVideoElement()

      vm.attach(direct as unknown as HTMLVideoElement)
      direct.fire('loadedmetadata')
      expect(direct.currentTime).toBe(250)

      vi.advanceTimersByTime(STALL_MS)
      expect(vm.error).toBe(FAILED_MESSAGE)
      expect(vm.buffering).toBe(false)
      expect(direct.pause).toHaveBeenCalled()
      expect(FakeHls.instances).toHaveLength(2)
    })

    it('a fatal network error from hls.js refreshes the links once and restarts from the last position', async () => {
      const { vm, el, hls, services } = await manifestPlaying()

      el.currentTime = 120
      el.fire('seeking')
      hls.fatal(FakeErrorTypes.NETWORK_ERROR)
      hls.fatal(FakeErrorTypes.NETWORK_ERROR)
      expect(services.api.item).toHaveBeenCalledTimes(1)

      hls.fatal(FakeErrorTypes.NETWORK_ERROR)
      expect(services.api.item).toHaveBeenCalledTimes(2)
      await settle()

      expect(FakeHls.last).not.toBe(hls)
      expect(FakeHls.last.config.startPosition).toBe(120)
      expect(vm.fallback).toBe(false)

      FakeHls.last.parseManifest([1080])
      FakeHls.last.fatal(FakeErrorTypes.NETWORK_ERROR)
      FakeHls.last.fatal(FakeErrorTypes.NETWORK_ERROR)
      FakeHls.last.fatal(FakeErrorTypes.NETWORK_ERROR)

      expect(services.api.item).toHaveBeenCalledTimes(2)
      expect(vm.fallback).toBe(true)
    })

    it('tells the viewer which quality it steps down to, and that the direct file is a fallback', async () => {
      const { vm, el, hls, services } = await manifestPlaying({ quality: 'max' }, [1080, 720, 480])

      el.currentTime = 250
      el.fire('timeupdate')
      vi.advanceTimersByTime(STALL_MS)
      expect(services.ui.toast).toContain('720p')

      hls.fatal(FakeErrorTypes.MEDIA_ERROR)
      hls.fatal(FakeErrorTypes.MEDIA_ERROR)
      hls.fatal(FakeErrorTypes.MEDIA_ERROR)
      expect(vm.fallback).toBe(true)
      expect(services.ui.toast).toContain('запасной способ')
    })

    it('a decode failure skips straight to the direct file', async () => {
      const { vm, hls, services } = await manifestPlaying()

      hls.fatal(FakeErrorTypes.MEDIA_ERROR)
      hls.fatal(FakeErrorTypes.MEDIA_ERROR)
      hls.fatal(FakeErrorTypes.MEDIA_ERROR)

      expect(vm.fallback).toBe(true)
      expect(vm.stream.quality).toBe('auto')
      expect(services.api.item).toHaveBeenCalledTimes(1)
    })

    it('in direct mode a second failure restarts the same file with a neutral toast', async () => {
      const { vm, el, services } = await setup({}, { settings: { stream: 'http' } })

      el.fire('error')
      await settle()
      expect(services.api.item).toHaveBeenCalledTimes(2)

      el.fire('error')
      expect(vm.fallback).toBe(true)
      expect(services.ui.toast).toBe('Перезапускаю воспроизведение')
    })

    it('unplayable multichannel audio falls back to the direct file', async () => {
      const { vm, hls } = await manifestPlaying()

      hls.updateAudioTracks([{ id: 0, name: 'Дубляж AC3' }])

      expect(vm.fallback).toBe(true)
    })

    it('shows the error right away when there is no direct file to fall back to', async () => {
      const item: Item = { ...MOVIE, videos: [video(301, 0, 1, { files: [file('1080p', 'a', false)] })] }
      const { vm, hls } = await manifestPlaying({ videoId: 301 }, [1080], { item })

      hls.fatal(FakeErrorTypes.MEDIA_ERROR)
      hls.fatal(FakeErrorTypes.MEDIA_ERROR)
      hls.fatal(FakeErrorTypes.MEDIA_ERROR)

      expect(vm.fallback).toBe(false)
      expect(vm.error).toBe(FAILED_MESSAGE)
    })

    it('a direct-file element error is treated as a network problem, an aborted load is not', async () => {
      const { vm, el, services } = await setup({}, { settings: { stream: 'http' } })

      el.error = { code: 1 }
      el.fire('error')
      expect(services.api.item).toHaveBeenCalledTimes(1)

      el.error = { code: 2 }
      el.fire('error')
      expect(services.api.item).toHaveBeenCalledTimes(2)
      expect(vm.buffering).toBe(true)

      await settle()
      expect(el.load).toHaveBeenCalledTimes(1)
    })

    it('does not recover in trailer mode', async () => {
      const { vm, services } = await setup({ trailerUrl: 'https://cdn.test/t.mp4' })

      vi.advanceTimersByTime(STALL_MS * 2)

      expect(vm.error).toBe('')
      expect(services.ui.toast).toBe('')
      expect(services.api.item).toHaveBeenCalledTimes(1)
    })

    it('does not watch for stalls while paused or during a seek preview', async () => {
      const paused = await manifestPlaying()

      paused.el.paused = false
      paused.vm.togglePlay()
      vi.advanceTimersByTime(STALL_MS * 2)
      expect(paused.services.ui.toast).toBe('')

      const seeking = await manifestPlaying()

      seeking.el.duration = 2400
      for (let elapsed = 0; elapsed < STALL_MS * 2; elapsed += 400) {
        seeking.vm.seekBy(1)
        vi.advanceTimersByTime(400)
      }

      expect(seeking.vm.seekPreview).not.toBeNull()
      expect(seeking.services.ui.toast).toBe('')
    })

    it('retry clears the error, refetches and restarts the stream from the last position', async () => {
      const { vm, el, hls, services } = await manifestPlaying()

      el.currentTime = 400
      el.fire('timeupdate')
      hls.fatal(FakeErrorTypes.MEDIA_ERROR)
      hls.fatal(FakeErrorTypes.MEDIA_ERROR)
      hls.fatal(FakeErrorTypes.MEDIA_ERROR)
      vm.attach(null)
      const direct = fakeVideoElement()

      vm.attach(direct as unknown as HTMLVideoElement)
      // The direct file starves too: links are refreshed once, then the error screen.
      vi.advanceTimersByTime(STALL_MS)
      expect(services.api.item).toHaveBeenCalledTimes(2)
      await settle()
      expect(direct.load).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(STALL_MS)
      expect(vm.error).toBe(FAILED_MESSAGE)

      vm.retry()

      expect(vm.error).toBe('')
      expect(vm.fallback).toBe(false)
      expect(vm.buffering).toBe(true)
      expect(vm.usesManifest).toBe(true)
      expect(services.api.item).toHaveBeenCalledTimes(3)

      vm.attach(null)
      const again = fakeVideoElement()

      vm.attach(again as unknown as HTMLVideoElement)
      await settle()

      expect(FakeHls.last).not.toBe(hls)
      expect(FakeHls.last.attachMedia).toHaveBeenCalledWith(again)
      expect(FakeHls.last.config.startPosition).toBe(400)
    })
  })

  describe('remote keys', () => {
    it('on the pause screen: back leaves, a play key resumes, anything else shows the HUD', async () => {
      const back = await setup()

      back.el.fire('pause')
      vi.advanceTimersByTime(PAUSE_SCREEN_MS)
      expect(back.vm.pauseScreen).toBe(true)
      expect(back.onKey(key(RemoteKey.Back))).toBe(true)
      expect(back.vm.pauseScreen).toBe(false)
      expect(back.router.back).toHaveBeenCalledTimes(1)

      const play = await setup()

      play.el.fire('pause')
      vi.advanceTimersByTime(PAUSE_SCREEN_MS)
      expect(play.onKey(key(RemoteKey.Enter))).toBe(true)
      expect(play.el.play).toHaveBeenCalledTimes(1)
      expect(play.vm.pauseScreen).toBe(false)

      const other = await setup()

      other.el.fire('pause')
      vi.advanceTimersByTime(PAUSE_SCREEN_MS)
      expect(other.vm.hudVisible).toBe(false)
      expect(other.onKey(key(RemoteKey.Right))).toBe(true)
      expect(other.vm.hudVisible).toBe(true)
      expect(other.vm.pauseScreen).toBe(false)
      expect(other.vm.seekPreview).toBeNull()
    })

    it('on the error screen only back is handled', async () => {
      const { vm, el, hls, onKey, router } = await manifestPlaying()

      hls.fatal(FakeErrorTypes.MEDIA_ERROR)
      hls.fatal(FakeErrorTypes.MEDIA_ERROR)
      hls.fatal(FakeErrorTypes.MEDIA_ERROR)
      vi.advanceTimersByTime(STALL_MS)
      await settle()
      vi.advanceTimersByTime(STALL_MS)
      expect(vm.error).toBe(FAILED_MESSAGE)

      expect(onKey(key(RemoteKey.Enter))).toBe(false)
      expect(onKey(key(RemoteKey.PlayPause))).toBe(false)
      expect(el.play).not.toHaveBeenCalled()
      expect(onKey(key(RemoteKey.Back))).toBe(true)
      expect(router.back).toHaveBeenCalledTimes(1)
    })

    it('with a panel open back closes it and other keys go to the panel', async () => {
      const { vm, onKey } = await setup()

      vm.openEpisodes()

      expect(onKey(key(RemoteKey.Right))).toBe(false)
      expect(vm.panel).toBe('episodes')
      expect(vm.seekPreview).toBeNull()
      expect(onKey(key(RemoteKey.Back))).toBe(true)
      expect(vm.panel).toBeNull()
      expect(vm.hudTarget).toBe('episodes')
    })

    it('with the next-up card: back dismisses it during the credits and leaves after the end', async () => {
      const credits = await setup({ videoId: 102 })

      credits.el.duration = 2400
      credits.el.fire('durationchange')
      credits.el.currentTime = 2380
      credits.el.fire('timeupdate')
      expect(credits.vm.nextUp.phase).toBe('credits')
      expect(credits.onKey(key(RemoteKey.Right))).toBe(false)
      expect(credits.vm.seekPreview).toBeNull()
      expect(credits.onKey(key(RemoteKey.Back))).toBe(true)
      expect(credits.vm.nextUp.phase).toBe('hidden')
      expect(credits.router.back).not.toHaveBeenCalled()

      const ended = await setup({ videoId: 102 })

      ended.el.fire('ended')
      expect(ended.onKey(key(RemoteKey.Back))).toBe(true)
      expect(ended.router.back).toHaveBeenCalledTimes(1)
    })

    it('back leaves the player', async () => {
      const { onKey, router } = await setup()

      expect(onKey(key(0, 'Escape'))).toBe(true)
      expect(onKey(key(RemoteKey.Back))).toBe(true)
      expect(router.back).toHaveBeenCalledTimes(2)
    })

    it('Enter toggles playback only when the HUD is hidden', async () => {
      const { vm, el, onKey } = await setup()

      expect(onKey(key(RemoteKey.Enter))).toBe(false)
      expect(el.play).not.toHaveBeenCalled()

      vi.advanceTimersByTime(HUD_MS)
      expect(onKey(key(RemoteKey.Enter))).toBe(true)
      expect(el.play).toHaveBeenCalledTimes(1)
      expect(vm.hudVisible).toBe(true)
    })

    it('media keys always toggle, stop leaves, transport keys seek', async () => {
      const { vm, el, onKey, router } = await setup()

      el.currentTime = 100
      el.duration = 2400

      expect(onKey(key(RemoteKey.PlayPause))).toBe(true)
      expect(el.play).toHaveBeenCalledTimes(1)
      expect(onKey(key(RemoteKey.Pause))).toBe(true)
      expect(el.pause).toHaveBeenCalledTimes(1)
      expect(onKey(key(RemoteKey.Play))).toBe(true)
      expect(el.play).toHaveBeenCalledTimes(2)

      expect(onKey(key(RemoteKey.FastForward))).toBe(true)
      expect(vm.seekPreview).toBe(110)
      expect(onKey(key(RemoteKey.Rewind))).toBe(true)
      expect(vm.seekPreview).toBe(95)

      expect(onKey(key(RemoteKey.Stop))).toBe(true)
      expect(router.back).toHaveBeenCalledTimes(1)
    })

    it('arrows with the HUD visible keep it alive and let the focus library navigate', async () => {
      const { vm, onKey } = await setup()

      vi.advanceTimersByTime(HUD_MS - 1000)
      expect(onKey(key(RemoteKey.Right))).toBe(false)
      expect(onKey(key(RemoteKey.Down))).toBe(false)
      expect(vm.seekPreview).toBeNull()

      vi.advanceTimersByTime(HUD_MS - 1000)
      expect(vm.hudVisible).toBe(true)

      vi.advanceTimersByTime(1000)
      expect(vm.hudVisible).toBe(false)
    })

    it('arrows with the HUD hidden seek sideways and bring the bar up vertically', async () => {
      const { vm, el, onKey } = await setup()

      el.currentTime = 100
      el.duration = 2400
      vi.advanceTimersByTime(HUD_MS)

      expect(onKey(key(RemoteKey.Left))).toBe(true)
      expect(vm.seekPreview).toBe(90)
      expect(vm.hudVisible).toBe(true)

      vi.advanceTimersByTime(HUD_MS)
      expect(onKey(key(RemoteKey.Up))).toBe(true)
      expect(vm.hudVisible).toBe(true)
      expect(vm.hudTarget).toBe('bar')
    })

    it('unknown keys show the HUD without being handled', async () => {
      const { vm, onKey } = await setup()

      vi.advanceTimersByTime(HUD_MS)
      expect(onKey(key(RemoteKey.Red))).toBe(false)
      expect(vm.hudVisible).toBe(true)
    })

    it('any key press resets the autoplay chain so the still-watching prompt does not appear', async () => {
      const { el, onKey, router } = await setup({ videoId: 102, autoplayChain: 3 })

      onKey(key(RemoteKey.Red))
      el.fire('ended')
      vi.advanceTimersByTime(10000)

      expect(router.replace).toHaveBeenCalledWith('/item/7/play/103', { state: { autoplayChain: 1 } })
    })

    it('after three automatic episodes the still-watching prompt pauses instead of advancing', async () => {
      const { vm, el, router } = await setup({ videoId: 102, autoplayChain: 3 })

      el.fire('ended')
      vi.advanceTimersByTime(10000)

      expect(vm.nextUp.phase).toBe('still-watching')
      expect(el.pause).toHaveBeenCalled()
      expect(router.replace).not.toHaveBeenCalled()
    })
  })

  describe('dispose', () => {
    it('reports the position, releases the element, the stream and the remote, and stops timers', async () => {
      const { vm, el, hls, services, onKey, router } = await manifestPlaying()
      const invalidate = vi.spyOn(services.queryClient, 'invalidateQueries')

      el.currentTime = 90
      el.fire('timeupdate')
      vi.advanceTimersByTime(1000)
      vm.dispose()

      expect(services.api.markTime).toHaveBeenCalledTimes(2)
      expect(services.api.markTime).toHaveBeenLastCalledWith(ITEM_ID, 90, 2, 1)
      expect(el.listenerCount()).toBe(0)
      expect(hls.destroy).toHaveBeenCalledTimes(1)
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['home', 'continue'] })
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['item', ITEM_ID] })

      vi.advanceTimersByTime(HUD_MS + STALL_MS)
      expect(vm.hudVisible).toBe(true)
      expect(services.ui.toast).toBe('')

      window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: RemoteKey.Back }))
      expect(router.back).not.toHaveBeenCalled()
      expect(onKey).toBeTypeOf('function')
    })

    it('stops a pending countdown', async () => {
      const { vm, el, router } = await setup({ videoId: 102 })

      el.fire('ended')
      vm.dispose()
      vi.advanceTimersByTime(10000)

      expect(router.replace).not.toHaveBeenCalled()
    })
  })
})
