/**
 * Remote default when `origin/HEAD` is known (`main`, `master`, `develop`, …).
 * Without that ref, prefer a local `main`, then `master`.
 */
export function pickDefaultBranch(
  localBranches: readonly string[],
  originHead: string | null = null,
): string | null {
  const remote = shortBranchName(originHead)
  if (remote !== null) {
    return remote
  }
  const set = new Set(localBranches.map((name) => name.trim()).filter(Boolean))
  if (set.has('main')) {
    return 'main'
  }
  if (set.has('master')) {
    return 'master'
  }
  return null
}

/** `master` from `origin/master` or `refs/heads/master`. Unsafe refspec text is dropped. */
export function shortBranchName(raw: string | null | undefined): string | null {
  const name = raw
    ?.trim()
    .replace(/^refs\/heads\//, '')
    .replace(/^origin\//, '') ?? ''
  if (!isSafeBranchName(name)) {
    return null
  }
  return name
}

/** Refspec that updates `refs/remotes/origin/<branch>` for whatever the default is called. */
export function originTrackingRefspec(branch: string): string | null {
  const name = shortBranchName(branch)
  if (name === null) {
    return null
  }
  return `refs/heads/${name}:refs/remotes/origin/${name}`
}

function isSafeBranchName(name: string): boolean {
  if (
    name === '' ||
    name.startsWith('-') ||
    name.startsWith('/') ||
    name.endsWith('/') ||
    name.endsWith('.lock') ||
    name.includes('..') ||
    name.includes('@{') ||
    name.includes('//')
  ) {
    return false
  }
  return !/[\s~^:?*[\\]/.test(name)
}
