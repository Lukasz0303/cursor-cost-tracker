import * as esbuild from 'esbuild'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const watch = process.argv.includes('--watch')
const distDir = join(root, 'dist')
const secretPath = join(root, '.ai', 'reports', '.unlock-secret')
const wasmSrc = join(root, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')
const wasmDest = join(distDir, 'sql-wasm.wasm')

const CSS_PARTS = [
  'base.css',
  'queries.css',
  'stats.css',
  'charts.css',
  'optimize.css',
  'leaderboard.css',
  'support.css',
  'settings.css',
]

/** Rebuild media/history.css in the original rule order. */
function writeWebviewCss() {
  const dir = join(root, 'media', 'css')
  const blocks = []
  for (let part = 0; part < CSS_PARTS.length; part++) {
    const text = readFileSync(join(dir, CSS_PARTS[part]), 'utf8')
    const marks = []
    const re = /\/\* cct-order: (\d+) \*\/\n/g
    let match = re.exec(text)
    while (match) {
      marks.push({
        order: Number(match[1]),
        bodyStart: match.index + match[0].length,
        markerStart: match.index,
      })
      match = re.exec(text)
    }
    if (marks.length === 0) {
      if (text.trim() !== '' && text.trim() !== '/* Layer reserved. */') {
        blocks.push({ order: 1_000_000 + part, body: text })
      }
      continue
    }
    if (marks[0].markerStart > 0) {
      const preamble = text.slice(0, marks[0].markerStart)
      if (preamble.trim() !== '') {
        blocks.push({ order: marks[0].order - 0.5, body: preamble })
      }
    }
    for (let i = 0; i < marks.length; i++) {
      const end = i + 1 < marks.length ? marks[i + 1].markerStart : text.length
      blocks.push({
        order: marks[i].order,
        body: text.slice(marks[i].bodyStart, end),
      })
    }
  }
  blocks.sort((left, right) => left.order - right.order)
  const css = blocks.map((block) => block.body).join('')
  writeFileSync(
    join(root, 'media', 'history.css'),
    `/* Generated from media/css. Do not edit. */\n${css}`,
  )
}

function copySqlWasm() {
  mkdirSync(distDir, { recursive: true })
  if (!existsSync(wasmSrc)) {
    throw new Error(
      `sql.js wasm not found at ${wasmSrc}. Run npm install before building.`,
    )
  }
  copyFileSync(wasmSrc, wasmDest)
}

/** @type {esbuild.Plugin} */
const copySqlWasmPlugin = {
  name: 'copy-sql-wasm',
  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length > 0) {
        return
      }
      copySqlWasm()
      writeWebviewCss()
      await esbuild.build({
        absWorkingDir: root,
        entryPoints: ['src/webview/limits.ts'],
        bundle: true,
        format: 'iife',
        globalName: '__cctLimits',
        platform: 'browser',
        target: 'es2022',
        outfile: join(root, 'media', 'limits.js'),
        minify: !watch,
        legalComments: 'none',
        banner: {
          js: '/* Generated from src/webview/limits.ts. Do not edit. */',
        },
        logLevel: 'info',
      })
      await esbuild.build({
        absWorkingDir: root,
        entryPoints: ['media/src/main.js'],
        bundle: true,
        format: 'iife',
        platform: 'browser',
        target: 'es2022',
        outfile: join(root, 'media', 'history.js'),
        minify: !watch,
        legalComments: 'none',
        banner: {
          js: '/* Generated from media/src. Do not edit. */',
        },
        logLevel: 'info',
      })
      await esbuild.build({
        absWorkingDir: root,
        entryPoints: ['media/src/leaderboardMain.js'],
        bundle: true,
        format: 'iife',
        platform: 'browser',
        target: 'es2022',
        outfile: join(root, 'media', 'leaderboard.js'),
        minify: !watch,
        legalComments: 'none',
        banner: {
          js: '/* Generated from media/src/leaderboardMain.js. Do not edit. */',
        },
        logLevel: 'info',
      })
    })
  },
}

/** Keeps the signing secret out of the repository; builds without it use the source fallback. */
function unlockSecretDefine() {
  if (!existsSync(secretPath)) {
    return {}
  }
  const secret = readFileSync(secretPath, 'utf8').trim()
  if (secret.length === 0) {
    return {}
  }
  return { 'process.env.CCT_UNLOCK_SECRET': JSON.stringify(secret) }
}

const ctx = await esbuild.context({
  absWorkingDir: root,
  entryPoints: ['src/extension.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  outfile: 'dist/extension.js',
  external: ['vscode', 'node:sqlite'],
  define: unlockSecretDefine(),
  sourcemap: watch,
  sourcesContent: watch,
  minify: !watch,
  logLevel: 'info',
  plugins: [copySqlWasmPlugin],
})

if (watch) {
  await ctx.watch()
} else {
  await ctx.rebuild()
  await ctx.dispose()
}
