// Must match the variables in `app/styles/global.css`: the virtualizer lays items out itself and needs sizes up front.
export const CARD_GAP = 28

export const POSTER = { width: 232, height: 420 } as const

export const WIDE = { width: 400, height: 300 } as const

export const POSTER_BARE = { width: 232, height: 348 } as const

/** Poster plus the `--rank-w` gutter for the Top-10 number. */
export const RANK_GUTTER = 112
export const POSTER_RANKED = { width: POSTER.width + RANK_GUTTER, height: POSTER.height } as const
export const POSTER_RANKED_BARE = { width: POSTER_BARE.width + RANK_GUTTER, height: POSTER_BARE.height } as const
export const WIDE_BARE = { width: 400, height: 225 } as const

/** Must match `--hero-h`. */
export const HERO_HEIGHT = 310

/** Screen width minus the rail and the left gutter. */
export const ROW_VIEWPORT = 1920 - 112 - 80

/** A row stops with its last card this far from the screen edge: room for the focus scale and TV overscan. */
export const ROW_END_GUTTER = 80

export const SCREEN_HEIGHT = 1080

/** Content width of a full-page grid: the screen minus the rail and both gutters. */
export const GRID_WIDTH = 1920 - 112 - 80 * 2

/** Card size that makes `columns` cards fill the grid width; the image keeps its aspect, the caption keeps its height. */
export function gridCard(columns: number, wide: boolean, caption: boolean) {
  const [full, bare] = wide ? [WIDE, WIDE_BARE] : [POSTER, POSTER_BARE]
  const width = Math.floor((GRID_WIDTH - CARD_GAP * (columns - 1)) / columns)
  const imageHeight = Math.round((width * bare.height) / bare.width)

  return { width, imageHeight, height: imageHeight + (caption ? full.height - bare.height : 0) }
}
