import { execSync } from 'node:child_process'

// npm install outside a git checkout (pack, some CI caches) has nothing to configure.
try {
  execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' })
} catch {
  process.exit(0)
}

execSync('git config core.hooksPath .githooks')
