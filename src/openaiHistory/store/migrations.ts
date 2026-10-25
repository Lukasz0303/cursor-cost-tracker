import type { Database } from 'sql.js'

const MIGRATION_1 = [
  `CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY
  )`,
  `CREATE TABLE IF NOT EXISTS source_instances (
    id TEXT PRIMARY KEY NOT NULL,
    provider TEXT NOT NULL,
    root_realpath TEXT NOT NULL,
    device_id TEXT NOT NULL,
    last_scan_at TEXT NOT NULL,
    parser_version TEXT NOT NULL,
    unrecognized_lines INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS source_files (
    id TEXT PRIMARY KEY NOT NULL,
    source_instance_id TEXT NOT NULL,
    absolute_path TEXT NOT NULL,
    generation INTEGER NOT NULL,
    size_bytes INTEGER NOT NULL,
    mtime_ms REAL NOT NULL,
    prefix_fingerprint TEXT NOT NULL,
    UNIQUE (source_instance_id, absolute_path)
  )`,
  `CREATE TABLE IF NOT EXISTS import_checkpoints (
    source_file_id TEXT PRIMARY KEY NOT NULL,
    generation INTEGER NOT NULL,
    byte_offset INTEGER NOT NULL,
    partial_bytes BLOB,
    parser_context TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY NOT NULL,
    provider TEXT NOT NULL,
    account_scope_key TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    parent_conversation_id TEXT,
    title TEXT NOT NULL,
    turn_count INTEGER,
    first_observed_at TEXT NOT NULL,
    last_observed_at TEXT NOT NULL,
    UNIQUE (provider, account_scope_key, conversation_id)
  )`,
  `CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY NOT NULL,
    provider TEXT NOT NULL,
    source TEXT NOT NULL,
    account_scope_key TEXT NOT NULL,
    account_confidence TEXT NOT NULL,
    conversation_id TEXT,
    session_id TEXT,
    turn_id TEXT,
    response_id TEXT,
    provisional_key TEXT,
    observed_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    model TEXT,
    model_evidence TEXT NOT NULL,
    billing_mode TEXT NOT NULL,
    status TEXT NOT NULL,
    error_code TEXT,
    input_tokens INTEGER,
    cached_input_tokens INTEGER,
    cache_write_input_tokens INTEGER,
    output_tokens INTEGER,
    reasoning_output_tokens INTEGER,
    total_tokens INTEGER,
    usage_quality TEXT NOT NULL,
    usage_anomaly INTEGER NOT NULL DEFAULT 0,
    estimated_api_cost_usd TEXT,
    reported_cost_usd TEXT,
    pricing_version TEXT,
    cost_coverage TEXT NOT NULL,
    device_id TEXT NOT NULL,
    source_instance_id TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS requests_response_uid
    ON requests(provider, account_scope_key, response_id)
    WHERE response_id IS NOT NULL AND response_id != ''`,
  `CREATE UNIQUE INDEX IF NOT EXISTS requests_provisional_uid
    ON requests(provisional_key)
    WHERE provisional_key IS NOT NULL AND provisional_key != ''`,
  `CREATE INDEX IF NOT EXISTS requests_source_scope_observed
    ON requests(source, account_scope_key, observed_at, id)`,
  `CREATE INDEX IF NOT EXISTS requests_conversation_observed
    ON requests(conversation_id, observed_at, id)`,
  `CREATE INDEX IF NOT EXISTS requests_model_observed
    ON requests(model, observed_at, id)`,
  `CREATE TABLE IF NOT EXISTS request_observations (
    id TEXT PRIMARY KEY NOT NULL,
    request_id TEXT NOT NULL,
    source_file_id TEXT NOT NULL,
    generation INTEGER NOT NULL,
    byte_offset INTEGER NOT NULL,
    observed_at TEXT NOT NULL,
    attributes_spend INTEGER NOT NULL,
    UNIQUE (source_file_id, generation, byte_offset)
  )`,
  `CREATE TABLE IF NOT EXISTS usage_snapshots (
    id TEXT PRIMARY KEY NOT NULL,
    source_file_id TEXT NOT NULL,
    generation INTEGER NOT NULL,
    byte_offset INTEGER NOT NULL,
    conversation_id TEXT,
    observed_at TEXT NOT NULL,
    input_tokens INTEGER,
    cached_input_tokens INTEGER,
    cache_write_input_tokens INTEGER,
    output_tokens INTEGER,
    reasoning_output_tokens INTEGER,
    total_tokens INTEGER,
    gap INTEGER NOT NULL DEFAULT 0,
    UNIQUE (source_file_id, generation, byte_offset)
  )`,
]

const MIGRATION_2 = [
  `CREATE TABLE IF NOT EXISTS pricing_versions (
    id TEXT PRIMARY KEY NOT NULL,
    model TEXT NOT NULL,
    effective_from TEXT NOT NULL,
    service_tier TEXT,
    input_rate TEXT NOT NULL,
    cached_input_rate TEXT NOT NULL,
    output_rate TEXT NOT NULL,
    source TEXT NOT NULL
  )`,
]

const MIGRATION_3 = [
  `ALTER TABLE source_instances ADD COLUMN ignored_lines INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE pricing_versions ADD COLUMN cache_write_rate TEXT`,
  `ALTER TABLE pricing_versions ADD COLUMN reasoning_rate TEXT`,
  `CREATE TABLE IF NOT EXISTS rate_limit_samples (
    id TEXT PRIMARY KEY NOT NULL,
    source_file_id TEXT NOT NULL,
    generation INTEGER NOT NULL,
    byte_offset INTEGER NOT NULL,
    observed_at TEXT NOT NULL,
    plan_type TEXT,
    limit_id TEXT,
    primary_used_percent REAL,
    primary_window_minutes INTEGER,
    primary_resets_at INTEGER,
    secondary_used_percent REAL,
    secondary_window_minutes INTEGER,
    secondary_resets_at INTEGER,
    credits_has_credits INTEGER,
    credits_unlimited INTEGER,
    credits_balance TEXT,
    rate_limit_reached_type TEXT,
    UNIQUE (source_file_id, generation, byte_offset)
  )`,
]

const MIGRATION_5 = [
  `ALTER TABLE requests ADD COLUMN model_context_window INTEGER`,
]

const MIGRATION_4 = [
  `CREATE TABLE IF NOT EXISTS billing_buckets (
    id TEXT PRIMARY KEY NOT NULL,
    scope_id TEXT NOT NULL,
    start_at INTEGER NOT NULL,
    end_at INTEGER NOT NULL,
    dimensions_hash TEXT NOT NULL,
    model TEXT,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    cached_tokens INTEGER NOT NULL,
    requests INTEGER NOT NULL,
    cost_usd TEXT,
    fetched_at TEXT NOT NULL,
    UNIQUE (scope_id, start_at, end_at, dimensions_hash)
  )`,
]

export function migrateSchema(db: Database): void {
  db.run(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY
    )`,
  )
  const applied = new Set<number>()
  const stmt = db.prepare('SELECT version FROM schema_migrations')
  try {
    while (stmt.step()) {
      const row = stmt.getAsObject()
      const version = row.version
      if (typeof version === 'number') {
        applied.add(version)
      }
    }
  } finally {
    stmt.free()
  }

  if (!applied.has(1)) {
    for (const sql of MIGRATION_1) {
      db.run(sql)
    }
    db.run('INSERT INTO schema_migrations(version) VALUES (1)')
  }

  if (!applied.has(2)) {
    for (const sql of MIGRATION_2) {
      db.run(sql)
    }
    db.run('INSERT INTO schema_migrations(version) VALUES (2)')
  }

  if (!applied.has(3)) {
    for (const sql of MIGRATION_3) {
      db.run(sql)
    }
    db.run('INSERT INTO schema_migrations(version) VALUES (3)')
  }

  if (!applied.has(4)) {
    for (const sql of MIGRATION_4) {
      db.run(sql)
    }
    db.run('INSERT INTO schema_migrations(version) VALUES (4)')
  }

  if (!applied.has(5)) {
    for (const sql of MIGRATION_5) {
      db.run(sql)
    }
    db.run('INSERT INTO schema_migrations(version) VALUES (5)')
  }
}
