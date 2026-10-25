export type CodexForecastPoint = {
  date: string
  weekday: boolean
  workingDayIndex: number
  allowanceUsd: number | null
  dayAllowanceUsd: number | null
}

export type CodexWindowChart = {
  points: CodexForecastPoint[]
  day: (number | null)[]
  used: (number | null)[]
  forecast: (number | null | [number, number])[]
  ideal: (number | null)[]
  runOutDate: string | null
  resetDate: string | null
  resetMidday: boolean
}

export function buildCodexWindowChart(input: {
  pace: {
    kind?: string
    unit?: string
    used?: number | null
    dailyPace?: number | null
    over?: boolean
    asOfMs?: number
    windowStartMs?: number
    resetsAtMs?: number
  }
  series?: {
    kind?: string
    windowMinutes?: number | null
    resetsAt?: number | null
    points?: { timestamp?: number; usedPercent?: number }[]
  }[]
  dayRange: { from: number; to: number } | null
}): CodexWindowChart | null
