import {
  DEFAULT_BUDGET_DAY_BASIS,
  type BudgetDayBasis,
} from './budgetDayBasis'

function isWeekend(year: number, month: number, day: number): boolean {
  const weekday = new Date(year, month, day).getDay()
  return weekday === 0 || weekday === 6
}

function lastDateOfMonth(from: Date): number {
  return new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate()
}

/** Mon–Fri remaining including today (local TZ). At least 1 when only weekend remains. */
export function workingDaysLeftInMonth(from: Date): number {
  const year = from.getFullYear()
  const month = from.getMonth()
  const lastDate = lastDateOfMonth(from)
  const start = from.getDate()
  let count = 0
  for (let day = start; day <= lastDate; day++) {
    if (isWeekend(year, month, day)) {
      continue
    }
    count += 1
  }
  return Math.max(1, count)
}

/** Mon–Fri from the 1st through today (local TZ). Weekends are 0. */
export function workingDaysElapsedInMonth(from: Date): number {
  const year = from.getFullYear()
  const month = from.getMonth()
  const today = from.getDate()
  let count = 0
  for (let day = 1; day <= today; day++) {
    if (isWeekend(year, month, day)) {
      continue
    }
    count += 1
  }
  return count
}

export function calendarDaysLeftInMonth(from: Date): number {
  return Math.max(1, lastDateOfMonth(from) - from.getDate() + 1)
}

export function calendarDaysElapsedInMonth(from: Date): number {
  return from.getDate()
}

export function calendarDaysInMonth(from: Date): number {
  return lastDateOfMonth(from)
}

export function calendarDaysAfterToday(from: Date): number {
  return Math.max(0, lastDateOfMonth(from) - from.getDate())
}

export function budgetDaysLeftInMonth(
  from: Date,
  basis: BudgetDayBasis = DEFAULT_BUDGET_DAY_BASIS,
): number {
  if (basis === 'calendarDays') {
    return calendarDaysLeftInMonth(from)
  }
  return workingDaysLeftInMonth(from)
}

export function budgetDaysElapsedInMonth(
  from: Date,
  basis: BudgetDayBasis = DEFAULT_BUDGET_DAY_BASIS,
): number {
  if (basis === 'calendarDays') {
    return calendarDaysElapsedInMonth(from)
  }
  return workingDaysElapsedInMonth(from)
}

export function budgetDaysInMonth(
  from: Date,
  basis: BudgetDayBasis = DEFAULT_BUDGET_DAY_BASIS,
): number {
  if (basis === 'calendarDays') {
    return calendarDaysInMonth(from)
  }
  const year = from.getFullYear()
  const month = from.getMonth()
  const last = lastDateOfMonth(from)
  let count = 0
  for (let day = 1; day <= last; day++) {
    if (isWeekend(year, month, day)) {
      continue
    }
    count += 1
  }
  return count
}

export function budgetDaysAfterToday(
  from: Date,
  basis: BudgetDayBasis = DEFAULT_BUDGET_DAY_BASIS,
): number {
  if (basis === 'calendarDays') {
    return calendarDaysAfterToday(from)
  }
  const year = from.getFullYear()
  const month = from.getMonth()
  const last = lastDateOfMonth(from)
  let count = 0
  for (let day = from.getDate() + 1; day <= last; day++) {
    if (isWeekend(year, month, day)) {
      continue
    }
    count += 1
  }
  return count
}
