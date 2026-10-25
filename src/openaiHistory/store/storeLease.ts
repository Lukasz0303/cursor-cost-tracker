export type LeaseStore = {
  read(): Promise<string | null>
  write(value: string): Promise<void>
}

export type LeaseRole = 'writer' | 'reader'

export const IMPORT_LEASE_TTL_MS = 60_000

type LeaseRecord = {
  ownerId: string
  expiresAt: number
}

function parseLease(raw: string | null): LeaseRecord | null {
  if (raw === null || raw.trim() === '') {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as LeaseRecord).ownerId !== 'string' ||
      typeof (parsed as LeaseRecord).expiresAt !== 'number'
    ) {
      return null
    }
    return {
      ownerId: (parsed as LeaseRecord).ownerId,
      expiresAt: (parsed as LeaseRecord).expiresAt,
    }
  } catch {
    return null
  }
}

export async function tryAcquireImportLease(
  store: LeaseStore,
  ownerId: string,
  nowMs: number,
): Promise<LeaseRole> {
  const current = parseLease(await store.read())
  const expired = current === null || current.expiresAt <= nowMs
  if (!expired && current.ownerId !== ownerId) {
    return 'reader'
  }

  const expiresAt = nowMs + IMPORT_LEASE_TTL_MS
  await store.write(JSON.stringify({ ownerId, expiresAt }))
  return 'writer'
}
