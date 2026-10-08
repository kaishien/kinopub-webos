/// <reference lib="webworker" />

// Kinopub wide frames come in 4K; decoding them on the TV's main thread causes a noticeable stall.
export interface ResizeRequest {
  id: number
  url: string
  width: number
  quality: number
}

export type ResizeResponse = { id: number; blob: Blob } | { id: number; error: string }

declare const self: DedicatedWorkerGlobalScope

self.addEventListener('message', (event: MessageEvent<ResizeRequest>) => {
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- worker postMessage takes no targetOrigin
  void resize(event.data).then((response) => self.postMessage(response))
})

async function resize({ id, url, width, quality }: ResizeRequest): Promise<ResizeResponse> {
  try {
    const response = await fetch(url)

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const bitmap = await createImageBitmap(await response.blob(), { resizeWidth: width, resizeQuality: 'medium' })
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)

    canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
    bitmap.close()

    return { id, blob: await canvas.convertToBlob({ type: 'image/jpeg', quality }) }
  } catch (error) {
    return { id, error: error instanceof Error ? error.message : String(error) }
  }
}
