/** Which included quota the Pro forecast chart and status bar follow. */
export type ForecastSeriesFocus = 'cursor' | 'other' | 'all'

const listeners = new Set<() => void>()
let focus: ForecastSeriesFocus = 'cursor'

export function forecastSeriesFocus(): ForecastSeriesFocus {
  return focus
}

export function parseForecastSeriesFocus(
  value: unknown,
): ForecastSeriesFocus | null {
  if (value === 'cursor' || value === 'other' || value === 'all') {
    return value
  }
  return null
}

export function setForecastSeriesFocus(next: ForecastSeriesFocus): void {
  if (focus === next) {
    return
  }
  focus = next
  for (const listener of listeners) {
    listener()
  }
}

export function onDidChangeForecastSeriesFocus(
  listener: () => void,
): { dispose(): void } {
  listeners.add(listener)
  return {
    dispose() {
      listeners.delete(listener)
    },
  }
}
