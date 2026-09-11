/** How daily budget and month-pace forecasts spread the remaining cycle. */
export type BudgetDayBasis = 'workingDays' | 'calendarDays'

export const DEFAULT_BUDGET_DAY_BASIS: BudgetDayBasis = 'workingDays'

export function parseBudgetDayBasis(value: unknown): BudgetDayBasis {
  return value === 'calendarDays' ? 'calendarDays' : 'workingDays'
}
