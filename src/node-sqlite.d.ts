declare module 'node:sqlite' {
  export class DatabaseSync {
    constructor(
      path: string,
      options?: { readOnly?: boolean; timeout?: number; open?: boolean },
    )
    close(): void
    prepare(sql: string): StatementSync
  }

  export class StatementSync {
    get(...parameters: unknown[]): Record<string, unknown> | undefined
  }
}
