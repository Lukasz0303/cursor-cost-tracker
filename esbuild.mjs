import * as esbuild from 'esbuild'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const watch = process.argv.includes('--watch')
const distDir = join(root, 'dist')
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

const ctx = await esbuild.context({
  absWorkingDir: root,
  entryPoints: ['src/extension.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  outfile: 'dist/extension.js',
  external: ['vscode', 'node:sqlite'],
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
