import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResizeRequest, ResizeResponse } from './image.worker'
import { ImageService } from './image.service'

const workerState = vi.hoisted(() => ({
  /** Answers a resize request; return null to leave the job pending. */
  respond: (_request: ResizeRequest): ResizeResponse | null => null,
  failConstruction: false,
  posted: [] as ResizeRequest[],
  instances: 0,
}))

vi.mock('./image.worker?worker&inline', () => {
  class FakeWorker {
    private readonly listeners: Array<(event: MessageEvent<ResizeResponse>) => void> = []

    constructor() {
      if (workerState.failConstruction) throw new Error('no workers here')

      workerState.instances++
    }

    addEventListener(_type: 'message', listener: (event: MessageEvent<ResizeResponse>) => void) {
      this.listeners.push(listener)
    }

    postMessage(request: ResizeRequest) {
      workerState.posted.push(request)
      const response = workerState.respond(request)

      if (!response) return

      queueMicrotask(() => this.listeners.forEach((listener) => listener({ data: response } as MessageEvent<ResizeResponse>)))
    }
  }

  return { default: FakeWorker }
})

const ok = (request: ResizeRequest): ResizeResponse => ({ id: request.id, blob: new Blob([request.url]) })
const fail = (request: ResizeRequest): ResizeResponse => ({ id: request.id, error: 'HTTP 404' })

/** Resolves once the worker's microtask reply and the service's promise chain have run. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('ImageService', () => {
  let createObjectURL: ReturnType<typeof vi.fn<(blob: Blob) => string>>
  let revokeObjectURL: ReturnType<typeof vi.fn<(url: string) => void>>

  beforeEach(() => {
    let next = 0

    workerState.respond = ok
    workerState.failConstruction = false
    workerState.posted = []
    workerState.instances = 0
    createObjectURL = vi.fn((blob: Blob) => `blob:${blob.size}:${next++}`)
    revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('resized', () => {
    it('asks the worker for a JPEG of the requested width and returns an object url', async () => {
      const service = new ImageService()

      await expect(service.resized('https://img/a.jpg', 300)).resolves.toMatch(/^blob:17:0$/)

      expect(workerState.posted).toEqual([{ id: 1, url: 'https://img/a.jpg', width: 300, quality: 0.82 }])
      expect(createObjectURL).toHaveBeenCalledTimes(1)
    })

    it('creates a single worker lazily and reuses it', async () => {
      const service = new ImageService()

      expect(workerState.instances).toBe(0)
      await service.resized('a', 100)
      await service.resized('b', 100)

      expect(workerState.instances).toBe(1)
    })

    it('serves repeated requests from the cache without asking the worker again', async () => {
      const service = new ImageService()

      const first = await service.resized('a', 100)
      const second = await service.resized('a', 100)

      expect(second).toBe(first)
      expect(workerState.posted).toHaveLength(1)
    })

    it('caches per width', async () => {
      const service = new ImageService()

      await service.resized('a', 100)
      await service.resized('a', 200)

      expect(workerState.posted.map((request) => request.width)).toEqual([100, 200])
    })

    it('dedupes in-flight requests for the same key', async () => {
      const service = new ImageService()

      workerState.respond = () => null
      const first = service.resized('a', 100)
      const second = service.resized('a', 100)

      expect(second).toBe(first)
      expect(workerState.posted).toHaveLength(1)
    })

    it('falls back to the original url when the worker reports an error', async () => {
      const service = new ImageService()

      workerState.respond = fail

      await expect(service.resized('https://img/missing.jpg', 100)).resolves.toBe('https://img/missing.jpg')
      expect(createObjectURL).not.toHaveBeenCalled()
    })

    it('does not cache failures, so the next call tries again', async () => {
      const service = new ImageService()

      workerState.respond = fail
      await service.resized('a', 100)
      workerState.respond = ok

      await expect(service.resized('a', 100)).resolves.toMatch(/^blob:/)
      expect(workerState.posted).toHaveLength(2)
    })

    it('falls back to the original url when the worker cannot be created', async () => {
      workerState.failConstruction = true
      const service = new ImageService()

      await expect(service.resized('a', 100)).resolves.toBe('a')
      expect(workerState.posted).toHaveLength(0)
    })

    it('ignores replies for unknown jobs', async () => {
      const service = new ImageService()

      workerState.respond = (request) => ({ id: request.id + 100, blob: new Blob() })
      const pending = service.resized('a', 100)

      workerState.respond = ok
      await settle()
      await expect(Promise.race([pending, Promise.resolve('still pending')])).resolves.toBe('still pending')
    })

    it('revokes the least recently used object url once the cache exceeds 40 entries', async () => {
      const service = new ImageService()

      for (let i = 0; i < 40; i++) await service.resized(`u${i}`, 100)
      expect(revokeObjectURL).not.toHaveBeenCalled()

      const first = await service.resized('u0', 100)

      expect(createObjectURL).toHaveBeenCalledTimes(40)

      await service.resized('u40', 100)

      expect(revokeObjectURL).toHaveBeenCalledTimes(1)
      expect(revokeObjectURL).not.toHaveBeenCalledWith(first)

      await service.resized('u1', 100)
      expect(workerState.posted).toHaveLength(42)
    })
  })

  describe('prefetch', () => {
    let idleCallbacks: Array<() => void>
    let decode: ReturnType<typeof vi.fn<() => Promise<void>>>
    let decodeResolvers: Array<() => void>
    let created: HTMLImageElement[]

    beforeEach(() => {
      idleCallbacks = []
      decodeResolvers = []
      created = []
      decode = vi.fn(() => new Promise<void>((resolve) => decodeResolvers.push(resolve)))
      vi.stubGlobal('requestIdleCallback', (callback: () => void) => {
        idleCallbacks.push(callback)

        return idleCallbacks.length
      })
      Object.defineProperty(HTMLImageElement.prototype, 'decode', { value: decode, configurable: true, writable: true })
      const RealImage = Image

      vi.stubGlobal(
        'Image',
        class extends RealImage {
          constructor() {
            super()
            created.push(this)
          }
        },
      )
    })

    afterEach(() => {
      Reflect.deleteProperty(HTMLImageElement.prototype, 'decode')
    })

    const runIdle = () => idleCallbacks.splice(0).forEach((callback) => callback())

    it('decodes at most four posters at a time in idle callbacks', async () => {
      const service = new ImageService()
      const urls = ['a', 'b', 'c', 'd', 'e', 'f']

      service.prefetch(urls)
      expect(idleCallbacks).toHaveLength(4)

      runIdle()
      expect(created.map((image) => image.src)).toEqual(['a', 'b', 'c', 'd'].map((url) => `http://localhost:3000/${url}`))
      expect(created.every((image) => image.decoding === 'async')).toBe(true)
      expect(decode).toHaveBeenCalledTimes(4)
      expect(idleCallbacks).toHaveLength(0)

      decodeResolvers.splice(0, 2).forEach((resolve) => resolve())
      await settle()
      expect(idleCallbacks).toHaveLength(2)

      runIdle()
      expect(decode).toHaveBeenCalledTimes(6)
    })

    it('skips empty urls, duplicates and urls already prefetched', async () => {
      const service = new ImageService()

      service.prefetch(['a', '', 'a', 'b'])
      runIdle()
      decodeResolvers.splice(0).forEach((resolve) => resolve())
      await settle()

      service.prefetch(['a', 'b', 'c'])
      runIdle()

      expect(created.map((image) => image.src.replace('http://localhost:3000/', ''))).toEqual(['a', 'b', 'c'])
    })

    it('does not schedule a queued url twice while it waits', () => {
      const service = new ImageService()

      service.prefetch(['a', 'b', 'c', 'd', 'e'])
      service.prefetch(['e', 'f'])
      runIdle()
      decodeResolvers.splice(0).forEach((resolve) => resolve())

      return settle().then(() => {
        runIdle()
        expect(created.map((image) => image.src.replace('http://localhost:3000/', ''))).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
      })
    })

    it('keeps going when decoding fails', async () => {
      const service = new ImageService()

      decode.mockImplementation(() => Promise.reject(new Error('EncodingError')))
      service.prefetch(['a', 'b', 'c', 'd', 'e'])
      runIdle()
      await settle()

      expect(idleCallbacks).toHaveLength(1)
    })
  })
})
