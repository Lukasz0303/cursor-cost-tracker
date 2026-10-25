import { z } from 'zod'

/** Built-in grade list. Empty settings use this object, not placeholder text. */
export const DEFAULT_SPEND_MIX_BUCKETS: readonly SpendMixBucket[] = Object.freeze([
  Object.freeze({ id: 'cheap', label: 'Cheap', match: Object.freeze(['luna', 'haiku']) }),
  Object.freeze({
    id: 'balanced',
    label: 'Balanced',
    match: Object.freeze(['terra', 'sonnet']),
  }),
  Object.freeze({ id: 'high', label: 'High', match: Object.freeze(['sol', 'opus']) }),
])

export const SPEND_MIX_JSON_MAX_BYTES = 4096

export const SPEND_MIX_SCHEMA_ERROR = {
  json: 'Spend mix JSON is invalid.',
  size: 'Spend mix JSON is larger than 4 KB.',
  shape: 'Spend mix buckets are invalid.',
  id: 'Bucket id must be a lowercase slug.',
  label: 'Bucket label must be 1-40 plain-text characters.',
  match: 'Each match must be 1-40 characters.',
  matchCount: 'A bucket needs 1-24 match strings.',
  buckets: 'At most 8 buckets.',
  totalMatch: 'At most 32 match strings.',
  duplicateId: 'Bucket ids must be unique.',
} as const

export type SpendMixBucket = {
  id: string
  label: string
  match: readonly string[]
}

export type SpendMixSchemaResult = {
  buckets: SpendMixBucket[]
  error: string | null
}

const KNOWN_ERRORS = new Set<string>(Object.values(SPEND_MIX_SCHEMA_ERROR))

const bucketId = z
  .string()
  .regex(/^[a-z][a-z0-9-]{0,31}$/, SPEND_MIX_SCHEMA_ERROR.id)

const plainLabel = z
  .string()
  .trim()
  .min(1, SPEND_MIX_SCHEMA_ERROR.label)
  .max(40, SPEND_MIX_SCHEMA_ERROR.label)
  .refine(
    (value) => !/[\u0000-\u001F\u007F<>]/.test(value),
    SPEND_MIX_SCHEMA_ERROR.label,
  )

const matchTerm = z
  .string()
  .trim()
  .min(1, SPEND_MIX_SCHEMA_ERROR.match)
  .max(40, SPEND_MIX_SCHEMA_ERROR.match)
  .refine(
    (value) => !/[\u0000-\u001F\u007F]/.test(value),
    SPEND_MIX_SCHEMA_ERROR.match,
  )

const bucketSchema = z.object({
  id: bucketId,
  label: plainLabel,
  match: z
    .array(matchTerm)
    .min(1, SPEND_MIX_SCHEMA_ERROR.matchCount)
    .max(24, SPEND_MIX_SCHEMA_ERROR.matchCount),
})

const spendMixSchema = z
  .object({
    buckets: z.array(bucketSchema).max(8, SPEND_MIX_SCHEMA_ERROR.buckets),
  })
  .superRefine((value, ctx) => {
    const ids = new Set<string>()
    let matches = 0
    for (const bucket of value.buckets) {
      matches += bucket.match.length
      if (ids.has(bucket.id)) {
        ctx.addIssue({
          code: 'custom',
          message: SPEND_MIX_SCHEMA_ERROR.duplicateId,
        })
      }
      ids.add(bucket.id)
    }
    if (matches > 32) {
      ctx.addIssue({
        code: 'custom',
        message: SPEND_MIX_SCHEMA_ERROR.totalMatch,
      })
    }
  })

function cloneBuckets(buckets: readonly SpendMixBucket[]): SpendMixBucket[] {
  return buckets.map((bucket) => ({
    id: bucket.id,
    label: bucket.label,
    match: [...bucket.match],
  }))
}

function keepPrevious(
  previous: readonly SpendMixBucket[],
  error: string,
): SpendMixSchemaResult {
  return { buckets: cloneBuckets(previous), error }
}

function formatIssue(error: z.ZodError): string {
  for (const issue of error.issues) {
    if (KNOWN_ERRORS.has(issue.message)) {
      return issue.message
    }
  }
  return SPEND_MIX_SCHEMA_ERROR.shape
}

/**
 * Empty settings return the built-in buckets. Invalid JSON or schema keeps
 * `previous` so a bad edit cannot wipe the last good list or throw into a poll.
 */
export function resolveSpendMixBuckets(
  raw: unknown,
  previous: readonly SpendMixBucket[] = DEFAULT_SPEND_MIX_BUCKETS,
): SpendMixSchemaResult {
  if (typeof raw !== 'string') {
    return keepPrevious(previous, SPEND_MIX_SCHEMA_ERROR.json)
  }
  if (new TextEncoder().encode(raw).length > SPEND_MIX_JSON_MAX_BYTES) {
    return keepPrevious(previous, SPEND_MIX_SCHEMA_ERROR.size)
  }
  if (raw.trim() === '') {
    return { buckets: cloneBuckets(DEFAULT_SPEND_MIX_BUCKETS), error: null }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return keepPrevious(previous, SPEND_MIX_SCHEMA_ERROR.json)
  }
  const checked = spendMixSchema.safeParse(parsed)
  if (!checked.success) {
    return keepPrevious(previous, formatIssue(checked.error))
  }
  return { buckets: cloneBuckets(checked.data.buckets), error: null }
}
