import type { ResizeRequest, ResizeResponse } from './image.worker'
// oxlint-disable-next-line import/default -- Vite virtual module: the worker is inlined into the bundle as a blob
import ImageWorker from './image.worker?worker&inline'

const CACHE_LIMIT = 40
const JPEG_QUALITY = 0.82
// Keep prefetched posters referenced so the browser doesn't drop their decoded copies.
const PREFETCH_LIMIT = 150
const PREFETCH_PARALLEL = 4

interface Job {
  resolve: (blob: Blob) => void
  reject: (error: Error) => void
}

export class ImageService {
  private worker: Worker | null = null
  private nextId = 0
  private readonly jobs = new Map<number, Job>()
  private readonly ready = new Map<string, string>()
  private readonly pending = new Map<string, Promise<string>>()
  private readonly prefetched = new Map<string, HTMLImageElement>()
  private readonly prefetchQueue: string[] = []
  private prefetchActive = 0

  resized(url: string, width: number): Promise<string> {
    const key = `${width}:${url}`
    const cached = this.ready.get(key)

    if (cached) {
      this.ready.delete(key)
      this.ready.set(key, cached)

      return Promise.resolve(cached)
    }

    const inFlight = this.pending.get(key)

    if (inFlight) return inFlight

    const promise = this.request({ url, width, quality: JPEG_QUALITY })
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob)

        this.remember(key, objectUrl)

        return objectUrl
      })
      .catch(() => url)
      .finally(() => this.pending.delete(key))

    this.pending.set(key, promise)

    return promise
  }

  // Decode ahead in idle time so a row scrolled into view rasterizes once with its posters, not twice.
  prefetch(urls: string[]) {
    for (const url of urls) {
      if (url && !this.prefetched.has(url) && !this.prefetchQueue.includes(url)) this.prefetchQueue.push(url)
    }

    this.pumpPrefetch()
  }

  private pumpPrefetch() {
    while (this.prefetchActive < PREFETCH_PARALLEL && this.prefetchQueue.length) {
      const url = this.prefetchQueue.shift()!

      this.prefetchActive++
      requestIdleCallback(() => {
        const image = new Image()

        image.decoding = 'async'
        image.src = url
        this.keepPrefetched(url, image)
        void image
          .decode()
          .catch(() => {})
          .finally(() => {
            this.prefetchActive--
            this.pumpPrefetch()
          })
      })
    }
  }

  private keepPrefetched(url: string, image: HTMLImageElement) {
    this.prefetched.set(url, image)
    while (this.prefetched.size > PREFETCH_LIMIT) this.prefetched.delete(this.prefetched.keys().next().value!)
  }

  private request(payload: Omit<ResizeRequest, 'id'>): Promise<Blob> {
    const worker = this.ensureWorker()

    if (!worker) return Promise.reject(new Error('Воркер недоступен'))

    const id = ++this.nextId

    return new Promise<Blob>((resolve, reject) => {
      this.jobs.set(id, { resolve, reject })
      // oxlint-disable-next-line unicorn/require-post-message-target-origin -- Worker.postMessage has no targetOrigin
      worker.postMessage({ id, ...payload } satisfies ResizeRequest)
    })
  }

  private ensureWorker(): Worker | null {
    if (this.worker) return this.worker

    try {
      this.worker = new ImageWorker()
      this.worker.addEventListener('message', (event: MessageEvent<ResizeResponse>) => this.onResult(event.data))
    } catch {
      this.worker = null
    }

    return this.worker
  }

  private onResult(response: ResizeResponse) {
    const job = this.jobs.get(response.id)

    if (!job) return

    this.jobs.delete(response.id)
    if ('blob' in response) job.resolve(response.blob)
    else job.reject(new Error(response.error))
  }

  private remember(key: string, objectUrl: string) {
    this.ready.set(key, objectUrl)
    while (this.ready.size > CACHE_LIMIT) {
      const [oldestKey, oldestUrl] = this.ready.entries().next().value!

      this.ready.delete(oldestKey)
      URL.revokeObjectURL(oldestUrl)
    }
  }
}
