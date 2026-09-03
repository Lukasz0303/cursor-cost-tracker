import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  asFiniteNumber,
  buildUsageReady,
  centsToUsd,
  isPersonalMonthlyPool,
  isTeamSpendPlan,
  isUnlimited,
  mapEventToQuery,
  mapEventsPayload,
  pickUsagePool,
  readBillingPoolLines,
  readIncludedQuotas,
  spendDisplayFor,
  stripModelPrefix,
} from '../src/usage/parse'

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

function loadJson(name: string): unknown {
  return JSON.parse(readFileSync(join(fixtures, name), 'utf8')) as unknown
}

describe('centsToUsd', () => {
  it('divides by 100', () => {
    expect(centsToUsd(379)).toBe(3.79)
  })

  it('guards NaN and Infinity as 0', () => {
    expect(centsToUsd(Number.NaN)).toBe(0)
    expect(centsToUsd(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('asFiniteNumber', () => {
  it('parses numeric strings from unofficial JSON', () => {
    expect(asFiniteNumber('12856')).toBe(12856)
  })

  it('rejects empty and non-numeric strings', () => {
    expect(asFiniteNumber('')).toBeNull()
    expect(asFiniteNumber('n/a')).toBeNull()
  })
})

describe('pickUsagePool', () => {
  it('prefers individual onDemand over plan when onDemand has a cap', () => {
    const pool = pickUsagePool(loadJson('usage-summary.sample.json'))
    expect(pool?.source).toBe('individualOnDemand')
    expect(pool?.usedCents).toBe(379)
    expect(pool?.limitCents).toBe(25000)
  })

  it('skips team onDemand when limitType is user', () => {
    const pool = pickUsagePool(loadJson('usage-summary.sample.json'))
    expect(pool?.source).not.toBe('teamOnDemand')
  })

  it('keeps uncapped onDemand instead of falling through to plan', () => {
    const pool = pickUsagePool({
      isUnlimited: false,
      individualUsage: {
        plan: { enabled: true, used: 1200, limit: 20000, remaining: 18800 },
        onDemand: { enabled: true, used: 2309, limit: null, remaining: null },
      },
    })
    expect(pool?.source).toBe('individualOnDemand')
    expect(pool?.usedCents).toBe(2309)
    expect(pool?.limitCents).toBeNull()
  })

  it('skips org-sized enterprise pools so Current stays the personal $250 cap', () => {
    const pool = pickUsagePool(loadJson('usage-summary.enterprise.json'))
    expect(pool?.source).toBe('overall')
    expect(pool?.usedCents).toBe(1346)
    expect(pool?.limitCents).toBe(25000)
  })

  it('never selects teamUsage.pooled', () => {
    const pool = pickUsagePool({
      membershipType: 'enterprise',
      limitType: 'team',
      teamUsage: {
        pooled: { enabled: true, used: 0, limit: 2_480_000, remaining: 2_480_000 },
        onDemand: { enabled: true, used: 0, limit: 2_480_000, remaining: 2_480_000 },
      },
      individualUsage: {
        overall: { enabled: true, used: 1346, limit: 25000, remaining: 23654 },
      },
    })
    expect(pool?.source).toBe('overall')
  })

  it('skips disabled onDemand', () => {
    const pool = pickUsagePool({
      individualUsage: {
        plan: { used: 500, limit: 1000, remaining: 500 },
        onDemand: { enabled: false, used: 1, limit: 2, remaining: 1 },
      },
    })
    expect(pool?.source).toBe('plan')
  })

  it('uses overall when other pools are missing', () => {
    const pool = pickUsagePool({
      individualUsage: {
        overall: { used: 50, limit: 100, remaining: 50 },
      },
    })
    expect(pool?.source).toBe('overall')
  })

  it('returns null for garbage summary', () => {
    expect(pickUsagePool(null)).toBeNull()
    expect(pickUsagePool('nope')).toBeNull()
    expect(pickUsagePool({})).toBeNull()
  })
})

describe('isPersonalMonthlyPool', () => {
  it('rejects a pool whose limit is above $10,000 in cents', () => {
    expect(
      isPersonalMonthlyPool({
        enabled: true,
        used: 0,
        limit: 2_480_000,
        remaining: 2_480_000,
      }),
    ).toBe(false)
  })

  it('accepts the typical $250 personal cap', () => {
    expect(
      isPersonalMonthlyPool({
        enabled: true,
        used: 1346,
        limit: 25000,
        remaining: 23654,
      }),
    ).toBe(true)
  })
})

describe('isUnlimited', () => {
  it('is true when the summary flag is set', () => {
    expect(isUnlimited(null, { isUnlimited: true })).toBe(true)
  })

  it('is true when the selected pool has no cap', () => {
    expect(
      isUnlimited({
        usedCents: 0,
        limitCents: null,
        remainingCents: null,
        source: 'individualOnDemand',
      }),
    ).toBe(true)
  })

  it('is false for a metered pool', () => {
    expect(
      isUnlimited({
        usedCents: 379,
        limitCents: 25000,
        remainingCents: 24621,
        source: 'plan',
      }),
    ).toBe(false)
  })
})

describe('mapEventToQuery', () => {
  it('reads chargedCents first', () => {
    const query = mapEventToQuery({
      timestamp: 1_756_718_712_000,
      model: 'default',
      kind: 'USAGE_EVENT_KIND_INCLUDED_IN_BUSINESS',
      chargedCents: 3,
      tokenUsage: { inputTokens: 10, outputTokens: 2, totalCents: 99 },
    })
    expect(query?.costUsd).toBe(0.03)
    expect(query?.inputTokens).toBe(10)
    expect(query?.outputTokens).toBe(2)
    expect(query?.tokens).toBe(12)
  })

  it('falls back to tokenUsage.totalCents then usageBasedCosts', () => {
    const fromCents = mapEventToQuery({
      timestamp: 1,
      tokenUsage: { totalCents: 121, inputTokens: 1, outputTokens: 1 },
    })
    expect(fromCents?.costUsd).toBe(1.21)

    const fromString = mapEventToQuery({
      timestamp: 1,
      usageBasedCosts: '$0.45',
      tokenUsage: { inputTokens: 1, outputTokens: 0 },
    })
    expect(fromString?.costUsd).toBe(0.45)
  })

  it('adds cache read and write into tokens but keeps input/output raw', () => {
    const query = mapEventToQuery({
      timestamp: 1,
      tokenUsage: {
        inputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 10,
        cacheWriteTokens: 20,
      },
    })
    expect(query?.tokens).toBe(180)
    expect(query?.inputTokens).toBe(100)
    expect(query?.outputTokens).toBe(50)
    expect(query?.cacheReadTokens).toBe(10)
    expect(query?.cacheWriteTokens).toBe(20)
  })

  it('keeps a zero-cost row when tokens exist', () => {
    const query = mapEventToQuery({
      timestamp: 1,
      chargedCents: 0,
      tokenUsage: { inputTokens: 5, outputTokens: 1 },
    })
    expect(query?.costUsd).toBe(0)
    expect(query?.tokens).toBe(6)
  })

  it('drops garbage objects', () => {
    expect(mapEventToQuery(null)).toBeNull()
    expect(mapEventToQuery({ model: 'x', chargedCents: 1 })).toBeNull()
    expect(mapEventToQuery('event')).toBeNull()
  })
})

describe('mapEventsPayload', () => {
  it('maps the anonymized fixture and drops rows without a timestamp', () => {
    const queries = mapEventsPayload(loadJson('usage-events.sample.json'))
    expect(queries).toHaveLength(3)
    expect(queries.every((row) => row.timestamp > 0)).toBe(true)
    expect(queries[0]?.timestamp).toBeGreaterThan(queries[1]?.timestamp ?? 0)
  })

  it('returns empty for empty events', () => {
    expect(mapEventsPayload({ usageEventsDisplay: [] })).toEqual([])
    expect(mapEventsPayload([])).toEqual([])
  })
})

describe('included quotas', () => {
  it('treats personal Pro as percent and team as dollars', () => {
    const pro = loadJson('usage-summary.sample.json')
    expect(isTeamSpendPlan(pro, 'pro')).toBe(false)
    expect(spendDisplayFor(pro, 'pro')).toBe('percent')
    expect(isTeamSpendPlan({ limitType: 'team' }, 'business')).toBe(true)
    expect(spendDisplayFor({ limitType: 'team', membershipType: 'business' }, 'business')).toBe(
      'usd',
    )
  })

  it('prefers dashboard autoPercentUsed over plan used/limit', () => {
    expect(
      readIncludedQuotas({
        individualUsage: {
          plan: {
            used: 2000,
            limit: 2000,
            remaining: 0,
            autoPercentUsed: 8.4,
            apiPercentUsed: 0,
          },
        },
      }),
    ).toEqual([
      { name: 'Cursor Models', used: 8.4, limit: 100, percent: 8 },
      { name: 'Other Models', used: 0, limit: 100, percent: 0 },
    ])
  })

  it('reads Cursor Models from plan used/limit when dashboard percents are missing', () => {
    expect(readIncludedQuotas(loadJson('usage-summary.sample.json'))).toEqual([
      { name: 'Cursor Models', used: 1200, limit: 20000, percent: 6 },
    ])
    expect(
      readIncludedQuotas({
        individualUsage: {
          plan: { used: 1400, limit: 20000 },
          otherModels: { used: 0, limit: 100 },
        },
      }),
    ).toEqual([
      { name: 'Cursor Models', used: 1400, limit: 20000, percent: 7 },
      { name: 'Other Models', used: 0, limit: 100, percent: 0 },
    ])
  })

  it('reads percents from dashboard display messages when plan bars are missing', () => {
    expect(
      readIncludedQuotas({
        autoModelSelectedDisplayMessage: "You've used 8% of your included total usage",
        namedModelSelectedDisplayMessage: "You've used 0% of your included API usage",
      }),
    ).toEqual([
      { name: 'Cursor Models', used: 8, limit: 100, percent: 8 },
      { name: 'Other Models', used: 0, limit: 100, percent: 0 },
    ])
  })

  it('uses an explicit percentUsed when used/limit are missing', () => {
    expect(
      readIncludedQuotas({
        individualUsage: {
          plan: { percentUsed: 7 },
        },
      }),
    ).toEqual([{ name: 'Cursor Models', used: 0, limit: 100, percent: 7 }])
  })
})

describe('stripModelPrefix', () => {
  it('drops a leading cursor- only', () => {
    expect(stripModelPrefix('cursor-default')).toBe('default')
    expect(stripModelPrefix('claude-cursor-fast')).toBe('claude-cursor-fast')
    expect(stripModelPrefix(null)).toBeNull()
  })
})

describe('buildUsageReady', () => {
  it('composes pool dollars, queries, and billing metadata from fixtures', () => {
    const now = new Date(2026, 8, 1, 12, 0, 0)
    const ready = buildUsageReady({
      summary: loadJson('usage-summary.sample.json'),
      events: loadJson('usage-events.sample.json'),
      now,
      email: null,
    })
    expect(ready.usedUsd).toBe(3.79)
    expect(ready.limitUsd).toBe(250)
    expect(ready.plan).toBe('pro')
    expect(ready.spendDisplay).toBe('percent')
    expect(ready.includedQuotas).toEqual([
      { name: 'Cursor Models', used: 1200, limit: 20000, percent: 6 },
    ])
    expect(ready.isUnlimited).toBe(false)
    expect(ready.billingCycleStart).toBe('2026-08-01T00:00:00.000Z')
    expect(ready.billingCycleEnd).toBe('2026-09-01T00:00:00.000Z')
    expect(ready.recentQueries).toHaveLength(3)
    expect(ready.email).toBeNull()
    expect(ready.onDemandLine).toBe('3.79 $ / 250.00 $')
  })

  it('keeps dollar spend display for a team / company plan', () => {
    const ready = buildUsageReady({
      summary: {
        membershipType: 'business',
        limitType: 'team',
        individualUsage: {
          onDemand: { used: 2000, limit: 2000, remaining: 0 },
        },
      },
      events: { usageEventsDisplay: [] },
      now: new Date(2026, 8, 1),
    })
    expect(ready.spendDisplay).toBe('usd')
    expect(ready.usedUsd).toBe(20)
    expect(ready.limitUsd).toBe(20)
    expect(ready.includedQuotas).toEqual([])
  })

  it('drops Pro-style quota percents on Business / Enterprise even if the summary carries them', () => {
    const ready = buildUsageReady({
      summary: {
        membershipType: 'enterprise',
        limitType: 'team',
        individualUsage: {
          onDemand: { used: 1346, limit: 25000, remaining: 23654 },
          plan: {
            used: 2000,
            limit: 2000,
            autoPercentUsed: 25,
            apiPercentUsed: 31,
          },
        },
      },
      events: { usageEventsDisplay: [] },
      now: new Date(2026, 8, 1),
    })
    expect(ready.spendDisplay).toBe('usd')
    expect(ready.includedQuotas).toEqual([])
  })

  it('matches Stack Manager Current/Today math on an enterprise org pool', () => {
    const now = new Date(2026, 8, 2, 12, 0, 0)
    const ready = buildUsageReady({
      summary: loadJson('usage-summary.enterprise.json'),
      queries: [
        {
          timestamp: now.getTime(),
          model: 'default',
          kind: 'USAGE_EVENT_KIND_INCLUDED_IN_BUSINESS',
          costUsd: 2.11,
          tokens: 1000,
          inputTokens: 800,
          outputTokens: 200,
          cacheWriteTokens: 0,
          cacheReadTokens: 0,
        },
      ],
      now,
    })
    expect(ready.plan).toBe('enterprise')
    expect(ready.spendDisplay).toBe('usd')
    expect(ready.usedUsd).toBe(13.46)
    expect(ready.limitUsd).toBe(250)
    expect(ready.remainingUsd).toBe(236.54)
    expect(ready.workingDaysLeft).toBe(21)
    expect(ready.dailyBudgetUsd).toBeCloseTo(236.54 / 21)
    expect(ready.todayUsedUsd).toBe(2.11)
    expect(ready.onDemandLine).toBe('13.46 $ / 250.00 $')
  })

  it('sets todayUsedUsd null when events are unavailable', () => {
    const ready = buildUsageReady({
      summary: loadJson('usage-summary.sample.json'),
      events: loadJson('usage-events.sample.json'),
      now: new Date(2026, 8, 1),
      eventsAvailable: false,
    })
    expect(ready.todayUsedUsd).toBeNull()
    expect(ready.recentQueries).toEqual([])
    expect(ready.usedUsd).toBe(3.79)
  })

  it('hides daily budget when unlimited', () => {
    const ready = buildUsageReady({
      summary: { isUnlimited: true, membershipType: 'pro' },
      events: { usageEventsDisplay: [] },
      now: new Date(2026, 8, 1),
    })
    expect(ready.isUnlimited).toBe(true)
    expect(ready.dailyBudgetUsd).toBeNull()
    expect(ready.workingDaysLeft).toBeNull()
  })
})

describe('readBillingPoolLines', () => {
  it('reads included requests and on-demand dollars from usage-summary', () => {
    const lines = readBillingPoolLines(
      loadJson('usage-summary.sample.json'),
      'pro',
    )
    expect(lines.includedLine).toContain('Cursor Models')
    expect(lines.onDemandLine).toBe('3.79 $ / 250.00 $')
  })
})
