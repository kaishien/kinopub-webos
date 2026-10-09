const WIKIDATA_API = 'https://www.wikidata.org/w/api.php?format=json&origin=*&'
const COMMONS_FILE = 'https://commons.wikimedia.org/wiki/Special:FilePath/'
/** wbgetentities accepts at most 50 ids per request. */
const ENTITY_BATCH = 50
const PEOPLE_LIMIT = 100
const PHOTO_WIDTH = 240

export interface PersonPhoto {
  /** Russian label from Wikidata; spelling may differ from Kinopub's. */
  name: string
  url: string
}

interface Claim {
  mainsnak: { datavalue?: { value: unknown } }
}

interface Entity {
  labels?: { ru?: { value: string } }
  claims?: Record<string, Claim[]>
}

export class PeoplePhotosService {
  async byImdb(imdb: number, signal?: AbortSignal): Promise<PersonPhoto[]> {
    const imdbId = `tt${String(imdb).padStart(7, '0')}`
    const search = await this.request<{ query: { search: { title: string }[] } }>(
      { action: 'query', list: 'search', srlimit: '1', srsearch: `haswbstatement:P345=${imdbId}` },
      signal,
    )
    const film = search.query.search[0]?.title

    if (!film) return []

    const filmEntity = (await this.entities([film], 'claims', signal))[film]
    const people = [...entityIds(filmEntity, 'P57'), ...entityIds(filmEntity, 'P161')].slice(0, PEOPLE_LIMIT)
    const photos: PersonPhoto[] = []

    for (let start = 0; start < people.length; start += ENTITY_BATCH) {
      const batch = await this.entities(people.slice(start, start + ENTITY_BATCH), 'labels|claims', signal)

      for (const entity of Object.values(batch)) {
        const name = entity.labels?.ru?.value
        const file = entity.claims?.P18?.[0]?.mainsnak.datavalue?.value

        if (name && typeof file === 'string') photos.push({ name, url: `${COMMONS_FILE}${encodeURIComponent(file)}?width=${PHOTO_WIDTH}` })
      }
    }

    return photos
  }

  private async entities(ids: string[], props: string, signal?: AbortSignal): Promise<Record<string, Entity>> {
    const response = await this.request<{ entities: Record<string, Entity> }>(
      { action: 'wbgetentities', ids: ids.join('|'), props, languages: 'ru' },
      signal,
    )

    return response.entities
  }

  private async request<T>(params: Record<string, string>, signal?: AbortSignal): Promise<T> {
    const response = await fetch(WIKIDATA_API + new URLSearchParams(params).toString(), { signal })

    if (!response.ok) throw new Error(`Wikidata: HTTP ${response.status}`)

    return (await response.json()) as T
  }
}

function entityIds(entity: Entity | undefined, property: string): string[] {
  return (entity?.claims?.[property] ?? [])
    .map((claim) => (claim.mainsnak.datavalue?.value as { id?: string } | undefined)?.id)
    .filter((id): id is string => !!id)
}

/** Kinopub and Wikidata transliterate foreign names differently («Алиси Брага» / «Алисе Брага»), so names match loosely. */
export function findPhoto(name: string, photos: PersonPhoto[]): string | undefined {
  const wanted = normalize(name)

  if (!wanted) return undefined

  const exact = photos.find((photo) => normalize(photo.name) === wanted)

  if (exact) return exact.url

  return photos.find((photo) => isClose(normalize(photo.name), wanted))?.url
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Same surname and first initial, and only a couple of letters different overall. */
function isClose(a: string, b: string): boolean {
  const wordsA = a.split(' ')
  const wordsB = b.split(' ')
  const lastA = wordsA[wordsA.length - 1]
  const lastB = wordsB[wordsB.length - 1]

  if (wordsA[0][0] !== wordsB[0][0]) return false

  return distance(lastA, lastB) <= 1 && distance(a, b) <= 3
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index)

  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0]

    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const above = row[j]

      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1))
      diagonal = above
    }
  }

  return row[b.length]
}
