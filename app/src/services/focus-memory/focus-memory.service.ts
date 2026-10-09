interface ScreenMemory {
  focusKey?: string
  offsets: Map<string, number>
  /** Screen-specific state that must survive a remount on Back, e.g. catalog filters. */
  state: Map<string, unknown>
}

// Lists are virtualized: without restoring scroll offsets the remembered item isn't rendered yet on return.
export class FocusMemoryService {
  private readonly screens = new Map<string, ScreenMemory>()

  save(locationKey: string, focusKey: string) {
    this.screen(locationKey).focusKey = focusKey
  }

  restore(locationKey: string): string | undefined {
    return this.screens.get(locationKey)?.focusKey
  }

  saveOffset(locationKey: string, areaKey: string, offset: number) {
    this.screen(locationKey).offsets.set(areaKey, offset)
  }

  offset(locationKey: string, areaKey: string): number {
    return this.screens.get(locationKey)?.offsets.get(areaKey) ?? 0
  }

  saveState(locationKey: string, key: string, value: unknown) {
    this.screen(locationKey).state.set(key, value)
  }

  state<T>(locationKey: string, key: string): T | undefined {
    return this.screens.get(locationKey)?.state.get(key) as T | undefined
  }

  private screen(locationKey: string): ScreenMemory {
    let screen = this.screens.get(locationKey)

    if (!screen) {
      screen = { offsets: new Map(), state: new Map() }
      this.screens.set(locationKey, screen)
    }

    return screen
  }
}
