import { join, relative, sep } from 'node:path'

export type DiscoveredFile = {
  absolutePath: string
  size: number
  mtimeMs: number
}

export type FsDeps = {
  readdir: (path: string) => Promise<string[]>
  stat: (path: string) => Promise<'dir' | 'file' | 'missing'>
  sizeMtime: (path: string) => Promise<{ size: number; mtimeMs: number }>
  realpath: (path: string) => Promise<string>
}

const SESSION_DIRS = ['sessions', 'archived_sessions'] as const

const SKIP_DIR_NAMES = new Set([
  'cache',
  'plugins',
  'packages',
  'skills',
  'shell_snapshots',
  'tmp',
  '.tmp',
])

export type DiscoverOptions = {
  /** Walk `rootRealpath` itself. The path is already a sessions tree. */
  scanDirect?: boolean
}

export function isRolloutFileName(name: string): boolean {
  return (
    name.startsWith('rollout-') &&
    (name.endsWith('.jsonl.zst') || name.endsWith('.jsonl'))
  )
}

function isInsideRoot(rootRealpath: string, fileRealpath: string): boolean {
  if (fileRealpath === rootRealpath) {
    return false
  }
  const rel = relative(rootRealpath, fileRealpath)
  if (rel === '' || rel.startsWith('..') || rel.includes(`..${sep}`)) {
    return false
  }
  // Windows drive-relative escapes also start with ..
  return !rel.startsWith(`..${sep}`) && rel !== '..'
}

async function walkDir(
  dir: string,
  rootRealpath: string,
  deps: FsDeps,
  out: DiscoveredFile[],
): Promise<void> {
  let names: string[]
  try {
    names = await deps.readdir(dir)
  } catch {
    return
  }

  for (const name of names) {
    const absolutePath = join(dir, name)
    const kind = await deps.stat(absolutePath)
    if (kind === 'dir') {
      if (SKIP_DIR_NAMES.has(name)) {
        continue
      }
      await walkDir(absolutePath, rootRealpath, deps, out)
      continue
    }
    if (kind !== 'file' || !isRolloutFileName(name)) {
      continue
    }
    let fileRealpath: string
    try {
      fileRealpath = await deps.realpath(absolutePath)
    } catch {
      continue
    }
    if (!isInsideRoot(rootRealpath, fileRealpath)) {
      continue
    }
    const fileKind = await deps.stat(fileRealpath)
    if (fileKind !== 'file') {
      continue
    }
    const { size, mtimeMs } = await deps.sizeMtime(fileRealpath)
    out.push({ absolutePath: fileRealpath, size, mtimeMs })
  }
}

function preferPlainJsonl(files: DiscoveredFile[]): DiscoveredFile[] {
  const plain = new Set<string>()
  for (const file of files) {
    if (file.absolutePath.endsWith('.jsonl')) {
      plain.add(file.absolutePath)
    }
  }
  return files.filter((file) => {
    if (!file.absolutePath.endsWith('.jsonl.zst')) {
      return true
    }
    return !plain.has(file.absolutePath.slice(0, -'.zst'.length))
  })
}

export async function discoverRolloutFiles(
  rootRealpath: string,
  deps: FsDeps,
  options?: DiscoverOptions,
): Promise<DiscoveredFile[]> {
  const out: DiscoveredFile[] = []
  if (options?.scanDirect === true) {
    await walkDir(rootRealpath, rootRealpath, deps, out)
  } else {
    for (const dirName of SESSION_DIRS) {
      const dir = join(rootRealpath, dirName)
      if ((await deps.stat(dir)) !== 'dir') {
        continue
      }
      await walkDir(dir, rootRealpath, deps, out)
    }
  }
  const preferred = preferPlainJsonl(out)
  preferred.sort((a, b) => a.absolutePath.localeCompare(b.absolutePath))
  return preferred
}
