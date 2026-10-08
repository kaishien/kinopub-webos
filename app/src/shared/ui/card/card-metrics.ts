// Must match the variables in `app/styles/global.css`: the virtualizer lays items out itself and needs sizes up front.
export const CARD_GAP = 28

export const POSTER = { width: 232, height: 420 } as const

export const WIDE = { width: 400, height: 300 } as const

export const POSTER_BARE = { width: 232, height: 348 } as const
export const WIDE_BARE = { width: 400, height: 225 } as const

/** Must match `--hero-h`. */
export const HERO_HEIGHT = 310

/** Screen width minus the rail and the left gutter. */
export const ROW_VIEWPORT = 1920 - 112 - 80

export const SCREEN_HEIGHT = 1080
