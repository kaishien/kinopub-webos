import { describe, expect, it } from 'vitest'
import { StorageService } from '@/services/storage/storage.service'
import { TrackMemoryService } from './track-memory.service'

describe('TrackMemoryService', () => {
  it('remembers audio and subtitle choices per item and persists them', () => {
    const storage = new StorageService()
    const memory = new TrackMemoryService(storage)

    memory.rememberAudio(1, 'LostFilm')
    memory.rememberSubtitle(1, null)

    expect(memory.get(1)).toEqual({ audio: 'LostFilm', subtitle: null })
    expect(memory.get(2)).toEqual({})
    expect(new TrackMemoryService(storage).get(1)).toEqual({ audio: 'LostFilm', subtitle: null })
  })
})
