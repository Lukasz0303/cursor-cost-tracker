import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export type GitExecResult = { stdout: string; stderr: string }

export type ExecGit = (args: string[], cwd: string) => Promise<GitExecResult>

/** Generated-lines collect: one repo, short log. */
export const GIT_COLLECT_TIMEOUT_MS = 15_000
export const GIT_COLLECT_MAX_BUFFER = 8 * 1024 * 1024

/** Leaderboard scan: many repos, longer log. */
export const GIT_SCAN_TIMEOUT_MS = 60_000
export const GIT_SCAN_MAX_BUFFER = 32 * 1024 * 1024

export function createExecGit(options: {
  timeoutMs: number
  maxBuffer: number
}): ExecGit {
  return async (args, cwd) => {
    const result = await execFileAsync('git', args, {
      cwd,
      timeout: options.timeoutMs,
      maxBuffer: options.maxBuffer,
      encoding: 'utf8',
    })
    return { stdout: result.stdout, stderr: result.stderr }
  }
}
