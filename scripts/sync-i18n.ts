/**
 * Keep locale catalogs aligned with English without rewriting translations
 * that are already present.
 *
 *   npm run sync-i18n -- check
 *   npm run sync-i18n -- sync
 *   npm run sync-i18n -- export
 *   npm run sync-i18n -- import
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { catalogDrift } from '../src/i18n/catalogs'
import { DE } from '../src/i18n/catalogs/de'
import { EN } from '../src/i18n/catalogs/en'
import { ES } from '../src/i18n/catalogs/es'
import { FR } from '../src/i18n/catalogs/fr'
import { JA } from '../src/i18n/catalogs/ja'
import { KO } from '../src/i18n/catalogs/ko'
import { PL } from '../src/i18n/catalogs/pl'
import { PT_BR } from '../src/i18n/catalogs/pt-br'
import { RU } from '../src/i18n/catalogs/ru'
import { UK } from '../src/i18n/catalogs/uk'
import { ZH_CN } from '../src/i18n/catalogs/zh-cn'
import {
  applyTranslations,
  fillMissing,
  isRecord,
  sameAsEnglish,
} from './i18nCatalog'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const catalogsDir = join(root, 'src/i18n/catalogs')
const exportDir = join(root, 'tmp/i18n')

const LOCALES = [
  ['pl', 'PL', PL],
  ['zh-cn', 'ZH_CN', ZH_CN],
  ['ja', 'JA', JA],
  ['es', 'ES', ES],
  ['pt-br', 'PT_BR', PT_BR],
  ['ru', 'RU', RU],
  ['ko', 'KO', KO],
  ['fr', 'FR', FR],
  ['de', 'DE', DE],
  ['uk', 'UK', UK],
] as const

function localeByName(name: string): (typeof LOCALES)[number] | undefined {
  return LOCALES.find(([locale]) => locale === name)
}

async function writeCatalog(
  locale: string,
  exportName: string,
  value: Record<string, unknown>,
): Promise<void> {
  const body = `export const ${exportName} = ${JSON.stringify(value, null, 2)}\n`
  await writeFile(join(catalogsDir, `${locale}.ts`), body, 'utf8')
}

async function check(): Promise<number> {
  let problems = 0
  for (const [locale, , catalog] of LOCALES) {
    const drift = catalogDrift(catalog)
    if (drift.length === 0) continue
    problems += drift.length
    console.error(`${locale}: ${drift.join(', ')}`)
  }
  if (problems === 0) {
    console.log('Catalogs match English keys and placeholders.')
    return 0
  }
  console.error(`${problems} catalog problem(s).`)
  return 1
}

async function sync(): Promise<number> {
  let wrote = 0
  for (const [locale, exportName, catalog] of LOCALES) {
    const filled = fillMissing(EN, catalog)
    if (!filled.changed) continue
    await writeCatalog(locale, exportName, filled.value)
    wrote += 1
    console.log(`Added missing English keys to ${locale}.`)
  }
  if (wrote === 0) console.log('No missing keys.')
  return check()
}

async function exportMissing(): Promise<number> {
  await mkdir(exportDir, { recursive: true })
  let files = 0
  for (const [locale, , catalog] of LOCALES) {
    const pending = sameAsEnglish(EN, catalog)
    if (Object.keys(pending).length === 0) continue
    await writeFile(
      join(exportDir, `${locale}.json`),
      `${JSON.stringify(pending, null, 2)}\n`,
      'utf8',
    )
    files += 1
    console.log(`Exported strings still equal to English: ${locale}`)
  }
  if (files === 0) console.log('No strings are still identical to English.')
  return 0
}

async function importTranslations(): Promise<number> {
  let names: string[]
  try {
    names = await readdir(exportDir)
  } catch {
    console.error(`Nothing to import. Expected JSON files in ${exportDir}.`)
    return 1
  }
  let failed = false
  for (const name of names) {
    const match = /^([a-z]{2}(?:-[a-z]{2})?)\.json$/.exec(name)
    if (!match?.[1]) continue
    const localeName = match[1]
    const known = localeByName(localeName)
    if (!known) {
      console.error(`Skipping unknown locale file ${name}`)
      continue
    }
    const [locale, exportName, catalog] = known
    const parsed: unknown = JSON.parse(
      await readFile(join(exportDir, name), 'utf8'),
    )
    if (!isRecord(parsed)) {
      console.error(`${name} is not a JSON object`)
      failed = true
      continue
    }
    const applied = applyTranslations(EN, catalog, parsed)
    if (applied.problems.length > 0) {
      console.error(`${locale}: ${applied.problems.join(', ')}`)
      failed = true
      continue
    }
    await writeCatalog(locale, exportName, applied.value)
    console.log(`Imported ${locale}`)
  }
  if (failed) return 1
  return check()
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'check'
  const commands: Record<string, () => Promise<number>> = {
    check,
    sync,
    export: exportMissing,
    import: importTranslations,
  }
  const run = commands[command]
  if (!run) {
    console.error('Usage: sync-i18n <check|sync|export|import>')
    process.exit(1)
  }
  process.exit(await run())
}

const entry = process.argv[1]
if (entry?.endsWith('sync-i18n.ts')) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'sync-i18n failed'
    console.error(message)
    process.exit(1)
  })
}
