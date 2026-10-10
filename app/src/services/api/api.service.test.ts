import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { API_HOSTS, ApiError, ApiService, CLIENT_ID } from './api.service'

type FetchMock = Mock<typeof fetch>

function reply(body: unknown, status = 200): Response {
  const text = typeof body === 'string' ? body : JSON.stringify(body)

  return { ok: status >= 200 && status < 300, status, text: () => Promise.resolve(text) } as Response
}

/** A fetch that never answers on its own but rejects when its signal is aborted, like a real stalled request. */
const hangingFetch = (_: RequestInfo | URL, init?: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
  })

const networkError = () => new TypeError('Failed to fetch')

function calledUrls(fetchMock: FetchMock) {
  return fetchMock.mock.calls.map(([url]) => String(url))
}

function lastInit(fetchMock: FetchMock) {
  return fetchMock.mock.calls[fetchMock.mock.calls.length - 1][1]
}

describe('ApiService', () => {
  let fetchMock: FetchMock

  beforeEach(() => {
    fetchMock = vi.fn() as FetchMock
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('query string', () => {
    it('encodes params, drops empty ones and appends the access token for authenticated calls', async () => {
      const api = new ApiService()

      api.setToken('tok en')
      fetchMock.mockResolvedValue(reply({ ok: true }))

      await api.request('/v1/x', { a: 1, b: 'two words', c: undefined, d: null, e: '', f: true, 'g h': 'ы' })

      expect(calledUrls(fetchMock)[0]).toBe(`${API_HOSTS[0]}/v1/x?a=1&b=two%20words&f=true&g%20h=%D1%8B&access_token=tok%20en`)
    })

    it('omits the access token when auth is off or no token is set', async () => {
      const api = new ApiService()

      fetchMock.mockResolvedValue(reply({}))
      await api.request('/v1/public', { a: 1 }, { auth: false })
      api.setToken('t')
      await api.request('/v1/public', { a: 1 }, { auth: false })
      api.setToken(null)
      await api.request('/v1/public', { a: 1 })

      expect(calledUrls(fetchMock)).toEqual(Array(3).fill(`${API_HOSTS[0]}/v1/public?a=1`))
    })

    it('produces no query string when every param is empty', async () => {
      const api = new ApiService()

      fetchMock.mockResolvedValue(reply({}))
      await api.request('/v1/user', { a: undefined })

      expect(calledUrls(fetchMock)[0]).toBe(`${API_HOSTS[0]}/v1/user`)
    })

    it('uses GET by default and POST when asked', async () => {
      const api = new ApiService()

      fetchMock.mockResolvedValue(reply({}))
      await api.request('/v1/a')
      expect(lastInit(fetchMock)?.method).toBe('GET')

      await api.request('/v1/b', {}, { method: 'POST' })
      expect(lastInit(fetchMock)?.method).toBe('POST')
    })
  })

  describe('host failover', () => {
    it('tries hosts in order and sticks to the one that answered', async () => {
      const api = new ApiService()

      fetchMock
        .mockRejectedValueOnce(networkError())
        .mockRejectedValueOnce(networkError())
        .mockResolvedValue(reply({ ok: 1 }))

      await expect(api.request('/v1/a')).resolves.toEqual({ ok: 1 })
      expect(calledUrls(fetchMock)).toEqual([`${API_HOSTS[0]}/v1/a`, `${API_HOSTS[1]}/v1/a`, `${API_HOSTS[2]}/v1/a`])
      expect(api.currentHost).toBe(API_HOSTS[2])

      await api.request('/v1/b')
      expect(calledUrls(fetchMock)[3]).toBe(`${API_HOSTS[2]}/v1/b`)
    })

    it('wraps around to the first hosts after the current one', async () => {
      const api = new ApiService()

      api.setPreferredHost(API_HOSTS[4])
      fetchMock.mockRejectedValueOnce(networkError()).mockResolvedValue(reply({}))
      await api.request('/v1/a')

      expect(calledUrls(fetchMock)).toEqual([`${API_HOSTS[4]}/v1/a`, `${API_HOSTS[0]}/v1/a`])
      expect(api.currentHost).toBe(API_HOSTS[0])
    })

    it('puts the preferred host first and resets to the default order when cleared', async () => {
      const api = new ApiService()

      api.setPreferredHost(API_HOSTS[3])
      expect(api.currentHost).toBe(API_HOSTS[3])

      api.setPreferredHost(null)
      expect(api.currentHost).toBe(API_HOSTS[0])

      fetchMock.mockResolvedValue(reply({}))
      api.setPreferredHost('https://custom.example')
      await api.request('/v1/a')
      expect(calledUrls(fetchMock)[0]).toBe('https://custom.example/v1/a')
    })

    it('sticks to a host that answered with an HTTP error too', async () => {
      const api = new ApiService()

      fetchMock.mockRejectedValueOnce(networkError()).mockResolvedValue(reply({ error: 'nope' }, 404))

      await expect(api.request('/v1/a')).rejects.toBeInstanceOf(ApiError)
      expect(api.currentHost).toBe(API_HOSTS[1])
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('fails with a network ApiError once every host is exhausted', async () => {
      const api = new ApiService()
      const cause = networkError()

      fetchMock.mockRejectedValue(cause)

      const error = await api.request('/v1/a').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(ApiError)
      expect(error).toMatchObject({ status: 0, isNetwork: true, isAuth: false, message: 'Сервер не отвечает', body: cause })
      expect(fetchMock).toHaveBeenCalledTimes(API_HOSTS.length)
      expect(api.currentHost).toBe(API_HOSTS[0])
    })
  })

  describe('timeouts and aborts', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    it('aborts a stalled request after 8 seconds and moves to the next host', async () => {
      const api = new ApiService()

      fetchMock.mockImplementationOnce(hangingFetch).mockResolvedValue(reply({ ok: 1 }))

      const promise = api.request('/v1/a')

      await vi.advanceTimersByTimeAsync(7999)
      expect(fetchMock).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(1)
      await expect(promise).resolves.toEqual({ ok: 1 })
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true)
      expect(api.currentHost).toBe(API_HOSTS[1])
    })

    it('rethrows the abort error without failing over when the outer signal is aborted', async () => {
      const api = new ApiService()
      const controller = new AbortController()

      fetchMock.mockImplementation(hangingFetch)

      const promise = api.request('/v1/a', {}, { signal: controller.signal })

      await vi.advanceTimersByTimeAsync(100)
      controller.abort()

      const error = await promise.catch((e: unknown) => e)

      expect(error).toBeInstanceOf(DOMException)
      expect((error as DOMException).name).toBe('AbortError')
      expect(error).not.toBeInstanceOf(ApiError)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(api.currentHost).toBe(API_HOSTS[0])
    })

    it('clears the timeout after a successful response', async () => {
      const api = new ApiService()

      fetchMock.mockResolvedValue(reply({}))
      await api.request('/v1/a')

      expect(vi.getTimerCount()).toBe(0)
    })
  })

  describe('401 handling', () => {
    it('asks onUnauthorized and retries once when it succeeds', async () => {
      const api = new ApiService()

      api.setToken('old')
      api.onUnauthorized = vi.fn(async () => {
        api.setToken('new')

        return true
      })
      fetchMock.mockResolvedValueOnce(reply({ error: 'expired' }, 401)).mockResolvedValue(reply({ user: 1 }))

      await expect(api.request('/v1/user')).resolves.toEqual({ user: 1 })
      expect(api.onUnauthorized).toHaveBeenCalledTimes(1)
      expect(calledUrls(fetchMock)).toEqual([`${API_HOSTS[0]}/v1/user?access_token=old`, `${API_HOSTS[0]}/v1/user?access_token=new`])
    })

    it('retries only once: a second 401 is thrown', async () => {
      const api = new ApiService()

      api.onUnauthorized = vi.fn(() => Promise.resolve(true))
      fetchMock.mockResolvedValue(reply({ error: 'expired' }, 401))

      const error = await api.request('/v1/user').catch((e: unknown) => e)

      expect(error).toMatchObject({ status: 401, isAuth: true })
      expect(api.onUnauthorized).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('throws the 401 when onUnauthorized fails or is not set', async () => {
      const api = new ApiService()

      fetchMock.mockResolvedValue(reply({ error: 'expired' }, 401))
      await expect(api.request('/v1/user')).rejects.toMatchObject({ status: 401 })

      api.onUnauthorized = vi.fn(() => Promise.resolve(false))
      await expect(api.request('/v1/user')).rejects.toMatchObject({ status: 401 })
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('does not refresh for unauthenticated calls', async () => {
      const api = new ApiService()

      api.onUnauthorized = vi.fn(() => Promise.resolve(true))
      fetchMock.mockResolvedValue(reply({ error: 'invalid_grant' }, 401))

      await expect(api.request('/oauth2/token', {}, { auth: false })).rejects.toMatchObject({ status: 401 })
      expect(api.onUnauthorized).not.toHaveBeenCalled()
    })
  })

  describe('error bodies', () => {
    it('prefers error_description, then message, then error, then the HTTP status', async () => {
      const api = new ApiService()

      fetchMock
        .mockResolvedValueOnce(reply({ error: 'e', message: 'm', error_description: 'desc' }, 400))
        .mockResolvedValueOnce(reply({ error: 'e', message: 'm' }, 400))
        .mockResolvedValueOnce(reply({ error: 'e' }, 400))
        .mockResolvedValueOnce(reply({}, 500))
        .mockResolvedValueOnce(reply('<html>gateway</html>', 502))
        .mockResolvedValueOnce(reply('', 503))

      const messages: string[] = []
      const bodies: unknown[] = []

      for (let i = 0; i < 6; i++) {
        const error = (await api.request('/v1/a').catch((e: unknown) => e)) as ApiError

        messages.push(error.message)
        bodies.push(error.body)
      }

      expect(messages).toEqual(['desc', 'm', 'e', 'HTTP 500', 'HTTP 502', 'HTTP 503'])
      expect(bodies[0]).toEqual({ error: 'e', message: 'm', error_description: 'desc' })
      expect(bodies[4]).toBe('<html>gateway</html>')
      expect(bodies[5]).toBeNull()
    })

    it('returns null for an empty successful body and raw text for a non-JSON one', async () => {
      const api = new ApiService()

      fetchMock.mockResolvedValueOnce(reply('')).mockResolvedValueOnce(reply('plain'))

      await expect(api.request('/v1/a')).resolves.toBeNull()
      await expect(api.request('/v1/a')).resolves.toBe('plain')
    })
  })

  describe('form bodies', () => {
    it('sends form fields as URLSearchParams in the body, not in the query', async () => {
      const api = new ApiService()

      api.setToken('t')
      fetchMock.mockResolvedValue(reply({ settings: { a: 1 } }))

      await expect(api.saveDeviceSettings(5, { supportSsl: 1, mixedPlaylist: 0 } as never)).resolves.toEqual({ a: 1 })

      const init = lastInit(fetchMock)
      const body = init?.body

      expect(calledUrls(fetchMock)[0]).toBe(`${API_HOSTS[0]}/v1/device/5/settings?access_token=t`)
      expect(init?.method).toBe('POST')
      expect(body).toBeInstanceOf(URLSearchParams)
      expect(String(body)).toBe('supportSsl=1&mixedPlaylist=0')
    })

    it('sends no body for plain requests', async () => {
      const api = new ApiService()

      fetchMock.mockResolvedValue(reply({}))
      await api.request('/v1/a', {}, { method: 'POST' })

      expect(lastInit(fetchMock)?.body).toBeUndefined()
    })
  })

  describe('endpoints', () => {
    const host = API_HOSTS[0]
    let api: ApiService

    beforeEach(() => {
      api = new ApiService()
      api.setToken('t')
    })

    it('item() requests links and unwraps the item', async () => {
      fetchMock.mockResolvedValue(reply({ item: { id: 7 } }))

      await expect(api.item(7)).resolves.toEqual({ id: 7 })
      expect(calledUrls(fetchMock)[0]).toBe(`${host}/v1/items/7?nolinks=0&access_token=t`)
    })

    it('shelf() asks for 24 items of a kind and unwraps them', async () => {
      fetchMock.mockResolvedValue(reply({ items: [{ id: 1 }] }))

      await expect(api.shelf('hot', 'movie')).resolves.toEqual([{ id: 1 }])
      expect(calledUrls(fetchMock)[0]).toBe(`${host}/v1/items/hot?type=movie&perpage=24&access_token=t`)
    })

    it('markTime() floors the time and passes video and season', async () => {
      fetchMock.mockResolvedValue(reply({}))

      await api.markTime(1, 12.7, 3, 2)
      await api.markTime(1, 5)

      expect(calledUrls(fetchMock)).toEqual([
        `${host}/v1/watching/marktime?id=1&time=12&video=3&season=2&access_token=t`,
        `${host}/v1/watching/marktime?id=1&time=5&access_token=t`,
      ])
    })

    it('toggleBookmark() posts the item and folder', async () => {
      fetchMock.mockResolvedValue(reply({ status: 1 }))

      await expect(api.toggleBookmark(10, 20)).resolves.toEqual({ status: 1 })
      expect(calledUrls(fetchMock)[0]).toBe(`${host}/v1/bookmarks/toggle-item?item=10&folder=20&access_token=t`)
      expect(lastInit(fetchMock)?.method).toBe('POST')
    })

    it('search() searches titles, 36 per page, unsectioned', async () => {
      fetchMock.mockResolvedValue(reply({ items: [], pagination: {} }))

      await api.search('матрица', 2)

      expect(calledUrls(fetchMock)[0]).toBe(
        `${host}/v1/items/search?q=%D0%BC%D0%B0%D1%82%D1%80%D0%B8%D1%86%D0%B0&field=title&page=2&perpage=36&sectioned=0&access_token=t`,
      )
    })

    it('byPerson() searches by role', async () => {
      fetchMock.mockResolvedValue(reply({ items: [], pagination: {} }))

      await api.byPerson('director', 'Nolan', 1)

      expect(calledUrls(fetchMock)[0]).toBe(`${host}/v1/items/search?q=Nolan&field=director&page=1&perpage=36&sectioned=0&access_token=t`)
    })

    it('history() pages 36 at a time', async () => {
      fetchMock.mockResolvedValue(reply({ history: [] }))

      await api.history(3)

      expect(calledUrls(fetchMock)[0]).toBe(`${host}/v1/history?page=3&perpage=36&access_token=t`)
    })

    it('items() applies the default page size but lets params override it', async () => {
      fetchMock.mockResolvedValue(reply({ items: [] }))

      await api.items({ type: 'movie', year: '2010-2019', genre: undefined, page: 2 })

      expect(calledUrls(fetchMock)[0]).toBe(`${host}/v1/items?perpage=36&type=movie&year=2010-2019&page=2&access_token=t`)
    })

    it('oauth calls are unauthenticated POSTs with the client credentials', async () => {
      fetchMock.mockResolvedValue(reply({ code: 'c' }))

      await api.requestDeviceCode()
      await api.pollDeviceToken('abc')
      await api.refreshToken('r1')

      const urls = calledUrls(fetchMock)

      expect(urls[0]).toContain(`${host}/oauth2/device?grant_type=device_code&client_id=${CLIENT_ID}&client_secret=`)
      expect(urls[0]).not.toContain('access_token')
      expect(urls[1]).toContain('grant_type=device_token')
      expect(urls[1]).toContain('&code=abc')
      expect(urls[2]).toContain(`${host}/oauth2/token?grant_type=refresh_token`)
      expect(urls[2]).toContain('refresh_token=r1')
      expect(fetchMock.mock.calls.every(([, init]) => init?.method === 'POST')).toBe(true)
    })

    it('refreshToken() never triggers onUnauthorized even on 401', async () => {
      api.onUnauthorized = vi.fn(() => Promise.resolve(true))
      fetchMock.mockResolvedValue(reply({ error: 'invalid_grant' }, 401))

      await expect(api.refreshToken('r')).rejects.toMatchObject({ status: 401 })
      expect(api.onUnauthorized).not.toHaveBeenCalled()
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('unwraps nested payloads of the simple getters', async () => {
      fetchMock
        .mockResolvedValueOnce(reply({ user: { username: 'u' } }))
        .mockResolvedValueOnce(reply({ device: { id: 1 } }))
        .mockResolvedValueOnce(reply({ items: [{ id: 2 }] }))
        .mockResolvedValueOnce(reply({ channels: [{ id: 3 }] }))
        .mockResolvedValueOnce(reply({ folders: [{ id: 4 }] }))

      await expect(api.user()).resolves.toEqual({ username: 'u' })
      await expect(api.device()).resolves.toEqual({ id: 1 })
      await expect(api.similar(9)).resolves.toEqual([{ id: 2 }])
      await expect(api.tvChannels()).resolves.toEqual([{ id: 3 }])
      await expect(api.itemBookmarkFolders(5)).resolves.toEqual([{ id: 4 }])
      expect(calledUrls(fetchMock)[2]).toBe(`${host}/v1/items/similar?id=9&access_token=t`)
      expect(calledUrls(fetchMock)[4]).toBe(`${host}/v1/bookmarks/get-item-folders?item=5&access_token=t`)
    })

    it('detaches from the caller signal once the request has completed', async () => {
      const controller = new AbortController()

      fetchMock.mockResolvedValue(reply({ user: {} }))
      await api.user(controller.signal)

      const signal = lastInit(fetchMock)?.signal

      expect(signal).toBeInstanceOf(AbortSignal)
      expect(signal?.aborted).toBe(false)
      controller.abort()
      expect(signal?.aborted).toBe(false)
    })
  })
})
