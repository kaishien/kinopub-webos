import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImageService } from '@/services/images/image.service'
import { UiService } from '@/services/ui/ui.service'
import { BackdropViewModel } from './backdrop.view-model'

const DWELL_MS = 450

class FakeImage {
  static decoded: string[] = []
  src = ''

  decode() {
    FakeImage.decoded.push(this.src)

    return Promise.resolve()
  }
}

/** Flushes the promise chain inside `load` under fake timers. */
const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

describe('BackdropViewModel', () => {
  let ui: UiService
  let images: ImageService & { resized: ReturnType<typeof vi.fn> }
  const realImage = globalThis.Image

  beforeEach(() => {
    vi.useFakeTimers()
    FakeImage.decoded = []
    globalThis.Image = FakeImage as unknown as typeof Image
    ui = new UiService()
    images = { resized: vi.fn((url: string, width: number) => Promise.resolve(`${url}?w=${width}`)), prefetch: vi.fn() } as never
  })

  afterEach(() => {
    globalThis.Image = realImage
  })

  it('starts blank and does not request anything without a backdrop', async () => {
    const vm = new BackdropViewModel(ui, images)

    vi.advanceTimersByTime(DWELL_MS * 2)
    await settle()
    expect(vm.layers).toEqual(['', ''])
    expect(vm.top).toBe(0)
    expect(images.resized).not.toHaveBeenCalled()
    vm.dispose()
  })

  it('loads the resized frame only after focus dwells and shows it on the other layer', async () => {
    const vm = new BackdropViewModel(ui, images)

    ui.setBackdrop('https://cdn/a.jpg')
    vi.advanceTimersByTime(DWELL_MS - 1)
    expect(images.resized).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(images.resized).toHaveBeenCalledWith('https://cdn/a.jpg', 1280)
    await settle()
    expect(FakeImage.decoded).toEqual(['https://cdn/a.jpg?w=1280'])
    expect(vm.top).toBe(1)
    expect(vm.layers).toEqual(['', 'https://cdn/a.jpg?w=1280'])

    ui.setBackdrop('https://cdn/b.jpg')
    vi.advanceTimersByTime(DWELL_MS)
    await settle()
    expect(vm.top).toBe(0)
    expect(vm.layers).toEqual(['https://cdn/b.jpg?w=1280', 'https://cdn/a.jpg?w=1280'])
    vm.dispose()
  })

  it('skips frames the focus scrolled past before the dwell', async () => {
    const vm = new BackdropViewModel(ui, images)

    ui.setBackdrop('https://cdn/a.jpg')
    vi.advanceTimersByTime(200)
    ui.setBackdrop('https://cdn/b.jpg')
    vi.advanceTimersByTime(200)
    ui.setBackdrop('https://cdn/c.jpg')
    vi.advanceTimersByTime(DWELL_MS)
    await settle()
    expect(images.resized).toHaveBeenCalledTimes(1)
    expect(images.resized).toHaveBeenCalledWith('https://cdn/c.jpg', 1280)
    expect(vm.layers[vm.top]).toBe('https://cdn/c.jpg?w=1280')
    vm.dispose()
  })

  it('drops a loaded frame when the wanted backdrop changed meanwhile', async () => {
    let resolveA!: (src: string) => void

    images.resized.mockImplementationOnce(() => new Promise<string>((resolve) => (resolveA = resolve)))
    const vm = new BackdropViewModel(ui, images)

    ui.setBackdrop('https://cdn/a.jpg')
    vi.advanceTimersByTime(DWELL_MS)
    ui.setBackdrop('https://cdn/b.jpg')
    resolveA('https://cdn/a.jpg?w=1280')
    await settle()
    expect(vm.layers).toEqual(['', ''])

    vi.advanceTimersByTime(DWELL_MS)
    await settle()
    expect(vm.layers[vm.top]).toBe('https://cdn/b.jpg?w=1280')
    vm.dispose()
  })

  it('keeps the current layer when the same frame is wanted again', async () => {
    const vm = new BackdropViewModel(ui, images)

    ui.setBackdrop('https://cdn/a.jpg')
    vi.advanceTimersByTime(DWELL_MS)
    await settle()
    expect(vm.top).toBe(1)

    ui.setBackdrop('')
    ui.setBackdrop('https://cdn/a.jpg')
    vi.advanceTimersByTime(DWELL_MS)
    await settle()
    expect(vm.top).toBe(1)
    expect(vm.layers).toEqual(['', 'https://cdn/a.jpg?w=1280'])
    vm.dispose()
  })

  it('clearing the backdrop cancels a pending load but leaves the shown frame', async () => {
    const vm = new BackdropViewModel(ui, images)

    ui.setBackdrop('https://cdn/a.jpg')
    vi.advanceTimersByTime(DWELL_MS)
    await settle()
    ui.setBackdrop('https://cdn/b.jpg')
    vi.advanceTimersByTime(100)
    ui.clearBackdrop()
    vi.advanceTimersByTime(DWELL_MS)
    await settle()
    expect(images.resized).toHaveBeenCalledTimes(1)
    expect(vm.layers[vm.top]).toBe('https://cdn/a.jpg?w=1280')
    vm.dispose()
  })

  it('stops reacting after dispose', async () => {
    const vm = new BackdropViewModel(ui, images)

    ui.setBackdrop('https://cdn/a.jpg')
    vm.dispose()
    vi.advanceTimersByTime(DWELL_MS)
    ui.setBackdrop('https://cdn/b.jpg')
    vi.advanceTimersByTime(DWELL_MS)
    await settle()
    expect(images.resized).not.toHaveBeenCalled()
  })
})
