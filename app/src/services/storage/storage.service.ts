const PREFIX = 'kp:'

export class StorageService {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(PREFIX + key)
      return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
      return fallback
    }
  }

  set(key: string, value: unknown) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value))
    } catch {
      /* quota exceeded or storage unavailable */
    }
  }

  remove(key: string) {
    try {
      localStorage.removeItem(PREFIX + key)
    } catch {
      /* ignore */
    }
  }
}
