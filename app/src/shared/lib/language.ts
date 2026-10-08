/** Kinopub uses ISO 639-2 (`rus`, `ger`, `fre`); Intl.DisplayNames needs ISO 639-1. */
const ISO2: Record<string, string> = {
  rus: 'ru',
  eng: 'en',
  ukr: 'uk',
  ger: 'de',
  deu: 'de',
  fre: 'fr',
  fra: 'fr',
  spa: 'es',
  ita: 'it',
  por: 'pt',
  pol: 'pl',
  cze: 'cs',
  ces: 'cs',
  slo: 'sk',
  slk: 'sk',
  slv: 'sl',
  hrv: 'hr',
  srp: 'sr',
  bul: 'bg',
  rum: 'ro',
  ron: 'ro',
  hun: 'hu',
  gre: 'el',
  ell: 'el',
  tur: 'tr',
  heb: 'he',
  ara: 'ar',
  per: 'fa',
  fas: 'fa',
  hin: 'hi',
  chi: 'zh',
  zho: 'zh',
  jpn: 'ja',
  kor: 'ko',
  vie: 'vi',
  tha: 'th',
  ind: 'id',
  may: 'ms',
  msa: 'ms',
  dut: 'nl',
  nld: 'nl',
  dan: 'da',
  swe: 'sv',
  nor: 'no',
  fin: 'fi',
  est: 'et',
  lav: 'lv',
  lit: 'lt',
  ice: 'is',
  isl: 'is',
  geo: 'ka',
  kat: 'ka',
  arm: 'hy',
  hye: 'hy',
  kaz: 'kk',
  bel: 'be',
  aze: 'az',
  uzb: 'uz',
}

const names = (() => {
  try {
    return new Intl.DisplayNames(['ru'], { type: 'language' })
  } catch {
    return null
  }
})()

export function languageName(code: string): string {
  const iso = ISO2[code.toLowerCase()] ?? code
  const name = names?.of(iso)

  if (!name || name === iso) return code

  return name[0].toUpperCase() + name.slice(1)
}
