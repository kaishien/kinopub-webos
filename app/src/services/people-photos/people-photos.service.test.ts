import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { findPhoto, PeoplePhotosService, type PersonPhoto } from './people-photos.service'

type FetchMock = Mock<typeof fetch>

interface WikidataEntity {
  labels?: { ru?: { value: string } }
  claims?: Record<string, { mainsnak: { datavalue?: { value: unknown } } }[]>
}

const json = (body: unknown, status = 200): Response =>
  ({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) }) as Response

const idClaim = (id: string) => ({ mainsnak: { datavalue: { value: { id } } } })
const fileClaim = (file: string) => ({ mainsnak: { datavalue: { value: file } } })
const person = (name: string, file?: string): WikidataEntity => ({
  labels: { ru: { value: name } },
  claims: file ? { P18: [fileClaim(file)] } : {},
})

function paramsOf(fetchMock: FetchMock, call: number) {
  const url = new URL(String(fetchMock.mock.calls[call][0]))

  return Object.fromEntries(url.searchParams)
}

/** Routes Wikidata calls by action: `search` answers the film lookup, `entities` answers wbgetentities by id. */
function wikidata(fetchMock: FetchMock, search: string[], entities: Record<string, WikidataEntity>) {
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const params = new URL(String(input)).searchParams

    if (params.get('list') === 'search') return Promise.resolve(json({ query: { search: search.map((title) => ({ title })) } }))

    const ids = params.get('ids')!.split('|')

    return Promise.resolve(json({ entities: Object.fromEntries(ids.filter((id) => id in entities).map((id) => [id, entities[id]])) }))
  })
}

describe('PeoplePhotosService.byImdb', () => {
  let fetchMock: FetchMock

  beforeEach(() => {
    fetchMock = vi.fn() as FetchMock
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('looks the film up by a zero-padded IMDb id', async () => {
    wikidata(fetchMock, [], {})

    await new PeoplePhotosService().byImdb(1234)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/^https:\/\/www\.wikidata\.org\/w\/api\.php\?format=json&origin=\*&/)
    expect(paramsOf(fetchMock, 0)).toMatchObject({
      action: 'query',
      list: 'search',
      srlimit: '1',
      srsearch: 'haswbstatement:P345=tt0001234',
    })
  })

  it('does not pad ids that already have seven or more digits', async () => {
    wikidata(fetchMock, [], {})

    await new PeoplePhotosService().byImdb(12345678)

    expect(paramsOf(fetchMock, 0).srsearch).toBe('haswbstatement:P345=tt12345678')
  })

  it('returns an empty list when Wikidata does not know the film', async () => {
    wikidata(fetchMock, [], {})

    await expect(new PeoplePhotosService().byImdb(1)).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('collects directors then cast and builds Commons thumbnail urls', async () => {
    wikidata(fetchMock, ['Q100'], {
      Q100: { claims: { P57: [idClaim('Q1')], P161: [idClaim('Q2'), idClaim('Q3'), idClaim('Q4')] } },
      Q1: person('Кристофер Нолан', 'Christopher Nolan.jpg'),
      Q2: person('Леонардо Ди Каприо', 'Leo & Co.jpg'),
      Q3: person('Без фото'),
      Q4: { claims: { P18: [fileClaim('No label.jpg')] } },
    })

    const photos = await new PeoplePhotosService().byImdb(1375666)

    expect(photos).toEqual([
      { name: 'Кристофер Нолан', url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Christopher%20Nolan.jpg?width=240' },
      { name: 'Леонардо Ди Каприо', url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Leo%20%26%20Co.jpg?width=240' },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(paramsOf(fetchMock, 1)).toMatchObject({ action: 'wbgetentities', ids: 'Q100', props: 'claims', languages: 'ru' })
    expect(paramsOf(fetchMock, 2)).toMatchObject({ action: 'wbgetentities', ids: 'Q1|Q2|Q3|Q4', props: 'labels|claims', languages: 'ru' })
  })

  it('handles a film entity without people claims', async () => {
    wikidata(fetchMock, ['Q100'], { Q100: { claims: {} } })

    await expect(new PeoplePhotosService().byImdb(1)).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('fetches people in batches of 50 and caps them at 100', async () => {
    const ids = Array.from({ length: 120 }, (_, index) => `Q${index + 1}`)
    const people = Object.fromEntries(ids.map((id) => [id, person(`Person ${id}`, `${id}.jpg`)]))

    wikidata(fetchMock, ['Q0'], { Q0: { claims: { P161: ids.map(idClaim) } }, ...people })

    const photos = await new PeoplePhotosService().byImdb(1)

    expect(photos).toHaveLength(100)
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(paramsOf(fetchMock, 2).ids.split('|')).toEqual(ids.slice(0, 50))
    expect(paramsOf(fetchMock, 3).ids.split('|')).toEqual(ids.slice(50, 100))
  })

  it('throws on a non-ok Wikidata response', async () => {
    fetchMock.mockResolvedValue(json({}, 503))

    await expect(new PeoplePhotosService().byImdb(1)).rejects.toThrow('Wikidata: HTTP 503')
  })

  it('passes the abort signal to every fetch', async () => {
    const controller = new AbortController()

    wikidata(fetchMock, ['Q100'], { Q100: { claims: { P57: [idClaim('Q1')] } }, Q1: person('A', 'a.jpg') })
    await new PeoplePhotosService().byImdb(1, controller.signal)

    expect(fetchMock.mock.calls.every(([, init]) => init?.signal === controller.signal)).toBe(true)
  })
})

describe('findPhoto', () => {
  const photos: PersonPhoto[] = [
    { name: 'Алисе Брага', url: 'braga.jpg' },
    { name: 'Уилл Смит', url: 'smith.jpg' },
    { name: 'Семён Трескунов', url: 'treskunov.jpg' },
  ]

  it('matches names exactly, ignoring case, ё and punctuation', () => {
    expect(findPhoto('Уилл Смит', photos)).toBe('smith.jpg')
    expect(findPhoto('уилл  смит', photos)).toBe('smith.jpg')
    expect(findPhoto('Семен Трескунов', photos)).toBe('treskunov.jpg')
    expect(findPhoto('Уилл Смит-мл.', photos)).toBeUndefined()
  })

  it('tolerates a transliteration difference in the first name', () => {
    expect(findPhoto('Алиси Брага', photos)).toBe('braga.jpg')
  })

  it('tolerates a single letter difference in the surname', () => {
    expect(findPhoto('Уилл Смитт', photos)).toBe('smith.jpg')
  })

  it('does not match a different first initial or a very different name', () => {
    expect(findPhoto('Элис Брага', photos)).toBeUndefined()
    expect(findPhoto('Уилл Смирнов', photos)).toBeUndefined()
    expect(findPhoto('Алиса Брагина', photos)).toBeUndefined()
  })

  it('prefers an exact match over a close one', () => {
    const both: PersonPhoto[] = [
      { name: 'Анна Иванов', url: 'close.jpg' },
      { name: 'Анна Иванова', url: 'exact.jpg' },
    ]

    expect(findPhoto('Анна Иванова', both)).toBe('exact.jpg')
  })

  it('returns undefined for empty or punctuation-only names', () => {
    expect(findPhoto('', photos)).toBeUndefined()
    expect(findPhoto(' - ', photos)).toBeUndefined()
    expect(findPhoto('Кто-то', [])).toBeUndefined()
  })
})
