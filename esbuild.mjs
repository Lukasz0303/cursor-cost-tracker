import * as esbuild from 'esbuild'
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const watch = process.argv.includes('--watch')
const distDir = join(root, 'dist')
const secretPath = join(root, '.ai', 'reports', '.unlock-secret')
const wasmSrc = join(root, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')
const wasmDest = join(distDir, 'sql-wasm.wasm')

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
    build.onEnd((result) => {
      if (result.errors.length > 0) {
        return
      }
      copySqlWasm()
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
