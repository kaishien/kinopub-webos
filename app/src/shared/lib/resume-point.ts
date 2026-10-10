import type { Video } from '@/services/api/api.types'

/** Where to resume: a watched video starts over, and so does one stopped within its first minute. */
export function resumePoint(video: Video): number {
  const time = video.watching?.time ?? 0

  return video.watched !== 1 && time > 60 ? time : 0
}
