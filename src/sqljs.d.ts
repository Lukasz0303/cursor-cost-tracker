declare module 'sql.js' {
  export type SqlValue = string | number | null | Uint8Array

  export class Statement {
    bind(values?: SqlValue[] | Record<string, SqlValue>): boolean
    step(): boolean
    getAsObject(): Record<string, SqlValue>
    free(): boolean
  }

  export class Database {
    constructor(data?: ArrayLike<number> | Buffer | null)
    prepare(sql: string): Statement
    run(sql: string, params?: SqlValue[]): Database
    export(): Uint8Array
    close(): void
  }

  export type SqlJsStatic = {
    Database: typeof Database
  }

  export type InitSqlJsOptions = {
    locateFile?: (file: string) => string
  }

  export default function initSqlJs(
    options?: InitSqlJsOptions,
  ): Promise<SqlJsStatic>
}
