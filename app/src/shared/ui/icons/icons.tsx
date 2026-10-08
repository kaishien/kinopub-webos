import type { SVGProps } from 'react'

type Props = SVGProps<SVGSVGElement>

const base = (p: Props): Props => ({
  width: 36,
  height: 36,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  ...p,
})

export const IconHome = (p: Props) => (
  <svg {...base(p)}>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5 10v10h14V10" />
    <path d="M10 20v-6h4v6" />
  </svg>
)
export const IconSearch = (p: Props) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </svg>
)
export const IconPlay = (p: Props) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M7 4.5v15l12-7.5z" />
  </svg>
)
export const IconPause = (p: Props) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <rect x="6" y="4.5" width="4" height="15" rx="1" />
    <rect x="14" y="4.5" width="4" height="15" rx="1" />
  </svg>
)
export const IconFilm = (p: Props) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" />
  </svg>
)
export const IconSeries = (p: Props) => (
  <svg {...base(p)}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M8 21h8M12 18v3" />
    <path d="M8 2l4 4 4-4" />
  </svg>
)
export const IconBookmark = (p: Props) => (
  <svg {...base(p)}>
    <path d="M6 3h12v18l-6-4.5L6 21z" />
  </svg>
)
export const IconBookmarkFilled = (p: Props) => (
  <svg {...base(p)} fill="currentColor">
    <path d="M6 3h12v18l-6-4.5L6 21z" />
  </svg>
)
export const IconHistory = (p: Props) => (
  <svg {...base(p)}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
    <path d="M12 7v5l3 2" />
  </svg>
)
export const IconEye = (p: Props) => (
  <svg {...base(p)}>
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
export const IconCheck = (p: Props) => (
  <svg {...base(p)}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
)
export const IconStack = (p: Props) => (
  <svg {...base(p)}>
    <path d="m12 3 9 5-9 5-9-5z" />
    <path d="m3 12 9 5 9-5" />
    <path d="m3 16 9 5 9-5" />
  </svg>
)
export const IconTv = (p: Props) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="13" rx="2" />
    <path d="M8 21h8" />
    <path d="m9 9 5 2.5L9 14z" fill="currentColor" stroke="none" />
  </svg>
)
export const IconSettings = (p: Props) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
)
export const IconStar = (p: Props) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" />
  </svg>
)
export const IconSpark = (p: Props) => (
  <svg {...base(p)}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
  </svg>
)
export const IconNext = (p: Props) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M5 5v14l9-7z" />
    <rect x="16" y="5" width="3" height="14" rx="1" />
  </svg>
)
export const IconSound = (p: Props) => (
  <svg {...base(p)}>
    <path d="M4 9v6h4l5 4V5L8 9z" />
    <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
  </svg>
)
export const IconSubs = (p: Props) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M7 12h5M14 12h3M7 15.5h3M12 15.5h5" />
  </svg>
)
export const IconRefresh = (p: Props) => (
  <svg {...base(p)}>
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <path d="M21 4v5h-5" />
  </svg>
)
export const IconNew = (p: Props) => (
  <svg {...base(p)}>
    <path d="M12 2.5l2 3.6 4-.9-1 4 3.5 2.3-3.5 2.3 1 4-4-.9-2 3.6-2-3.6-4 .9 1-4L3.5 11.5 7 9.2l-1-4 4 .9z" />
    <path d="M9.5 14.5v-5l5 5v-5" />
  </svg>
)
export const IconAnime = (p: Props) => (
  <svg {...base(p)}>
    <path d="M3 12c0-5 4-9 9-9s9 4 9 9-4 9-9 9-9-4-9-9z" />
    <path d="M7 8c2 1 5 1 7-1M6.5 12.5c1 1.5 2 2 3 2M14 14.5c1 0 2-.5 3-2" />
    <circle cx="9" cy="10.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="10.5" r="1" fill="currentColor" stroke="none" />
  </svg>
)
export const IconMusic = (p: Props) => (
  <svg {...base(p)}>
    <path d="M9 18V6l11-2v12" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="17" cy="16" r="3" />
  </svg>
)
export const IconDoc = (p: Props) => (
  <svg {...base(p)}>
    <path d="M6 3h8l5 5v13H6z" />
    <path d="M14 3v5h5M9 13h6M9 17h6" />
  </svg>
)
export const IconDocs = (p: Props) => (
  <svg {...base(p)}>
    <path d="M8 6h7l4 4v11H8z" />
    <path d="M15 6v4h4M5 18V3h9" />
  </svg>
)
export const IconShow = (p: Props) => (
  <svg {...base(p)}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M7 7 10 3M17 7l-3-4" />
    <path d="M8 12h5M8 16h8" />
  </svg>
)
export const IconBall = (p: Props) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="m12 7 4 3-1.5 5h-5L8 10z" />
    <path d="M12 3v4M16 10l4-1M14.5 15l2.5 3.5M9.5 15 7 18.5M8 10 4 9" />
  </svg>
)
export const IconUhd = (p: Props) => (
  <svg {...base(p)}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M7 10v4M7 12h3M10 10v4M14 10v4h2a2 2 0 0 0 0-4z" />
  </svg>
)
export const Icon3d = (p: Props) => (
  <svg {...base(p)}>
    <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" />
    <path d="M12 12 20 7.5M12 12v9M12 12 4 7.5" />
  </svg>
)
export const IconBell = (p: Props) => (
  <svg {...base(p)}>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" />
    <path d="M10 21h4" />
  </svg>
)
export const IconChevronDown = (p: Props) => (
  <svg {...base(p)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
)
export const IconSort = (p: Props) => (
  <svg {...base(p)}>
    <path d="M4 7h11M4 12h7M4 17h4M17 5v14m0 0-3-3m3 3 3-3" />
  </svg>
)
export const IconFilter = (p: Props) => (
  <svg {...base(p)}>
    <path d="M4 5h16l-6 7.5V19l-4 1.5v-8z" />
  </svg>
)
